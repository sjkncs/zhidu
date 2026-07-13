/**
 * @zhidu/ai — 确定性决策节点引擎（PA_Agent 模式）
 *
 * 核心设计：
 * 1. 关键决策节点由程序确定性计算，不依赖 LLM
 * 2. LLM 可提交 override（覆盖），但锁定节点不可覆盖
 * 3. 安全节点只能向保守方向覆盖
 *
 * 节点分类：
 * - locked: 程序权威，不可覆盖（数据充分性、冲稳保分层）
 * - overridable: 程序优先，LLM 可用证据覆盖（推荐理由、个性化建议）
 * - ai_primary: LLM 主导，程序兜底（综合评语、风险提示）
 */

import type { MatchResult, VolunteerRecommendation } from './volunteer-engine';

// ─── Decision Node Types ────────────────────────────────────────────────────

export type NodeAuthority = 'locked' | 'overridable' | 'ai_primary';

export interface DecisionNode<T = unknown> {
  id: string;
  label: string;
  authority: NodeAuthority;
  /** 程序计算值 */
  programValue: T;
  /** LLM 覆盖值（如果有） */
  aiValue?: T;
  /** 覆盖理由 */
  overrideReason?: string;
  /** 最终生效值 */
  finalValue: T;
  /** 计算依据（数据溯源） */
  evidence: string;
}

export interface DecisionTrace {
  nodes: DecisionNode[];
  /** 数据充分性门禁 */
  dataSufficient: boolean;
  /** 总体置信度 0-1 */
  overallConfidence: number;
  /** 时间戳 */
  timestamp: string;
}

// ─── Override Request ───────────────────────────────────────────────────────

export interface NodeOverride {
  nodeId: string;
  value: unknown;
  reason: string;
  /** K 线/数据引用（如 "2024年武汉大学最低录取分632，位次1200"） */
  dataReference: string;
}

// ─── Gate Result ────────────────────────────────────────────────────────────

export type GateResult = 'proceed' | 'wait' | 'insufficient_data';

export interface GateCheck {
  result: GateResult;
  reasons: string[];
  /** 数据年份覆盖度 */
  dataYearCoverage: number;
  /** 数据量 */
  recordCount: number;
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class DecisionNodeEngine {
  /**
   * 门禁检查：数据是否充分到可以给出推荐
   */
  runGateCheck(recommendation: VolunteerRecommendation): GateCheck {
    const reasons: string[] = [];
    const { summary, rank, currentScoreLine } = recommendation;

    // 检查 1：位次数据
    if (!rank || rank <= 0) {
      reasons.push('无法确定考生位次');
    }

    // 检查 2：省控线数据
    if (!currentScoreLine || currentScoreLine <= 0) {
      reasons.push('当前年份省控线数据缺失');
    }

    // 检查 3：匹配结果数量
    if (summary.totalMatched === 0) {
      reasons.push('未匹配到任何院校专业组合');
    }

    // 检查 4：数据年份覆盖
    const dataYearCoverage = summary.dataYears.length;
    if (dataYearCoverage < 2) {
      reasons.push(`历史数据仅覆盖 ${dataYearCoverage} 年，建议至少 2 年`);
    }

    // 检查 5：冲稳保各层是否有结果
    const hasRush = recommendation.rush.length > 0;
    const hasStable = recommendation.stable.length > 0;
    const hasSafe = recommendation.safe.length > 0;
    if (!hasStable) {
      reasons.push('稳层无匹配结果，推荐方案不完整');
    }

    let result: GateResult;
    if (reasons.length >= 3) {
      result = 'insufficient_data';
    } else if (reasons.length >= 1 && !hasStable) {
      result = 'wait';
    } else {
      result = 'proceed';
    }

    return {
      result,
      reasons,
      dataYearCoverage,
      recordCount: summary.totalMatched,
    };
  }

  /**
   * 构建决策追踪：为每个推荐结果生成确定性节点
   */
  buildDecisionTrace(
    recommendation: VolunteerRecommendation,
    gateCheck: GateCheck,
  ): DecisionTrace {
    const nodes: DecisionNode[] = [];

    // ─── Node 1.1: 数据充分性（locked） ──────────────────────────
    nodes.push({
      id: 'section_1_1',
      label: '数据充分性检查',
      authority: 'locked',
      programValue: gateCheck.result === 'proceed',
      finalValue: gateCheck.result === 'proceed',
      evidence: `数据覆盖 ${gateCheck.dataYearCoverage} 年，共 ${gateCheck.recordCount} 条记录`,
    });

    // ─── Node 2.1: 考生位次定位（locked） ──────────────────────────
    nodes.push({
      id: 'section_2_1',
      label: '考生位次定位',
      authority: 'locked',
      programValue: {
        rank: recommendation.rank,
        province: recommendation.query.province,
        subjectType: recommendation.query.subjectType,
        score: recommendation.query.score,
        lineDiff: recommendation.query.score - recommendation.currentScoreLine,
      },
      finalValue: {
        rank: recommendation.rank,
        province: recommendation.query.province,
        subjectType: recommendation.query.subjectType,
        score: recommendation.query.score,
        lineDiff: recommendation.query.score - recommendation.currentScoreLine,
      },
      evidence: `位次 ${recommendation.rank}，分数 ${recommendation.query.score}，省控线 ${recommendation.currentScoreLine}`,
    });

    // ─── Node 3.x: 冲稳保分层验证（locked） ──────────────────────
    this.buildTierNodes(recommendation, nodes);

    // ─── Node 4.x: 数据置信度评估（overridable） ──────────────────
    this.buildConfidenceNodes(recommendation, nodes);

    // ─── Node 5.x: 风险提示（ai_primary） ──────────────────────────
    this.buildRiskNodes(recommendation, nodes);

    // 计算总体置信度
    const overallConfidence = this.calculateOverallConfidence(
      recommendation,
      gateCheck,
    );

    return {
      nodes,
      dataSufficient: gateCheck.result === 'proceed',
      overallConfidence,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 应用 LLM 覆盖：合并 LLM 的 override 请求
   * 返回合并后的 trace + 被拒绝的覆盖
   */
  applyOverrides(
    trace: DecisionTrace,
    overrides: NodeOverride[],
  ): { updatedTrace: DecisionTrace; rejected: Array<{ override: NodeOverride; reason: string }> } {
    const rejected: Array<{ override: NodeOverride; reason: string }> = [];
    const updatedTrace = { ...trace, nodes: trace.nodes.map((n) => ({ ...n })) };

    for (const override of overrides) {
      const node = updatedTrace.nodes.find((n) => n.id === override.nodeId);

      if (!node) {
        rejected.push({ override, reason: `节点 ${override.nodeId} 不存在` });
        continue;
      }

      // locked 节点不可覆盖
      if (node.authority === 'locked') {
        rejected.push({
          override,
          reason: `节点 ${node.id}（${node.label}）为锁定节点，不可覆盖`,
        });
        continue;
      }

      // 应用覆盖
      node.aiValue = override.value;
      node.overrideReason = override.reason;
      node.finalValue = override.value as typeof node.finalValue;
    }

    return { updatedTrace, rejected };
  }

  /**
   * 验证推荐结果的内部一致性
   */
  validateConsistency(recommendation: VolunteerRecommendation): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const allResults = [
      ...recommendation.rush,
      ...recommendation.stable,
      ...recommendation.safe,
    ];

    for (const result of allResults) {
      // 检查 1：概率与层级一致
      if (result.tier === 'RUSH' && result.probability >= 40) {
        issues.push(`${result.universityName}: 概率 ${result.probability}% 但标记为冲`);
      }
      if (result.tier === 'STABLE' && (result.probability < 40 || result.probability >= 75)) {
        issues.push(`${result.universityName}: 概率 ${result.probability}% 但标记为稳`);
      }
      if (result.tier === 'SAFE' && result.probability < 75) {
        issues.push(`${result.universityName}: 概率 ${result.probability}% 但标记为保`);
      }

      // 检查 2：概率范围合理
      if (result.probability < 1 || result.probability > 99) {
        issues.push(`${result.universityName}: 概率 ${result.probability}% 超出合理范围`);
      }

      // 检查 3：置信度与数据量一致
      if (result.confidence === 'high' && !result.historicalMinRank) {
        issues.push(`${result.universityName}: 高置信度但无位次数据`);
      }
    }

    // 检查 4：冲层概率应从高到低
    for (let i = 1; i < recommendation.rush.length; i++) {
      if (recommendation.rush[i].probability > recommendation.rush[i - 1].probability) {
        issues.push(`冲层排序异常：${recommendation.rush[i].universityName} 概率高于前一个`);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  // ─── Private: Build tier nodes ────────────────────────────────────

  private buildTierNodes(
    recommendation: VolunteerRecommendation,
    nodes: DecisionNode[],
  ): void {
    // Node 3.1: 冲层数量与质量
    const rushCount = recommendation.rush.length;
    const rushAvgProb = rushCount > 0
      ? recommendation.rush.reduce((s, r) => s + r.probability, 0) / rushCount
      : 0;

    nodes.push({
      id: 'section_3_1',
      label: '冲层评估',
      authority: 'locked',
      programValue: {
        count: rushCount,
        avgProbability: Math.round(rushAvgProb),
        quality: rushCount >= 3 ? 'adequate' : rushCount >= 1 ? 'limited' : 'none',
      },
      finalValue: {
        count: rushCount,
        avgProbability: Math.round(rushAvgProb),
        quality: rushCount >= 3 ? 'adequate' : rushCount >= 1 ? 'limited' : 'none',
      },
      evidence: `冲层 ${rushCount} 所院校，平均概率 ${Math.round(rushAvgProb)}%`,
    });

    // Node 3.2: 稳层数量与质量
    const stableCount = recommendation.stable.length;
    const stableAvgProb = stableCount > 0
      ? recommendation.stable.reduce((s, r) => s + r.probability, 0) / stableCount
      : 0;

    nodes.push({
      id: 'section_3_2',
      label: '稳层评估',
      authority: 'locked',
      programValue: {
        count: stableCount,
        avgProbability: Math.round(stableAvgProb),
        quality: stableCount >= 5 ? 'adequate' : stableCount >= 2 ? 'limited' : 'none',
      },
      finalValue: {
        count: stableCount,
        avgProbability: Math.round(stableAvgProb),
        quality: stableCount >= 5 ? 'adequate' : stableCount >= 2 ? 'limited' : 'none',
      },
      evidence: `稳层 ${stableCount} 所院校，平均概率 ${Math.round(stableAvgProb)}%`,
    });

    // Node 3.3: 保层数量与质量
    const safeCount = recommendation.safe.length;
    const safeAvgProb = safeCount > 0
      ? recommendation.safe.reduce((s, r) => s + r.probability, 0) / safeCount
      : 0;

    nodes.push({
      id: 'section_3_3',
      label: '保层评估',
      authority: 'locked',
      programValue: {
        count: safeCount,
        avgProbability: Math.round(safeAvgProb),
        quality: safeCount >= 3 ? 'adequate' : safeCount >= 1 ? 'limited' : 'none',
      },
      finalValue: {
        count: safeCount,
        avgProbability: Math.round(safeAvgProb),
        quality: safeCount >= 3 ? 'adequate' : safeCount >= 1 ? 'limited' : 'none',
      },
      evidence: `保层 ${safeCount} 所院校，平均概率 ${Math.round(safeAvgProb)}%`,
    });
  }

  // ─── Private: Build confidence nodes ──────────────────────────────

  private buildConfidenceNodes(
    recommendation: VolunteerRecommendation,
    nodes: DecisionNode[],
  ): void {
    const allResults = [
      ...recommendation.rush,
      ...recommendation.stable,
      ...recommendation.safe,
    ];

    const highConfCount = allResults.filter((r) => r.confidence === 'high').length;
    const mlUsedCount = allResults.filter((r) => r.mlUsed).length;
    const totalCount = allResults.length;

    nodes.push({
      id: 'section_4_1',
      label: '整体数据置信度',
      authority: 'overridable',
      programValue: {
        highConfidenceRatio: totalCount > 0 ? highConfCount / totalCount : 0,
        mlCoverage: totalCount > 0 ? mlUsedCount / totalCount : 0,
        dataYears: recommendation.summary.dataYears,
        overall: recommendation.summary.confidence,
      },
      finalValue: {
        highConfidenceRatio: totalCount > 0 ? highConfCount / totalCount : 0,
        mlCoverage: totalCount > 0 ? mlUsedCount / totalCount : 0,
        dataYears: recommendation.summary.dataYears,
        overall: recommendation.summary.confidence,
      },
      evidence: `${highConfCount}/${totalCount} 高置信度，${mlUsedCount} 使用 ML 模型，数据年份 ${recommendation.summary.dataYears.join(',')}`,
    });
  }

  // ─── Private: Build risk nodes ─────────────────────────────────────

  private buildRiskNodes(
    recommendation: VolunteerRecommendation,
    nodes: DecisionNode[],
  ): void {
    // 检测大小年现象
    const allResults = [
      ...recommendation.rush,
      ...recommendation.stable,
      ...recommendation.safe,
    ];

    const volatileSchools = allResults.filter((r) => {
      // 如果录取分波动超过 15 分，标记为大小年风险
      const scoreSpread = r.historicalAvgScore
        ? Math.abs(r.historicalAvgScore - r.historicalMinScore)
        : 0;
      return scoreSpread > 15;
    });

    nodes.push({
      id: 'section_5_1',
      label: '大小年风险检测',
      authority: 'ai_primary',
      programValue: {
        atRiskCount: volatileSchools.length,
        atRiskSchools: volatileSchools.map((s) => ({
          name: s.universityName,
          spread: s.historicalAvgScore
            ? Math.abs(s.historicalAvgScore - s.historicalMinScore)
            : 0,
        })),
      },
      finalValue: {
        atRiskCount: volatileSchools.length,
        atRiskSchools: volatileSchools.map((s) => ({
          name: s.universityName,
          spread: s.historicalAvgScore
            ? Math.abs(s.historicalAvgScore - s.historicalMinScore)
            : 0,
        })),
      },
      evidence: `${volatileSchools.length} 所院校存在大小年风险（录取分波动 > 15 分）`,
    });
  }

  // ─── Private: Calculate overall confidence ────────────────────────

  private calculateOverallConfidence(
    recommendation: VolunteerRecommendation,
    gateCheck: GateCheck,
  ): number {
    let confidence = 0.5;

    // 数据年份覆盖（+0.1 per year, max 0.3）
    confidence += Math.min(0.3, gateCheck.dataYearCoverage * 0.1);

    // 匹配数量（+0.05 per 10 records, max 0.2）
    confidence += Math.min(0.2, (gateCheck.recordCount / 10) * 0.05);

    // 三层均有结果（+0.1）
    if (
      recommendation.rush.length > 0 &&
      recommendation.stable.length > 0 &&
      recommendation.safe.length > 0
    ) {
      confidence += 0.1;
    }

    // 高置信度占比（+0.1 if > 50%）
    const allResults = [
      ...recommendation.rush,
      ...recommendation.stable,
      ...recommendation.safe,
    ];
    const highConfRatio = allResults.filter((r) => r.confidence === 'high').length
      / (allResults.length || 1);
    if (highConfRatio > 0.5) confidence += 0.1;

    return Math.min(1, Math.max(0, confidence));
  }
}
