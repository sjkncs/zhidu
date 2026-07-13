/**
 * @zhidu/ai — 推荐结果验证器（PA_Agent 模式）
 *
 * 多层验证 LLM 输出，分类错误并触发针对性重试：
 * - a: JSON 语法错误
 * - b: 缺失必要字段
 * - c: 非法枚举值
 * - d: 跨字段一致性
 * - e: 语义合理性
 */

import type { VolunteerRecommendation, MatchResult } from './volunteer-engine';
import type { DecisionTrace } from './decision-nodes';

// ─── Error Categories ───────────────────────────────────────────────────────

export type ValidationErrorCategory = 'syntax' | 'missing_field' | 'invalid_value' | 'coherence' | 'semantic';

export interface ValidationError {
  category: ValidationErrorCategory;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  /** 按类别统计 */
  errorCounts: Record<ValidationErrorCategory, number>;
  /** 给 LLM 的重试反馈（如果验证失败） */
  retryFeedback?: string;
}

// ─── Retry Budget ───────────────────────────────────────────────────────────

export interface RetryBudget {
  syntaxMax: number;   // 语法错误最大重试
  semanticMax: number; // 语义错误最大重试
  current: number;     // 当前重试次数
}

export function createDefaultBudget(): RetryBudget {
  return { syntaxMax: 3, semanticMax: 1, current: 0 };
}

export function canRetry(budget: RetryBudget, category: ValidationErrorCategory): boolean {
  if (category === 'syntax' || category === 'missing_field') {
    return budget.current < budget.syntaxMax;
  }
  return budget.current < budget.semanticMax;
}

// ─── Validator ──────────────────────────────────────────────────────────────

export class RecommendationValidator {
  /**
   * 验证推荐结果的完整性
   */
  validate(recommendation: VolunteerRecommendation, trace: DecisionTrace): ValidationResult {
    const errors: ValidationError[] = [];

    // Layer 1: 结构验证
    this.validateStructure(recommendation, errors);

    // Layer 2: 数值范围验证
    this.validateRanges(recommendation, errors);

    // Layer 3: 跨字段一致性
    this.validateCoherence(recommendation, errors);

    // Layer 4: 语义合理性
    this.validateSemantics(recommendation, trace, errors);

    // 统计
    const errorCounts: Record<ValidationErrorCategory, number> = {
      syntax: 0, missing_field: 0, invalid_value: 0, coherence: 0, semantic: 0,
    };
    for (const e of errors) {
      errorCounts[e.category]++;
    }

    const valid = errors.filter((e) => e.severity === 'error').length === 0;

    return {
      valid,
      errors,
      errorCounts,
      retryFeedback: valid ? undefined : this.buildRetryFeedback(errors),
    };
  }

  // ─── Layer 1: Structure ──────────────────────────────────────────

  private validateStructure(rec: VolunteerRecommendation, errors: ValidationError[]): void {
    // 必须有 query
    if (!rec.query) {
      errors.push({ category: 'missing_field', field: 'query', message: '缺少考生查询参数', severity: 'error' });
    }

    // 必须有 rank
    if (!rec.rank || rec.rank <= 0) {
      errors.push({ category: 'missing_field', field: 'rank', message: '考生位次缺失或无效', severity: 'error' });
    }

    // 三层数组必须存在（可以为空）
    if (!Array.isArray(rec.rush)) {
      errors.push({ category: 'missing_field', field: 'rush', message: '冲层数据缺失', severity: 'error' });
    }
    if (!Array.isArray(rec.stable)) {
      errors.push({ category: 'missing_field', field: 'stable', message: '稳层数据缺失', severity: 'error' });
    }
    if (!Array.isArray(rec.safe)) {
      errors.push({ category: 'missing_field', field: 'safe', message: '保层数据缺失', severity: 'error' });
    }

    // summary 必须存在
    if (!rec.summary) {
      errors.push({ category: 'missing_field', field: 'summary', message: '数据摘要缺失', severity: 'error' });
    }
  }

  // ─── Layer 2: Ranges ─────────────────────────────────────────────

  private validateRanges(rec: VolunteerRecommendation, errors: ValidationError[]): void {
    const allResults = [...rec.rush, ...rec.stable, ...rec.safe];

    for (const r of allResults) {
      // 概率范围
      if (r.probability < 1 || r.probability > 99) {
        errors.push({
          category: 'invalid_value',
          field: `${r.universityName}.probability`,
          message: `概率 ${r.probability}% 超出 [1,99] 范围`,
          severity: 'error',
        });
      }

      // tier 枚举
      if (!['RUSH', 'STABLE', 'SAFE'].includes(r.tier)) {
        errors.push({
          category: 'invalid_value',
          field: `${r.universityName}.tier`,
          message: `非法层级值: ${r.tier}`,
          severity: 'error',
        });
      }

      // confidence 枚举
      if (!['high', 'medium', 'low'].includes(r.confidence)) {
        errors.push({
          category: 'invalid_value',
          field: `${r.universityName}.confidence`,
          message: `非法置信度值: ${r.confidence}`,
          severity: 'warning',
        });
      }

      // 分数合理性
      if (r.historicalMinScore < 100 || r.historicalMinScore > 800) {
        errors.push({
          category: 'invalid_value',
          field: `${r.universityName}.historicalMinScore`,
          message: `历史最低分 ${r.historicalMinScore} 超出合理范围`,
          severity: 'warning',
        });
      }
    }
  }

  // ─── Layer 3: Coherence ──────────────────────────────────────────

  private validateCoherence(rec: VolunteerRecommendation, errors: ValidationError[]): void {
    // 概率与 tier 一致
    const checkTierCoherence = (results: MatchResult[], expectedTier: string, minProb: number, maxProb: number) => {
      for (const r of results) {
        if (r.probability < minProb || r.probability > maxProb) {
          errors.push({
            category: 'coherence',
            field: `${r.universityName}`,
            message: `概率 ${r.probability}% 与层级 ${expectedTier} 不一致（期望 ${minProb}-${maxProb}%）`,
            severity: 'warning',
          });
        }
      }
    };

    checkTierCoherence(rec.rush, 'RUSH', 1, 39);
    checkTierCoherence(rec.stable, 'STABLE', 40, 74);
    checkTierCoherence(rec.safe, 'SAFE', 75, 99);

    // 排序一致性：冲层概率从高到低
    for (let i = 1; i < rec.rush.length; i++) {
      if (rec.rush[i].probability > rec.rush[i - 1].probability) {
        errors.push({
          category: 'coherence',
          field: 'rush.order',
          message: `冲层排序异常: 第${i + 1}项概率(${rec.rush[i].probability}%)高于第${i}项(${rec.rush[i - 1].probability}%)`,
          severity: 'warning',
        });
      }
    }
  }

  // ─── Layer 4: Semantics ──────────────────────────────────────────

  private validateSemantics(rec: VolunteerRecommendation, trace: DecisionTrace, errors: ValidationError[]): void {
    // 如果门禁不通过但有大量推荐 → 语义矛盾
    if (!trace.dataSufficient && rec.rush.length + rec.stable.length + rec.safe.length > 10) {
      errors.push({
        category: 'semantic',
        field: 'global',
        message: '数据门禁未通过但输出了大量推荐，可能存在幻觉',
        severity: 'error',
      });
    }

    // 总体置信度与数据质量一致
    if (trace.overallConfidence < 0.3 && rec.summary.confidence === 'high') {
      errors.push({
        category: 'semantic',
        field: 'summary.confidence',
        message: `决策追踪置信度 ${(trace.overallConfidence * 100).toFixed(0)}% 但 summary 标记为 high`,
        severity: 'warning',
      });
    }

    // 保底层概率不应全部 > 95%（说明搜索范围太窄）
    if (rec.safe.length > 0) {
      const avgSafeProb = rec.safe.reduce((s, r) => s + r.probability, 0) / rec.safe.length;
      if (avgSafeProb > 95) {
        errors.push({
          category: 'semantic',
          field: 'safe.avgProbability',
          message: `保底层平均概率 ${avgSafeProb.toFixed(0)}% 过高，可能需要扩大搜索范围`,
          severity: 'warning',
        });
      }
    }
  }

  // ─── Build Retry Feedback ────────────────────────────────────────

  private buildRetryFeedback(errors: ValidationError[]): string {
    const lines: string[] = ['你的输出存在以下问题，请修正后重新生成：'];

    const errorGroups = new Map<ValidationErrorCategory, ValidationError[]>();
    for (const e of errors) {
      if (!errorGroups.has(e.category)) errorGroups.set(e.category, []);
      errorGroups.get(e.category)!.push(e);
    }

    for (const [category, errs] of errorGroups) {
      lines.push(`\n[${category}] (${errs.length} 个问题):`);
      for (const e of errs.slice(0, 5)) {
        lines.push(`  - ${e.field}: ${e.message}`);
      }
    }

    return lines.join('\n');
  }
}
