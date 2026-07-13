/**
 * @zhidu/ai — PortfolioAgent（PA_Agent 模式：独立资管智能体）
 *
 * 三阶段流水线：
 *   Stage 1: Gate Check + Market Diagnosis（5-signal voting）
 *   Stage 2: Strategy Selection + Factor Mining + Position Sizing
 *   Stage 3: Continuity Guard + Validation + Output
 *
 * 核心设计：
 *   - 确定性节点（locked）：程序计算，不可覆盖
 *   - 可覆盖节点（overridable）：程序优先，LLM 可用证据覆盖
 *   - AI 主导节点（ai_primary）：LLM 主导，程序兜底
 *
 * 参考：PA_Agent 二元决策树 + 栀染 AlphaGPT 因子挖掘 + cjquant SDK
 */

import { InvestmentAnalysisEngine, type AssetQuery, type InvestmentSignal, type DeFiYieldAnalysis } from './investment-engine';
import { DecisionNodeEngine, type DecisionTrace, type GateCheck, type DecisionNode } from './decision-nodes';
import { ContinuityGuard, type PreviousPlan, type ContinuityCheckResult } from './continuity-guard';
import { RecommendationValidator, type ValidationResult } from './recommendation-validator';
import { detectBehavioralBiases, STRATEGY_TEMPLATES, type TradingContext, type BehavioralBias } from './factor-library';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AnalysisMode = 'quick_scan' | 'full_diagnosis' | 'rebalance_plan' | 'defi_review';

export interface PortfolioAnalysisRequest {
  portfolioId?: string;
  userId: string;
  mode?: AnalysisMode;
  db: any;
  /** 当前持仓（如果前端直接传入） */
  positions?: PositionData[];
  /** 目标市场筛选 */
  targetMarkets?: string[];
}

export interface PositionData {
  id?: string;
  symbol: string;
  name: string;
  market: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue?: number;
  pnl?: number;
  pnlPercent?: number;
  weight?: number;
  aiSignal?: string;
}

export interface PortfolioAgentResult {
  /** 分析模式 */
  mode: AnalysisMode;
  /** 门禁结果 */
  gateCheck: GateCheck;
  /** 决策追踪 */
  decisionTrace: DecisionTrace;
  /** 每个持仓的信号分析 */
  positionSignals: PositionSignal[];
  /** 组合级评估 */
  portfolioAssessment: PortfolioAssessment;
  /** 调仓建议 */
  recommendations: AgentRecommendation[];
  /** 连续性守卫结果 */
  continuityCheck: ContinuityCheckResult;
  /** 验证结果 */
  validation: ValidationResult;
  /** 总体置信度 0-1 */
  overallConfidence: number;
  /** 给 LLM 的结构化 Prompt */
  structuredPrompt: string;
  /** 行为偏差检测结果（投资行为学知识库） */
  behavioralBiases: Array<{
    biasId: string;
    biasName: string;
    biasNameCN: string;
    severity: number;
    evidence: string;
    mitigation: string;
  }>;
  /** 匹配的策略模板 */
  matchedStrategies: Array<{
    id: string;
    name: string;
    nameCN: string;
    regime: string;
    rules: string[];
    prohibitions: string[];
  }>;
  /** 时间戳 */
  timestamp: string;
}

export interface PositionSignal {
  symbol: string;
  name: string;
  market: string;
  signal: InvestmentSignal;
  /** Kelly 建议仓位 */
  kellyPosition: number;
  /** 当前仓位偏差 */
  positionDeviation: number;
  /** 操作建议 */
  action: 'increase' | 'maintain' | 'decrease' | 'close' | 'no_action';
}

export interface PortfolioAssessment {
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  returnPct: number;
  sharpeRatio: number;
  maxDrawdown: number;
  diversification: number;
  riskLevel: string;
  sectorConcentration: Record<string, number>;
  marketConcentration: Record<string, number>;
}

export interface AgentRecommendation {
  type: 'buy' | 'sell' | 'rebalance' | 'hedge' | 'alert';
  symbol: string;
  name: string;
  reason: string;
  urgency: 'immediate' | 'soon' | 'optional';
  targetWeight?: number;
  confidence: number;
  /** 决策节点溯源 */
  traceNodeId: string;
}

// ─── Agent Class ────────────────────────────────────────────────────────────

export class PortfolioAgent {
  private investmentEngine: InvestmentAnalysisEngine;
  private decisionEngine: DecisionNodeEngine;
  private continuityGuard: ContinuityGuard;
  private validator: RecommendationValidator;

  constructor() {
    this.investmentEngine = new InvestmentAnalysisEngine();
    this.decisionEngine = new DecisionNodeEngine();
    this.continuityGuard = new ContinuityGuard();
    this.validator = new RecommendationValidator();
  }

  /**
   * 主入口：执行完整的三阶段资管分析流水线
   */
  async analyze(request: PortfolioAnalysisRequest): Promise<PortfolioAgentResult> {
    const mode = request.mode ?? 'full_diagnosis';
    const timestamp = new Date().toISOString();

    // ═══════════════════════════════════════════════════════════
    // Stage 1: Gate Check + Market Diagnosis
    // ═══════════════════════════════════════════════════════════

    const positions = request.positions ?? await this.fetchPositions(request);
    const gateCheck = this.runGateCheck(positions);

    // 门禁不通过：短路返回
    if (gateCheck.result !== 'proceed') {
      return this.buildShortCircuitResult(mode, gateCheck, timestamp);
    }

    // 对每个持仓执行 5-signal voting
    const positionSignals = await this.stage1Diagnose(positions);

    // ═══════════════════════════════════════════════════════════
    // Stage 2: Strategy + Factor Mining + Position Sizing
    // ═══════════════════════════════════════════════════════════

    const assessment = this.stage2Strategy(positions, positionSignals);
    const rawRecommendations = this.stage2Recommendations(positions, positionSignals, assessment, mode);

    // ═══════════════════════════════════════════════════════════
    // Stage 3: Continuity Guard + Validation + Output
    // ═══════════════════════════════════════════════════════════

    // 构建决策追踪
    const decisionTrace = this.buildDecisionTrace(gateCheck, positionSignals, assessment);

    // 连续性守卫（检查历史分析记录）
    const continuityCheck = await this.runContinuityGuard(request, positionSignals);

    // 验证输出一致性
    const validation = this.validateOutput(positionSignals, rawRecommendations, decisionTrace);

    // 过滤被连续性守卫阻止的建议
    const recommendations = this.applyContinuityFilter(rawRecommendations, continuityCheck);

    // 计算总体置信度
    const overallConfidence = this.calculateConfidence(gateCheck, decisionTrace, validation, continuityCheck);

    // 构建结构化 Prompt
    const structuredPrompt = this.buildStructuredPrompt(
      mode, gateCheck, positionSignals, assessment, recommendations, decisionTrace, continuityCheck,
    );

    // ── 投资行为学偏差检测（PA_Agent + 栀染知识库） ──
    const behavioralBiases = this.detectBehavioralBiases(positions, positionSignals);

    // ── 策略模板匹配（PA_Agent 策略路由） ──
    const matchedStrategies = this.matchStrategies(positionSignals, assessment);

    return {
      mode,
      gateCheck,
      decisionTrace,
      positionSignals,
      portfolioAssessment: assessment,
      recommendations,
      continuityCheck,
      validation,
      overallConfidence,
      structuredPrompt,
      behavioralBiases,
      matchedStrategies,
      timestamp,
    };
  }

  // ─── Stage 1: Gate Check + Diagnosis ────────────────────────────

  private runGateCheck(positions: PositionData[]): GateCheck {
    const reasons: string[] = [];

    if (positions.length === 0) {
      reasons.push('无持仓数据');
    }

    const invalidPositions = positions.filter(
      (p) => !p.symbol || !p.name || p.quantity <= 0
    );
    if (invalidPositions.length > 0) {
      reasons.push(`${invalidPositions.length} 个持仓数据不完整`);
    }

    // 市场覆盖度
    const markets = new Set(positions.map((p) => p.market));
    const marketCoverage = markets.size;

    return {
      result: reasons.length >= 2 ? 'insufficient_data' : reasons.length >= 1 ? 'wait' : 'proceed',
      reasons,
      dataYearCoverage: marketCoverage,
      recordCount: positions.length,
    };
  }

  private async stage1Diagnose(positions: PositionData[]): Promise<PositionSignal[]> {
    const signals: PositionSignal[] = [];

    for (const pos of positions) {
      const query: AssetQuery = {
        symbol: pos.symbol,
        market: pos.market as any,
      };

      try {
        const signal = await this.investmentEngine.analyzeAsset(query);

        // Kelly 公式计算建议仓位
        const kellyPosition = this.calculateKellyPosition(signal);
        const currentWeight = pos.weight ?? 0;
        const positionDeviation = currentWeight - kellyPosition;

        // 操作建议
        let action: PositionSignal['action'] = 'no_action';
        if (signal.tier === 'STRONG_SELL' || signal.tier === 'SELL') {
          action = positionDeviation > 2 ? 'decrease' : 'close';
        } else if (signal.tier === 'STRONG_BUY' || signal.tier === 'BUY') {
          if (positionDeviation < -2) action = 'increase';
          else if (currentWeight === 0) action = 'increase';
        } else if (Math.abs(positionDeviation) > 5) {
          action = 'decrease';
        }

        signals.push({
          symbol: pos.symbol,
          name: pos.name,
          market: pos.market,
          signal,
          kellyPosition,
          positionDeviation,
          action,
        });
      } catch {
        signals.push({
          symbol: pos.symbol,
          name: pos.name,
          market: pos.market,
          signal: {
            symbol: pos.symbol,
            market: pos.market,
            direction: 'neutral',
            signalScore: 0,
            signals: {},
            confidence: 0,
            tier: 'HOLD',
          },
          kellyPosition: 0,
          positionDeviation: 0,
          action: 'no_action',
        });
      }
    }

    return signals;
  }

  // ─── Stage 2: Strategy + Position Sizing ────────────────────────

  private stage2Strategy(
    positions: PositionData[],
    signals: PositionSignal[],
  ): PortfolioAssessment {
    // 计算组合总值
    const totalValue = positions.reduce((sum, p) => {
      const mv = (p.currentPrice ?? 0) * (p.quantity ?? 0);
      return sum + mv;
    }, 0);

    const totalCost = positions.reduce((sum, p) => {
      return sum + (p.avgCost ?? 0) * (p.quantity ?? 0);
    }, 0);

    const totalReturn = totalValue - totalCost;
    const returnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

    // 夏普比率（简化版：假设无风险利率 3%）
    const returns = signals.map((s) => s.signal.signalScore * 0.02); // 近似收益
    const avgReturn = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
    const stdReturn = Math.sqrt(
      returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length || 1)
    );
    const sharpeRatio = stdReturn > 0 ? (avgReturn - 0.03) / stdReturn : 0;

    // 最大回撤（简化版）
    const maxDrawdown = Math.max(
      0,
      ...positions.map((p) => {
        const pnlPct = p.pnlPercent ?? 0;
        return pnlPct < 0 ? Math.abs(pnlPct) : 0;
      })
    );

    // 分散度（Herfindahl 指数反转）
    const weights = positions.map((p) => {
      const w = p.weight ?? ((p.currentPrice * p.quantity) / (totalValue || 1)) * 100;
      return w / 100;
    });
    const hhi = weights.reduce((s, w) => s + w ** 2, 0);
    const diversification = 1 - hhi;

    // 风险等级
    let riskLevel = 'balanced';
    if (maxDrawdown > 20 || sharpeRatio < 0) riskLevel = 'very_aggressive';
    else if (maxDrawdown > 10 || sharpeRatio < 0.5) riskLevel = 'aggressive';
    else if (maxDrawdown < 5 && diversification > 0.7) riskLevel = 'conservative';

    // 市场集中度
    const marketConcentration: Record<string, number> = {};
    for (const p of positions) {
      const mv = (p.currentPrice ?? 0) * (p.quantity ?? 0);
      const pct = totalValue > 0 ? (mv / totalValue) * 100 : 0;
      marketConcentration[p.market] = (marketConcentration[p.market] ?? 0) + pct;
    }

    // 行业集中度（使用 symbol 前缀作为近似）
    const sectorConcentration: Record<string, number> = {};
    for (const p of positions) {
      const sector = p.market; // 简化：用市场代替行业
      const mv = (p.currentPrice ?? 0) * (p.quantity ?? 0);
      const pct = totalValue > 0 ? (mv / totalValue) * 100 : 0;
      sectorConcentration[sector] = (sectorConcentration[sector] ?? 0) + pct;
    }

    return {
      totalValue,
      totalCost,
      totalReturn,
      returnPct,
      sharpeRatio,
      maxDrawdown,
      diversification,
      riskLevel,
      sectorConcentration,
      marketConcentration,
    };
  }

  private stage2Recommendations(
    positions: PositionData[],
    signals: PositionSignal[],
    assessment: PortfolioAssessment,
    mode: AnalysisMode,
  ): AgentRecommendation[] {
    const recs: AgentRecommendation[] = [];

    // 基于信号生成个券建议
    for (const sig of signals) {
      if (sig.action === 'close' && sig.signal.tier === 'STRONG_SELL') {
        recs.push({
          type: 'sell',
          symbol: sig.symbol,
          name: sig.name,
          reason: `AI 信号强烈卖出（评分 ${sig.signal.signalScore}），建议清仓止损`,
          urgency: 'immediate',
          confidence: sig.signal.confidence,
          traceNodeId: `signal_${sig.symbol}`,
        });
      } else if (sig.action === 'decrease' && sig.positionDeviation > 5) {
        recs.push({
          type: 'rebalance',
          symbol: sig.symbol,
          name: sig.name,
          reason: `当前仓位 ${(sig.positionDeviation + sig.kellyPosition).toFixed(1)}% 高于 Kelly 建议 ${sig.kellyPosition.toFixed(1)}%，偏差 ${sig.positionDeviation.toFixed(1)}%`,
          urgency: 'soon',
          targetWeight: sig.kellyPosition,
          confidence: sig.signal.confidence,
          traceNodeId: `kelly_${sig.symbol}`,
        });
      } else if (sig.action === 'increase' && sig.signal.tier === 'STRONG_BUY') {
        recs.push({
          type: 'buy',
          symbol: sig.symbol,
          name: sig.name,
          reason: `AI 信号强烈买入（评分 +${sig.signal.signalScore}），Kelly 建议仓位 ${sig.kellyPosition.toFixed(1)}%`,
          urgency: 'soon',
          targetWeight: sig.kellyPosition,
          confidence: sig.signal.confidence,
          traceNodeId: `kelly_${sig.symbol}`,
        });
      }
    }

    // 组合级建议
    if (assessment.diversification < 0.5) {
      recs.push({
        type: 'alert',
        symbol: 'PORTFOLIO',
        name: '组合分散度',
        reason: `组合分散度 ${(assessment.diversification * 100).toFixed(0)}% 偏低，建议增加不同市场/行业配置`,
        urgency: 'optional',
        confidence: 0.8,
        traceNodeId: 'diversification',
      });
    }

    if (assessment.maxDrawdown > 15) {
      recs.push({
        type: 'hedge',
        symbol: 'PORTFOLIO',
        name: '风险对冲',
        reason: `最大回撤 ${assessment.maxDrawdown.toFixed(1)}% 较高，建议配置 5-10% 黄金/债券对冲尾部风险`,
        urgency: 'soon',
        confidence: 0.7,
        traceNodeId: 'max_drawdown',
      });
    }

    // 模式特定建议
    if (mode === 'rebalance_plan') {
      for (const sig of signals) {
        if (Math.abs(sig.positionDeviation) > 3 && !recs.find((r) => r.symbol === sig.symbol)) {
          recs.push({
            type: 'rebalance',
            symbol: sig.symbol,
            name: sig.name,
            reason: `再平衡：当前偏差 ${sig.positionDeviation.toFixed(1)}%，建议调至 Kelly 目标`,
            urgency: 'optional',
            targetWeight: sig.kellyPosition,
            confidence: 0.6,
            traceNodeId: `rebalance_${sig.symbol}`,
          });
        }
      }
    }

    // 按紧急度排序
    const urgencyOrder = { immediate: 0, soon: 1, optional: 2 };
    recs.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return recs;
  }

  // ─── Stage 3: Continuity + Validation + Output ─────────────────

  private buildDecisionTrace(
    gateCheck: GateCheck,
    signals: PositionSignal[],
    assessment: PortfolioAssessment,
  ): DecisionTrace {
    const nodes: DecisionNode[] = [];

    // Node 1: 数据门禁（locked）
    nodes.push({
      id: 'section_1_1',
      label: '数据充分性',
      authority: 'locked',
      programValue: gateCheck.result === 'proceed',
      finalValue: gateCheck.result === 'proceed',
      evidence: `${gateCheck.recordCount} 个持仓，覆盖 ${gateCheck.dataYearCoverage} 个市场`,
    });

    // Node 2: 市场诊断（locked）
    const bullishCount = signals.filter((s) => s.signal.direction === 'bullish').length;
    const bearishCount = signals.filter((s) => s.signal.direction === 'bearish').length;
    nodes.push({
      id: 'section_2_1',
      label: '市场情绪投票',
      authority: 'locked',
      programValue: { bullish: bullishCount, bearish: bearishCount, neutral: signals.length - bullishCount - bearishCount },
      finalValue: { bullish: bullishCount, bearish: bearishCount, neutral: signals.length - bullishCount - bearishCount },
      evidence: `${bullishCount} 看多 / ${bearishCount} 看空 / ${signals.length - bullishCount - bearishCount} 中性`,
    });

    // Node 3: 风险等级（overridable）
    nodes.push({
      id: 'section_3_1',
      label: '组合风险等级',
      authority: 'overridable',
      programValue: assessment.riskLevel,
      finalValue: assessment.riskLevel,
      evidence: `最大回撤 ${assessment.maxDrawdown.toFixed(1)}%, 夏普 ${assessment.sharpeRatio.toFixed(2)}, 分散度 ${(assessment.diversification * 100).toFixed(0)}%`,
    });

    // Node 4: 分散度评估（ai_primary）
    nodes.push({
      id: 'section_4_1',
      label: '分散度评估',
      authority: 'ai_primary',
      programValue: assessment.diversification,
      finalValue: assessment.diversification,
      evidence: `HHI=${(1 - assessment.diversification).toFixed(3)}, ${Object.keys(assessment.marketConcentration).length} 个市场`,
    });

    // Node 5: Kelly 仓位总览（locked）
    nodes.push({
      id: 'section_5_1',
      label: 'Kelly 仓位建议',
      authority: 'locked',
      programValue: signals.reduce((acc, s) => { acc[s.symbol] = s.kellyPosition; return acc; }, {} as Record<string, number>),
      finalValue: signals.reduce((acc, s) => { acc[s.symbol] = s.kellyPosition; return acc; }, {} as Record<string, number>),
      evidence: `基于 5-signal voting 的 Kelly 公式计算`,
    });

    return {
      nodes,
      dataSufficient: gateCheck.result === 'proceed',
      overallConfidence: this.calculateConfidence(gateCheck, { nodes, dataSufficient: true, overallConfidence: 0, timestamp: '' }, { valid: true, errors: [], errorCounts: { syntax: 0, missing_field: 0, invalid_value: 0, coherence: 0, semantic: 0 } }, { passed: true, contradictions: [], suggestion: 'proceed', hintForLLM: '' }),
      timestamp: new Date().toISOString(),
    };
  }

  private async runContinuityGuard(
    request: PortfolioAnalysisRequest,
    signals: PositionSignal[],
  ): Promise<ContinuityCheckResult> {
    // 查询历史分析记录
    try {
      const { data: lastAnalysis } = await request.db
        .from('investment_analyses')
        .select('id, created_at, recommendation')
        .eq('user_id', request.userId)
        .eq('analysis_type', 'portfolio_review')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastAnalysis) {
        const previousPlan: PreviousPlan = {
          id: lastAnalysis.id,
          userId: request.userId,
          timestamp: lastAnalysis.created_at,
          query: { score: 0, province: '', subjectType: '', year: 2025 },
          rush: [],
          stable: [],
          safe: [],
        };

        // 构造一个简化的 recommendation 用于连续性检查
        const mockRec = {
          rush: [],
          stable: signals.filter((s) => s.signal.tier === 'HOLD').map((s) => ({
            universityId: s.symbol,
            universityName: s.name,
            probability: 50,
          })),
          safe: [],
          query: { score: 0, province: '', subjectType: '', year: 2025 },
          rank: 0,
          currentScoreLine: 0,
          summary: { totalMatched: signals.length, dataYears: [], confidence: 'medium' },
        };

        return this.continuityGuard.check(mockRec as any, previousPlan);
      }
    } catch {
      // 无历史记录
    }

    return {
      passed: true,
      contradictions: [],
      suggestion: 'proceed',
      hintForLLM: '首次分析，无历史对比数据。',
    };
  }

  private validateOutput(
    signals: PositionSignal[],
    recommendations: AgentRecommendation[],
    trace: DecisionTrace,
  ): ValidationResult {
    const errors: any[] = [];

    // 检查信号一致性
    for (const sig of signals) {
      if (sig.signal.signalScore > 3 && sig.action === 'decrease') {
        errors.push({
          category: 'coherence',
          field: sig.symbol,
          message: `信号评分 +${sig.signal.signalScore} 但建议减仓`,
          severity: 'warning',
        });
      }
      if (sig.signal.signalScore < -3 && sig.action === 'increase') {
        errors.push({
          category: 'coherence',
          field: sig.symbol,
          message: `信号评分 ${sig.signal.signalScore} 但建议加仓`,
          severity: 'warning',
        });
      }
    }

    // 检查 Kelly 总仓位
    const totalKelly = signals.reduce((s, sig) => s + sig.kellyPosition, 0);
    if (totalKelly > 150) {
      errors.push({
        category: 'semantic',
        field: 'total_kelly',
        message: `Kelly 总仓位 ${totalKelly.toFixed(1)}% 超过 100%，可能需要降杠杆`,
        severity: 'warning',
      });
    }

    return {
      valid: errors.filter((e) => e.severity === 'error').length === 0,
      errors,
      errorCounts: { syntax: 0, missing_field: 0, invalid_value: 0, coherence: errors.filter((e) => e.category === 'coherence').length, semantic: errors.filter((e) => e.category === 'semantic').length },
    };
  }

  private applyContinuityFilter(
    recommendations: AgentRecommendation[],
    continuity: ContinuityCheckResult,
  ): AgentRecommendation[] {
    if (continuity.passed) return recommendations;

    // 如果连续性守卫阻止，过滤掉矛盾的建议
    const contradictionSymbols = new Set(
      continuity.contradictions
        .filter((c) => c.severity === 'critical')
        .flatMap((c) => c.universities)
    );

    return recommendations.filter((r) => !contradictionSymbols.has(r.symbol));
  }

  // ─── Confidence Calculation ─────────────────────────────────────

  private calculateConfidence(
    gateCheck: GateCheck,
    trace: DecisionTrace,
    validation: ValidationResult,
    continuity: ContinuityCheckResult,
  ): number {
    let confidence = 0.4; // 基线

    // 数据充分性 (+0.2)
    if (gateCheck.result === 'proceed') confidence += 0.2;

    // 决策节点完整性 (+0.15)
    const lockedNodes = trace.nodes.filter((n) => n.authority === 'locked');
    confidence += Math.min(0.15, lockedNodes.length * 0.03);

    // 验证通过 (+0.15)
    if (validation.valid) confidence += 0.15;

    // 连续性通过 (+0.1)
    if (continuity.passed) confidence += 0.1;

    return Math.min(1, Math.max(0, confidence));
  }

  // ─── Structured Prompt Builder ──────────────────────────────────

  private buildStructuredPrompt(
    mode: AnalysisMode,
    gateCheck: GateCheck,
    signals: PositionSignal[],
    assessment: PortfolioAssessment,
    recommendations: AgentRecommendation[],
    trace: DecisionTrace,
    continuity: ContinuityCheckResult,
  ): string {
    const lines: string[] = [];

    lines.push(`# PortfolioAgent 分析报告（${mode}）`);
    lines.push('');

    // 门禁结果
    lines.push(`## 1. 数据门禁: ${gateCheck.result === 'proceed' ? '✅ 通过' : '⚠️ ' + gateCheck.result}`);
    if (gateCheck.reasons.length > 0) {
      lines.push(`原因: ${gateCheck.reasons.join('; ')}`);
    }
    lines.push('');

    // 决策追踪
    lines.push('## 2. 决策追踪');
    for (const node of trace.nodes) {
      const auth = node.authority === 'locked' ? '🔒' : node.authority === 'overridable' ? '🔓' : '🤖';
      lines.push(`- ${auth} [${node.id}] ${node.label}: ${JSON.stringify(node.finalValue)}`);
      lines.push(`  依据: ${node.evidence}`);
    }
    lines.push('');

    // 个券信号
    lines.push('## 3. 个券信号分析');
    for (const sig of signals) {
      const scoreStr = sig.signal.signalScore > 0 ? `+${sig.signal.signalScore}` : `${sig.signal.signalScore}`;
      lines.push(`### ${sig.name}（${sig.symbol} / ${sig.market}）`);
      lines.push(`- 信号: ${sig.signal.direction}（${scoreStr}）| 操作: ${sig.signal.tier}`);
      lines.push(`- 置信度: ${(sig.signal.confidence * 100).toFixed(0)}%`);
      lines.push(`- Kelly 建议仓位: ${sig.kellyPosition.toFixed(1)}%`);
      lines.push(`- 5-signal: ${Object.entries(sig.signal.signals).map(([k, v]) => `${k}:${v > 0 ? '+' : ''}${v}`).join(' | ')}`);
      lines.push(`- 建议操作: ${this.actionLabel(sig.action)}`);
      lines.push('');
    }

    // 组合评估
    lines.push('## 4. 组合评估');
    lines.push(`- 总市值: ¥${assessment.totalValue.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`);
    lines.push(`- 总收益: ${assessment.totalReturn >= 0 ? '+' : ''}¥${assessment.totalReturn.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}（${assessment.returnPct >= 0 ? '+' : ''}${assessment.returnPct.toFixed(2)}%）`);
    lines.push(`- 夏普比率: ${assessment.sharpeRatio.toFixed(2)}`);
    lines.push(`- 最大回撤: ${assessment.maxDrawdown.toFixed(1)}%`);
    lines.push(`- 分散度: ${(assessment.diversification * 100).toFixed(0)}%`);
    lines.push(`- 风险等级: ${assessment.riskLevel}`);
    lines.push('');

    // 调仓建议
    lines.push('## 5. 调仓建议');
    if (recommendations.length === 0) {
      lines.push('_无需调仓，当前配置合理。_');
    } else {
      for (const rec of recommendations) {
        const urgencyBadge = rec.urgency === 'immediate' ? '🔴' : rec.urgency === 'soon' ? '🟡' : '🟢';
        lines.push(`${urgencyBadge} **${rec.type.toUpperCase()}** ${rec.name}（${rec.symbol}）`);
        lines.push(`  ${rec.reason}`);
        if (rec.targetWeight !== undefined) {
          lines.push(`  目标仓位: ${rec.targetWeight.toFixed(1)}%`);
        }
        lines.push(`  置信度: ${(rec.confidence * 100).toFixed(0)}% | 溯源: ${rec.traceNodeId}`);
        lines.push('');
      }
    }

    // 连续性守卫
    if (!continuity.passed || continuity.contradictions.length > 0) {
      lines.push('## 6. 连续性守卫');
      lines.push(`状态: ${continuity.passed ? '⚠️ 有警告' : '🚫 被阻止'}`);
      for (const c of continuity.contradictions) {
        lines.push(`- [${c.severity}] ${c.description}`);
      }
      lines.push('');
    }

    // 总体置信度
    lines.push(`## 总体置信度: ${(this.calculateConfidence(gateCheck, trace, { valid: true, errors: [], errorCounts: { syntax: 0, missing_field: 0, invalid_value: 0, coherence: 0, semantic: 0 } }, continuity) * 100).toFixed(0)}%`);

    return lines.join('\n');
  }

  // ─── Kelly Criterion ────────────────────────────────────────────

  private calculateKellyPosition(signal: InvestmentSignal): number {
    // Kelly 公式简化版: f* = (p*b - q) / b
    // p = 胜率（基于信号置信度）
    // b = 赔率（基于信号评分）
    // q = 1 - p

    const p = Math.min(0.9, Math.max(0.1, signal.confidence));
    const q = 1 - p;
    const b = Math.max(1, Math.abs(signal.signalScore) * 0.5 + 1); // 赔率

    const kelly = (p * b - q) / b;

    // Half-Kelly（保守版）并限制在 0-30%
    const halfKelly = kelly * 0.5;
    return Math.max(0, Math.min(30, halfKelly * 100));
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private async fetchPositions(request: PortfolioAnalysisRequest): Promise<PositionData[]> {
    try {
      const query = request.portfolioId
        ? request.db.from('positions').select('*').eq('portfolio_id', request.portfolioId).eq('user_id', request.userId)
        : request.db.from('positions').select('*').eq('user_id', request.userId).limit(50);

      const { data } = await query;
      return (data ?? []).map((p: any) => ({
        id: p.id,
        symbol: p.symbol,
        name: p.name,
        market: p.market,
        quantity: Number(p.quantity),
        avgCost: Number(p.avg_cost),
        currentPrice: Number(p.current_price),
        marketValue: Number(p.market_value),
        pnl: Number(p.unrealized_pnl),
        pnlPercent: Number(p.unrealized_pnl_pct),
        weight: Number(p.weight),
        aiSignal: p.ai_signal,
      }));
    } catch {
      return [];
    }
  }

  private buildShortCircuitResult(
    mode: AnalysisMode,
    gateCheck: GateCheck,
    timestamp: string,
  ): PortfolioAgentResult {
    return {
      mode,
      gateCheck,
      decisionTrace: { nodes: [], dataSufficient: false, overallConfidence: 0, timestamp },
      positionSignals: [],
      portfolioAssessment: {
        totalValue: 0, totalCost: 0, totalReturn: 0, returnPct: 0,
        sharpeRatio: 0, maxDrawdown: 0, diversification: 0, riskLevel: 'unknown',
        sectorConcentration: {}, marketConcentration: {},
      },
      recommendations: [],
      continuityCheck: { passed: true, contradictions: [], suggestion: 'proceed', hintForLLM: '数据不足，未触发连续性检查。' },
      validation: { valid: false, errors: [], errorCounts: { syntax: 0, missing_field: 0, invalid_value: 0, coherence: 0, semantic: 0 } },
      overallConfidence: 0,
      structuredPrompt: `# 分析中止\n\n数据门禁未通过：${gateCheck.reasons.join('; ')}\n\n请先添加持仓数据后再进行分析。`,
      behavioralBiases: [],
      matchedStrategies: [],
      timestamp,
    };
  }

  private actionLabel(action: PositionSignal['action']): string {
    switch (action) {
      case 'increase': return '📈 建议加仓';
      case 'decrease': return '📉 建议减仓';
      case 'close': return '🛑 建议清仓';
      case 'maintain': return '⏸️ 维持当前';
      default: return '➖ 无需操作';
    }
  }

  // ─── 投资行为学偏差检测（PA_Agent + 栀染知识库） ────────────────

  private detectBehavioralBiases(
    positions: PositionData[],
    signals: PositionSignal[],
  ): PortfolioAgentResult['behavioralBiases'] {
    // 构建 TradingContext 供 factor-library 检测
    const ctx: TradingContext = {
      recentTrades: [], // 暂无历史交易数据
      positions: positions.map((p) => ({
        symbol: p.symbol,
        pnl: p.pnl ?? 0,
        pnlPercent: p.pnlPercent ?? 0,
        holdingDays: 30, // 默认假设
        weight: p.weight ?? 0,
      })),
      returns: [], // 暂无历史收益序列
    };

    const detected = detectBehavioralBiases(ctx);
    return detected.map((item) => ({
      biasId: item.bias.id,
      biasName: item.bias.name,
      biasNameCN: item.bias.nameCN,
      severity: item.result.severity,
      evidence: item.result.evidence,
      mitigation: item.bias.mitigation,
    }));
  }

  // ─── 策略模板匹配（PA_Agent 策略路由） ─────────────────────────

  private matchStrategies(
    signals: PositionSignal[],
    assessment: PortfolioAssessment,
  ): PortfolioAgentResult['matchedStrategies'] {
    const matched: PortfolioAgentResult['matchedStrategies'] = [];

    // 判断市场环境
    const bullishCount = signals.filter((s) => s.signal.direction === 'bullish').length;
    const bearishCount = signals.filter((s) => s.signal.direction === 'bearish').length;
    const neutralCount = signals.length - bullishCount - bearishCount;

    let regime: 'trending' | 'ranging' | 'breakout' | 'reversal' | 'all_weather' = 'ranging';
    if (bullishCount > bearishCount + neutralCount) regime = 'trending';
    else if (bearishCount > bullishCount + neutralCount) regime = 'reversal';
    else if (assessment.diversification > 0.7) regime = 'all_weather';

    // 匹配策略模板
    for (const template of STRATEGY_TEMPLATES) {
      if (template.regime === regime || template.regime === 'all_weather') {
        matched.push({
          id: template.id,
          name: template.name,
          nameCN: template.nameCN,
          regime: template.regime,
          rules: template.rules,
          prohibitions: template.prohibitions,
        });
      }
    }

    return matched;
  }
}
