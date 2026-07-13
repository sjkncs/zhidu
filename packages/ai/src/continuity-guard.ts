/**
 * @zhidu/ai — 连续性守卫（PA_Agent 模式）
 *
 * 防止新推荐与之前的分析矛盾：
 * 1. 已确认的志愿顺序不应被轻易推翻
 * 2. 短期内不应在同一条件下推荐完全相反的方案
 * 3. 翻转冷却期：同一用户在 N 分钟内不应收到矛盾推荐
 */

import type { VolunteerRecommendation, MatchResult } from './volunteer-engine';
import type { DecisionTrace } from './decision-nodes';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PreviousPlan {
  id: string;
  userId: string;
  timestamp: string;
  query: {
    score: number;
    province: string;
    subjectType: string;
    year: number;
  };
  rush: Array<{ universityId: string; universityName: string; probability: number }>;
  stable: Array<{ universityId: string; universityName: string; probability: number }>;
  safe: Array<{ universityId: string; universityName: string; probability: number }>;
}

export interface ContinuityCheckResult {
  /** 是否通过连续性检查 */
  passed: boolean;
  /** 检测到的矛盾 */
  contradictions: Contradiction[];
  /** 建议操作 */
  suggestion: 'proceed' | 'warn' | 'block';
  /** 给 LLM 的提示文本 */
  hintForLLM: string;
}

export interface Contradiction {
  type: 'tier_flip' | 'order_reversal' | 'score_mismatch' | 'cooldown_violation';
  description: string;
  severity: 'info' | 'warning' | 'critical';
  /** 涉及的院校 */
  universities: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** 翻转冷却期（毫秒）：同一用户在此时间内不应收到矛盾推荐 */
const FLIP_COOLDOWN_MS = 30 * 60 * 1000; // 30 分钟

/** 概率变化阈值：同一院校概率变化超过此值视为异常 */
const PROBABILITY_SHIFT_THRESHOLD = 25;

// ─── Engine ─────────────────────────────────────────────────────────────────

export class ContinuityGuard {
  /**
   * 检查新推荐是否与之前的计划矛盾
   */
  check(
    current: VolunteerRecommendation,
    previous: PreviousPlan | null,
  ): ContinuityCheckResult {
    if (!previous) {
      return {
        passed: true,
        contradictions: [],
        suggestion: 'proceed',
        hintForLLM: '这是用户的首次咨询，无历史推荐记录。',
      };
    }

    const contradictions: Contradiction[] = [];

    // 检查 1：冷却期
    const timeSinceLast = Date.now() - new Date(previous.timestamp).getTime();
    if (timeSinceLast < FLIP_COOLDOWN_MS) {
      // 在冷却期内，检查是否有矛盾推荐
      const tierFlips = this.detectTierFlips(current, previous);
      contradictions.push(...tierFlips);
    }

    // 检查 2：分数变化合理性
    const scoreMismatch = this.detectScoreMismatch(current, previous);
    if (scoreMismatch) {
      contradictions.push(scoreMismatch);
    }

    // 检查 3：排序反转
    const orderReversals = this.detectOrderReversals(current, previous);
    contradictions.push(...orderReversals);

    // 生成建议
    const hasCritical = contradictions.some((c) => c.severity === 'critical');
    const hasWarning = contradictions.some((c) => c.severity === 'warning');

    let suggestion: ContinuityCheckResult['suggestion'];
    if (hasCritical) {
      suggestion = 'block';
    } else if (hasWarning) {
      suggestion = 'warn';
    } else {
      suggestion = 'proceed';
    }

    // 生成给 LLM 的提示
    const hintForLLM = this.buildHint(current, previous, contradictions);

    return {
      passed: !hasCritical,
      contradictions,
      suggestion,
      hintForLLM,
    };
  }

  /**
   * 检测冲稳保层级翻转
   * 同一院校在两次推荐中从"保"变"冲"或反之
   */
  private detectTierFlips(
    current: VolunteerRecommendation,
    previous: PreviousPlan,
  ): Contradiction[] {
    const contradictions: Contradiction[] = [];

    // 构建上次的 tier 映射
    const prevTierMap = new Map<string, string>();
    for (const u of previous.rush) prevTierMap.set(u.universityId, 'RUSH');
    for (const u of previous.stable) prevTierMap.set(u.universityId, 'STABLE');
    for (const u of previous.safe) prevTierMap.set(u.universityId, 'SAFE');

    // 检查当前推荐中是否出现层级翻转
    const checkTierFlip = (results: MatchResult[], currentTier: string) => {
      for (const result of results) {
        const prevTier = prevTierMap.get(result.universityId);
        if (prevTier && prevTier !== currentTier) {
          // 从 SAFE→RUSH 或 RUSH→SAFE 是严重翻转
          const isSevereFlip =
            (prevTier === 'SAFE' && currentTier === 'RUSH') ||
            (prevTier === 'RUSH' && currentTier === 'SAFE');

          if (isSevereFlip) {
            contradictions.push({
              type: 'tier_flip',
              description: `${result.universityName} 从${this.tierLabel(prevTier)}翻转为${this.tierLabel(currentTier)}`,
              severity: 'critical',
              universities: [result.universityName],
            });
          } else {
            contradictions.push({
              type: 'tier_flip',
              description: `${result.universityName} 从${this.tierLabel(prevTier)}调整为${this.tierLabel(currentTier)}`,
              severity: 'warning',
              universities: [result.universityName],
            });
          }
        }
      }
    };

    checkTierFlip(current.rush, 'RUSH');
    checkTierFlip(current.stable, 'STABLE');
    checkTierFlip(current.safe, 'SAFE');

    return contradictions;
  }

  /**
   * 检测分数条件变化
   * 如果分数/省份/科类变了，推荐不同是正常的
   */
  private detectScoreMismatch(
    current: VolunteerRecommendation,
    previous: PreviousPlan,
  ): Contradiction | null {
    const { query } = current;
    const { query: prevQuery } = previous;

    if (query.score !== prevQuery.score) {
      return {
        type: 'score_mismatch',
        description: `用户分数从 ${prevQuery.score} 变为 ${query.score}，推荐差异属于正常`,
        severity: 'info',
        universities: [],
      };
    }

    if (query.province !== prevQuery.province || query.subjectType !== prevQuery.subjectType) {
      return {
        type: 'score_mismatch',
        description: `用户条件发生变化（省份或科类），推荐差异属于正常`,
        severity: 'info',
        universities: [],
      };
    }

    return null;
  }

  /**
   * 检测排序反转
   * 同一层级内，上次概率最高的院校这次变最低
   */
  private detectOrderReversals(
    current: VolunteerRecommendation,
    previous: PreviousPlan,
  ): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const prevProbMap = new Map<string, number>();

    for (const u of [...previous.rush, ...previous.stable, ...previous.safe]) {
      prevProbMap.set(u.universityId, u.probability);
    }

    const allCurrent = [...current.rush, ...current.stable, ...current.safe];
    for (const result of allCurrent) {
      const prevProb = prevProbMap.get(result.universityId);
      if (prevProb !== undefined) {
        const shift = Math.abs(result.probability - prevProb);
        if (shift > PROBABILITY_SHIFT_THRESHOLD) {
          contradictions.push({
            type: 'order_reversal',
            description: `${result.universityName} 概率变化 ${prevProb}% → ${result.probability}%（变化 ${shift}%）`,
            severity: shift > 40 ? 'warning' : 'info',
            universities: [result.universityName],
          });
        }
      }
    }

    return contradictions;
  }

  /**
   * 构建给 LLM 的上下文提示
   */
  private buildHint(
    current: VolunteerRecommendation,
    previous: PreviousPlan,
    contradictions: Contradiction[],
  ): string {
    const lines: string[] = [];

    lines.push(`[连续性上下文] 用户上次咨询时间: ${previous.timestamp}`);
    lines.push(`上次推荐: 冲${previous.rush.length}所 / 稳${previous.stable.length}所 / 保${previous.safe.length}所`);

    if (contradictions.length === 0) {
      lines.push('本次推荐与上次一致，无需特别说明。');
    } else {
      const critical = contradictions.filter((c) => c.severity === 'critical');
      const warnings = contradictions.filter((c) => c.severity === 'warning');

      if (critical.length > 0) {
        lines.push(`⚠ 检测到 ${critical.length} 个严重矛盾:`);
        for (const c of critical) {
          lines.push(`  - ${c.description}`);
        }
        lines.push('请向用户解释推荐变化的原因，并确认用户条件是否发生了变化。');
      }

      if (warnings.length > 0) {
        lines.push(`提示: ${warnings.length} 个轻微变化:`);
        for (const c of warnings.slice(0, 3)) {
          lines.push(`  - ${c.description}`);
        }
      }
    }

    return lines.join('\n');
  }

  private tierLabel(tier: string): string {
    switch (tier) {
      case 'RUSH': return '冲';
      case 'STABLE': return '稳';
      case 'SAFE': return '保';
      default: return tier;
    }
  }
}
