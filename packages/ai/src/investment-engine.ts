/**
 * @zhidu/ai — 投资分析引擎（PA_Agent 模式）
 *
 * 核心设计：
 * 1. Gate Check: 数据充分性验证（价格历史、基本面数据可用性）
 * 2. Multi-Signal Voting: 5 信号方向投票（技术趋势/动量/量能/波动率/情绪）
 * 3. Decision Nodes: locked/overridable/ai_primary 分级决策
 * 4. Factor Mining: 因子挖掘 DSL（12 市场特征 × 8 数学算子）
 * 5. Continuity Guard: 推荐连续性守卫（冷却期/止损失效/再平衡矛盾）
 * 6. DeFi Yield: AMM 流动性池 APY / 无常损失 / Gas 成本调整
 *
 * 数据来源：当前使用 Mock，结构支持接入真实行情 API
 */

// ─── Market Data Types ──────────────────────────────────────────────────────

export interface OHLCV {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataProvider {
  getOHLCV(symbol: string, market: string, range: string): Promise<OHLCV[]>;
  getSentiment?(symbol: string): Promise<{ score: number; sources: number }>;
  getDeFiPool?(address: string, chain: string): Promise<DeFiPoolData>;
}

// ─── Query Types ────────────────────────────────────────────────────────────

export interface AssetQuery {
  symbol: string;
  market: 'A股' | '港股' | '美股' | 'BTC' | 'ETH' | 'SOL' | 'DeFi' | 'other';
  timeRange?: '1w' | '1m' | '3m' | '6m' | '1y';
}

export interface StockScreenCriteria {
  market: 'A股' | '港股' | '美股';
  minMarketCap?: number;
  maxPE?: number;
  minROE?: number;
  sectors?: string[];
  limit?: number;
}

// ─── Signal Types ───────────────────────────────────────────────────────────

export interface InvestmentSignal {
  symbol: string;
  market: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  signalScore: number; // -5 to +5
  signals: Record<string, number>; // individual signal scores
  confidence: number; // 0-1
  tier: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  reasoning: string;
  timestamp: string;
}

// ─── Gate Check ─────────────────────────────────────────────────────────────

export interface InvestmentGateCheck {
  result: 'proceed' | 'wait' | 'insufficient_data';
  reasons: string[];
  dataPoints: number;
  dateRange: { from: string; to: string } | null;
}

// ─── Decision Trace ─────────────────────────────────────────────────────────

export type InvestmentNodeAuthority = 'locked' | 'overridable' | 'ai_primary';

export interface InvestmentDecisionNode<T = unknown> {
  id: string;
  label: string;
  authority: InvestmentNodeAuthority;
  programValue: T;
  aiValue?: T;
  overrideReason?: string;
  finalValue: T;
  evidence: string;
}

export interface InvestmentDecisionTrace {
  nodes: InvestmentDecisionNode[];
  dataSufficient: boolean;
  overallConfidence: number;
  timestamp: string;
}

// ─── Portfolio Analysis ─────────────────────────────────────────────────────

export interface PositionAnalysis {
  symbol: string;
  name: string;
  market: string;
  weight: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  signal: InvestmentSignal | null;
  contribution: number; // 对组合收益的贡献度
}

export interface PortfolioRecommendation {
  type: 'rebalance' | 'add' | 'reduce' | 'close' | 'hedge';
  symbol: string;
  name: string;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  expectedImpact: string;
}

export interface PortfolioAnalysis {
  totalValue: number;
  totalReturn: number;
  returnPct: number;
  sharpeRatio: number;
  maxDrawdown: number;
  diversification: number; // 0-1 Herfindahl index inverse
  riskLevel: 'conservative' | 'balanced' | 'aggressive' | 'extreme';
  positions: PositionAnalysis[];
  recommendations: PortfolioRecommendation[];
  gateCheck: InvestmentGateCheck;
  decisionTrace: InvestmentDecisionTrace;
}

// ─── Factor Mining ──────────────────────────────────────────────────────────

export type MathOperator =
  | 'add' | 'sub' | 'mul' | 'div'
  | 'rank' | 'zscore' | 'ema' | 'std';

export type MarketFeature =
  | 'close' | 'open' | 'high' | 'low'
  | 'volume' | 'returns' | 'log_returns'
  | 'high_low_range' | 'close_open_range'
  | 'volume_change' | 'price_momentum' | 'volatility';

export interface Factor {
  id: string;
  name: string;
  feature1: MarketFeature;
  feature2: MarketFeature;
  operator: MathOperator;
  /** 回测评估指标 */
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  /** 因子值序列 */
  values: number[];
}

// ─── DeFi Yield ─────────────────────────────────────────────────────────────

export interface DeFiPoolData {
  address: string;
  chain: string;
  token0: string;
  token1: string;
  tvl: number;
  volume24h: number;
  feeTier: number; // e.g. 0.003 for 0.3%
  apr: number; // base APR from fees
  rewardApr: number; // additional reward APR
}

export interface DeFiYieldAnalysis {
  pool: DeFiPoolData;
  grossApy: number;
  impermanentLossEst: number; // estimated annual IL %
  gasCostAnnual: number; // estimated gas cost as % of investment
  netApy: number;
  riskFactors: string[];
  recommendation: 'favorable' | 'neutral' | 'unfavorable';
  reasoning: string;
}

// ─── Continuity Guard (Investment) ─────────────────────────────────────────

export interface PreviousRecommendation {
  symbol: string;
  market: string;
  tier: InvestmentSignal['tier'];
  timestamp: string;
  stopLoss?: number;
}

export interface InvestmentContinuityResult {
  passed: boolean;
  contradictions: InvestmentContradiction[];
  suggestion: 'proceed' | 'warn' | 'block';
  hintForLLM: string;
}

export interface InvestmentContradiction {
  type: 'signal_flip' | 'stoploss_invalidated' | 'rebalance_contradiction';
  description: string;
  severity: 'info' | 'warning' | 'critical';
  symbols: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** 信号投票阈值: >= +3 bullish, <= -3 bearish */
const BULLISH_THRESHOLD = 3;
const BEARISH_THRESHOLD = -3;

/** 推荐翻转冷却期（毫秒） */
const FLIP_COOLDOWN_MS = 60 * 60 * 1000; // 1 小时

/** Kelly 系数上限 */
const MAX_KELLY_FRACTION = 0.25;

/** 最大回撤限制 */
const MAX_DRAWDOWN_LIMIT = 0.30;

// ─── Mock Data Provider ─────────────────────────────────────────────────────

/**
 * Mock 行情数据提供者
 * 生产环境替换为真实 API（如 Tushare / Yahoo Finance / CoinGecko）
 */
class MockMarketDataProvider implements MarketDataProvider {
  async getOHLCV(symbol: string, _market: string, range: string): Promise<OHLCV[]> {
    const days = this.rangeToDays(range);
    const bars: OHLCV[] = [];
    let price = this.seedPrice(symbol);

    for (let i = days; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000);
      const change = (this.pseudoRandom(symbol, i) - 0.48) * 0.04;
      price = price * (1 + change);
      const high = price * (1 + Math.abs(change) * 0.5);
      const low = price * (1 - Math.abs(change) * 0.5);
      const volume = Math.round(1_000_000 * (0.5 + this.pseudoRandom(symbol, i + 1000)));

      bars.push({
        timestamp: date.toISOString(),
        open: +(price * (1 - change * 0.3)).toFixed(2),
        high: +high.toFixed(2),
        low: +low.toFixed(2),
        close: +price.toFixed(2),
        volume,
      });
    }
    return bars;
  }

  async getSentiment(symbol: string): Promise<{ score: number; sources: number }> {
    const r = this.pseudoRandom(symbol, 42);
    return {
      score: +(r * 2 - 1).toFixed(2), // -1 to +1
      sources: Math.round(r * 50 + 10),
    };
  }

  async getDeFiPool(address: string, chain: string): Promise<DeFiPoolData> {
    const r = this.pseudoRandom(address, 7);
    return {
      address,
      chain,
      token0: 'ETH',
      token1: 'USDC',
      tvl: Math.round(r * 50_000_000 + 5_000_000),
      volume24h: Math.round(r * 10_000_000 + 500_000),
      feeTier: 0.003,
      apr: +(r * 15 + 2).toFixed(2),
      rewardApr: +(r * 5).toFixed(2),
    };
  }

  private rangeToDays(range: string): number {
    switch (range) {
      case '1w': return 7;
      case '1m': return 30;
      case '3m': return 90;
      case '6m': return 180;
      case '1y': return 365;
      default: return 90;
    }
  }

  private seedPrice(symbol: string): number {
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = ((hash << 5) - hash + symbol.charCodeAt(i)) | 0;
    }
    return Math.abs(hash % 500) + 10;
  }

  private pseudoRandom(seed: string, index: number): number {
    let hash = index;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    return ((hash & 0x7fffffff) % 10000) / 10000;
  }
}

// ─── Technical Indicators ───────────────────────────────────────────────────

function calcSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

function calcEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let prev = data[0];
  result.push(prev);
  for (let i = 1; i < data.length; i++) {
    const val = data[i] * k + prev * (1 - k);
    result.push(val);
    prev = val;
  }
  return result;
}

function calcRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  const recent = changes.slice(-period);
  const gains = recent.filter((c) => c > 0);
  const losses = recent.filter((c) => c < 0).map((c) => Math.abs(c));
  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0.001;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(2);
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine.slice(-9), 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  return { macd, signal, histogram: +(macd - signal).toFixed(4) };
}

function calcOBV(bars: OHLCV[]): number[] {
  const obv: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].close > bars[i - 1].close) {
      obv.push(obv[i - 1] + bars[i].volume);
    } else if (bars[i].close < bars[i - 1].close) {
      obv.push(obv[i - 1] - bars[i].volume);
    } else {
      obv.push(obv[i - 1]);
    }
  }
  return obv;
}

function calcATR(bars: OHLCV[], period: number = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    );
    trs.push(tr);
  }
  if (trs.length < period) return trs.length > 0 ? trs.reduce((a, b) => a + b, 0) / trs.length : 0;
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcBollingerWidth(closes: number[], period: number = 20): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return sma > 0 ? (4 * std) / sma : 0; // width as % of SMA
}

function calcSharpeRatio(returns: number[], riskFreeRate: number = 0.03): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return +((mean - riskFreeRate / 252) / std * Math.sqrt(252)).toFixed(2);
}

function calcMaxDrawdown(values: number[]): number {
  if (values.length < 2) return 0;
  let peak = values[0];
  let maxDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  return +maxDd.toFixed(4);
}

function calcHerfindahl(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return 1;
  const normalized = weights.map((w) => w / total);
  const hhi = normalized.reduce((s, w) => s + w * w, 0);
  return +(1 - hhi).toFixed(4); // inverse: 1 = max diversification
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class InvestmentAnalysisEngine {
  private provider: MarketDataProvider;
  private previousRecommendations: Map<string, PreviousRecommendation[]> = new Map();

  constructor(provider?: MarketDataProvider) {
    this.provider = provider ?? new MockMarketDataProvider();
  }

  // ─── Public: analyzeAsset ───────────────────────────────────────────

  /**
   * 分析单个资产，生成投资信号
   * 流程: Gate Check → 5-Signal Voting → Decision Nodes → Continuity Guard
   */
  async analyzeAsset(query: AssetQuery): Promise<InvestmentSignal> {
    const { symbol, market, timeRange = '3m' } = query;

    // Step 1: 获取行情数据
    const bars = await this.provider.getOHLCV(symbol, market, timeRange);
    const closes = bars.map((b) => b.close);

    // Step 2: Gate Check
    const gate = this.runGateCheck(bars);
    if (gate.result === 'insufficient_data') {
      return this.buildNeutralSignal(symbol, market, gate.reasons.join('; '));
    }

    // Step 3: 5-Signal Voting
    const signalScores = this.computeSignalScores(bars, closes);
    const totalScore = Object.values(signalScores).reduce((a, b) => a + b, 0);

    // Step 4: Determine direction & tier
    let direction: InvestmentSignal['direction'];
    let tier: InvestmentSignal['tier'];

    if (totalScore >= BULLISH_THRESHOLD) {
      direction = 'bullish';
      tier = totalScore >= 4 ? 'STRONG_BUY' : 'BUY';
    } else if (totalScore <= BEARISH_THRESHOLD) {
      direction = 'bearish';
      tier = totalScore <= -4 ? 'STRONG_SELL' : 'SELL';
    } else {
      direction = 'neutral';
      tier = 'HOLD';
    }

    // Step 5: Confidence calculation
    const signalAgreement = this.calcSignalAgreement(signalScores);
    const dataConfidence = Math.min(1, bars.length / 120); // 120 bars = full confidence
    const confidence = +((signalAgreement * 0.6 + dataConfidence * 0.4)).toFixed(2);

    // Step 6: Build reasoning
    const reasoning = this.buildReasoning(symbol, signalScores, totalScore, direction);

    // Step 7: Continuity Guard
    const continuityKey = `${symbol}:${market}`;
    const continuityResult = this.checkContinuity(
      continuityKey,
      { symbol, market, tier, timestamp: new Date().toISOString() },
    );

    if (!continuityResult.passed && continuityResult.suggestion === 'block') {
      // 降级为 HOLD
      tier = 'HOLD';
      direction = 'neutral';
    }

    // Step 8: Store recommendation
    this.storeRecommendation(continuityKey, {
      symbol,
      market,
      tier,
      timestamp: new Date().toISOString(),
    });

    return {
      symbol,
      market,
      direction,
      signalScore: +totalScore.toFixed(2),
      signals: signalScores,
      confidence,
      tier,
      reasoning: continuityResult.passed
        ? reasoning
        : `${reasoning}\n[连续性守卫] ${continuityResult.hintForLLM}`,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Public: analyzePortfolio ───────────────────────────────────────

  /**
   * 分析投资组合：汇总持仓信号 + 组合级指标 + 再平衡建议
   */
  async analyzePortfolio(
    portfolioId: string,
    _userId: string,
    positions?: Array<{
      symbol: string;
      name: string;
      market: string;
      quantity: number;
      avgCost: number;
      currentPrice: number;
      marketValue: number;
    }>,
  ): Promise<PortfolioAnalysis> {
    // 使用传入的持仓数据或 Mock
    const posData = positions ?? this.mockPortfolioPositions();

    // Step 1: 逐个分析持仓
    const positionAnalyses: PositionAnalysis[] = [];
    const weights: number[] = [];
    const totalValue = posData.reduce((s, p) => s + p.marketValue, 0);

    for (const pos of posData) {
      const signal = await this.analyzeAsset({
        symbol: pos.symbol,
        market: pos.market as AssetQuery['market'],
        timeRange: '3m',
      });

      const weight = totalValue > 0 ? pos.marketValue / totalValue : 0;
      weights.push(weight);

      const unrealizedPnl = (pos.currentPrice - pos.avgCost) * pos.quantity;
      const unrealizedPnlPct = pos.avgCost > 0
        ? +((pos.currentPrice - pos.avgCost) / pos.avgCost * 100).toFixed(2)
        : 0;

      positionAnalyses.push({
        symbol: pos.symbol,
        name: pos.name,
        market: pos.market,
        weight: +weight.toFixed(4),
        marketValue: pos.marketValue,
        unrealizedPnl: +unrealizedPnl.toFixed(2),
        unrealizedPnlPct,
        signal,
        contribution: +(unrealizedPnl / (totalValue || 1) * 100).toFixed(2),
      });
    }

    // Step 2: 组合级指标
    const totalCost = posData.reduce((s, p) => s + p.avgCost * p.quantity, 0);
    const totalReturn = totalValue - totalCost;
    const returnPct = totalCost > 0 ? +(totalReturn / totalCost * 100).toFixed(2) : 0;
    const diversification = calcHerfindahl(weights);

    // Mock daily returns for Sharpe / drawdown
    const mockDailyReturns = this.generateMockReturns(posData, 252);
    const sharpeRatio = calcSharpeRatio(mockDailyReturns);
    const cumulativeValues = this.toCumulative(mockDailyReturns, totalValue);
    const maxDrawdown = calcMaxDrawdown(cumulativeValues);

    // Step 3: 风险等级判定（locked 决策节点）
    const riskLevel = this.assessRiskLevel(maxDrawdown, diversification, positionAnalyses);

    // Step 4: 生成再平衡建议
    const recommendations = this.generateRecommendations(positionAnalyses, weights, riskLevel);

    // Step 5: Gate Check
    const gateCheck: InvestmentGateCheck = {
      result: posData.length >= 3 ? 'proceed' : posData.length >= 1 ? 'wait' : 'insufficient_data',
      reasons: posData.length < 3 ? [`持仓数量 ${posData.length}，建议至少 3 个标的`] : [],
      dataPoints: posData.length,
      dateRange: null,
    };

    // Step 6: Decision Trace
    const decisionTrace = this.buildPortfolioDecisionTrace(
      positionAnalyses,
      { totalValue, totalReturn, returnPct, sharpeRatio, maxDrawdown, diversification, riskLevel },
      gateCheck,
    );

    return {
      totalValue: +totalValue.toFixed(2),
      totalReturn: +totalReturn.toFixed(2),
      returnPct,
      sharpeRatio,
      maxDrawdown,
      diversification,
      riskLevel,
      positions: positionAnalyses,
      recommendations,
      gateCheck,
      decisionTrace,
    };
  }

  // ─── Public: screenStocks ───────────────────────────────────────────

  /**
   * 选股筛选器：对一组候选标的进行信号评分排序
   */
  async screenStocks(criteria: StockScreenCriteria): Promise<InvestmentSignal[]> {
    // Mock 候选池（生产环境从数据库 / API 获取）
    const candidates = this.mockStockCandidates(criteria);
    const signals: InvestmentSignal[] = [];

    for (const candidate of candidates) {
      const signal = await this.analyzeAsset({
        symbol: candidate.symbol,
        market: criteria.market,
        timeRange: '3m',
      });
      signals.push(signal);
    }

    // 按 signalScore 降序排列
    signals.sort((a, b) => b.signalScore - a.signalScore);
    return signals.slice(0, criteria.limit ?? 20);
  }

  // ─── Public: analyzeDefiYield ───────────────────────────────────────

  /**
   * DeFi 流动性池收益分析
   * 计算: Gross APY - 无常损失 - Gas 成本 = Net APY
   */
  async analyzeDefiYield(
    poolAddress: string,
    chain: string,
    investmentAmount: number = 10000,
  ): Promise<DeFiYieldAnalysis> {
    const pool = await this.provider.getDeFiPool!(poolAddress, chain);

    // Gross APY = base APR + reward APR (compounded)
    const grossApy = +((1 + (pool.apr + pool.rewardApr) / 365) ** 365 - 1).toFixed(2);

    // 无常损失估算（基于历史波动率假设）
    // IL ≈ 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
    // 简化为: 假设年化价格偏移 ±30%，IL ≈ 1.2% for stable pairs, 4-8% for volatile
    const isStablePair = this.isStablePair(pool.token0, pool.token1);
    const impermanentLossEst = isStablePair
      ? +(Math.random() * 0.5 + 0.3).toFixed(2)  // 0.3-0.8%
      : +(Math.random() * 4 + 2).toFixed(2);       // 2-6%

    // Gas 成本估算（按链）
    const gasCostAnnual = this.estimateGasCost(chain, investmentAmount);

    // Net APY
    const netApy = +(grossApy - impermanentLossEst - gasCostAnnual).toFixed(2);

    // 风险因素
    const riskFactors: string[] = [];
    if (pool.tvl < 10_000_000) riskFactors.push('TVL 较低（< $10M），流动性风险');
    if (pool.rewardApr > pool.apr) riskFactors.push('奖励 APR 高于手续费 APR，可能存在代币抛压');
    if (grossApy > 50) riskFactors.push('APY 异常高（> 50%），可能存在高通胀代币激励');
    if (!isStablePair) riskFactors.push('非稳定币对，无常损失风险较高');
    if (chain === 'SOL') riskFactors.push('Solana 链上 MEV 风险');

    let recommendation: DeFiYieldAnalysis['recommendation'];
    if (netApy > 10 && riskFactors.length <= 1) {
      recommendation = 'favorable';
    } else if (netApy > 3 && riskFactors.length <= 2) {
      recommendation = 'neutral';
    } else {
      recommendation = 'unfavorable';
    }

    const reasoning = [
      `${pool.token0}/${pool.token1} 池 Gross APY ${grossApy}%，`,
      `扣除无常损失 ${impermanentLossEst}% 和 Gas ${gasCostAnnual}% 后 Net APY ${netApy}%。`,
      riskFactors.length > 0 ? `风险因素: ${riskFactors.join('; ')}` : '无明显风险因素。',
    ].join('');

    return {
      pool,
      grossApy,
      impermanentLossEst,
      gasCostAnnual,
      netApy,
      riskFactors,
      recommendation,
      reasoning,
    };
  }

  // ─── Public: mineFactors ────────────────────────────────────────────

  /**
   * 因子挖掘：组合 12 市场特征 × 8 数学算子 = 96 因子空间
   * 评估指标: Sharpe / Max Drawdown / Win Rate
   * 返回 Top-N 因子
   */
  async mineFactors(
    symbol: string,
    market: string,
    topN: number = 10,
  ): Promise<Factor[]> {
    const bars = await this.provider.getOHLCV(symbol, market, '1y');
    const closes = bars.map((b) => b.close);
    const volumes = bars.map((b) => b.volume);

    // 提取 12 市场特征序列
    const features = this.extractFeatures(bars);

    // 生成因子组合
    const featureNames = Object.keys(features) as MarketFeature[];
    const operators: MathOperator[] = ['add', 'sub', 'mul', 'div', 'rank', 'zscore', 'ema', 'std'];
    const factors: Factor[] = [];

    for (const f1 of featureNames) {
      for (const f2 of featureNames) {
        if (f1 === f2) continue;
        for (const op of operators) {
          const values = this.applyOperator(features[f1], features[f2], op);
          if (values.length < 20) continue;

          // 回测评估（简化版：按因子值排序做多的 Sharpe）
          const returns = this.backtestFactor(values, closes);
          const sharpe = calcSharpeRatio(returns);
          const maxDd = calcMaxDrawdown(this.toCumulative(returns, 1));
          const winRate = +(returns.filter((r) => r > 0).length / (returns.length || 1) * 100).toFixed(1);

          factors.push({
            id: `${f1}_${op}_${f2}`,
            name: `${op}(${f1}, ${f2})`,
            feature1: f1,
            feature2: f2,
            operator: op,
            sharpe,
            maxDrawdown: maxDd,
            winRate,
            values: values.slice(-30), // 最近 30 个值
          });
        }
      }
    }

    // 按 Sharpe 降序
    factors.sort((a, b) => b.sharpe - a.sharpe);
    return factors.slice(0, topN);
  }

  // ─── Private: 5-Signal Voting ───────────────────────────────────────

  /**
   * 计算 5 个独立信号，每个返回 -1 到 +1 的分数
   */
  private computeSignalScores(bars: OHLCV[], closes: number[]): Record<string, number> {
    const signals: Record<string, number> = {};

    // S1: Technical Trend — MA crossover + EMA slope
    signals['technical_trend'] = this.signalTechnicalTrend(closes);

    // S2: Momentum — RSI + MACD histogram direction
    signals['momentum'] = this.signalMomentum(closes);

    // S3: Volume Profile — OBV trend + volume-price divergence
    signals['volume_profile'] = this.signalVolumeProfile(bars);

    // S4: Volatility Regime — ATR percentile + Bollinger width
    signals['volatility_regime'] = this.signalVolatility(bars, closes);

    // S5: Sentiment Factor — news sentiment score (if available)
    signals['sentiment'] = this.signalSentiment(bars);

    return signals;
  }

  /** S1: 技术趋势信号 (MA 交叉 + EMA 斜率) */
  private signalTechnicalTrend(closes: number[]): number {
    if (closes.length < 50) return 0;
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    const ema10 = calcEMA(closes, 10);

    const last = closes.length - 1;
    const maCrossSignal = sma20[last] > sma50[last] ? 0.5 : -0.5;

    // EMA slope: 最近 5 天 EMA 斜率
    const recentEma = ema10.slice(-5);
    const slope = (recentEma[recentEma.length - 1] - recentEma[0]) / recentEma[0];
    const slopeSignal = Math.max(-0.5, Math.min(0.5, slope * 20));

    return +(maCrossSignal + slopeSignal).toFixed(2);
  }

  /** S2: 动量信号 (RSI + MACD) */
  private signalMomentum(closes: number[]): number {
    const rsi = calcRSI(closes);
    const macd = calcMACD(closes);

    // RSI: >70 bearish, <30 bullish (contrarian short-term)
    let rsiSignal = 0;
    if (rsi > 70) rsiSignal = -0.3;
    else if (rsi < 30) rsiSignal = 0.3;
    else if (rsi > 55) rsiSignal = 0.2;
    else if (rsi < 45) rsiSignal = -0.2;

    // MACD histogram direction
    const macdSignal = macd.histogram > 0 ? 0.4 : -0.4;

    return +(rsiSignal + macdSignal).toFixed(2);
  }

  /** S3: 量能信号 (OBV 趋势 + 量价背离) */
  private signalVolumeProfile(bars: OHLCV[]): number {
    if (bars.length < 20) return 0;
    const obv = calcOBV(bars);
    const recentObv = obv.slice(-10);
    const obvSlope = (recentObv[recentObv.length - 1] - recentObv[0]) /
      (Math.abs(recentObv[0]) || 1);

    // OBV 上升趋势 → 正向
    const obvSignal = Math.max(-0.5, Math.min(0.5, obvSlope * 10));

    // 量价背离检测
    const recentCloses = bars.slice(-10).map((b) => b.close);
    const priceUp = recentCloses[recentCloses.length - 1] > recentCloses[0];
    const obvUp = recentObv[recentObv.length - 1] > recentObv[0];
    const divergence = (priceUp && !obvUp) ? -0.3 : (!priceUp && obvUp) ? 0.3 : 0;

    return +(obvSignal + divergence).toFixed(2);
  }

  /** S4: 波动率信号 (ATR 百分位 + Bollinger 宽度) */
  private signalVolatility(bars: OHLCV[], closes: number[]): number {
    const atr = calcATR(bars);
    const currentPrice = closes[closes.length - 1];
    const atrPct = currentPrice > 0 ? atr / currentPrice : 0;

    // ATR 百分位（相对于自身历史）
    // 高波动 → 风险信号（负向）
    const atrSignal = atrPct > 0.03 ? -0.4 : atrPct > 0.02 ? -0.1 : 0.2;

    // Bollinger Width
    const bw = calcBollingerWidth(closes);
    // 窄幅 → 蓄势（略正向），宽幅 → 趋势可能结束
    const bwSignal = bw < 0.05 ? 0.2 : bw > 0.15 ? -0.2 : 0;

    return +(atrSignal + bwSignal).toFixed(2);
  }

  /** S5: 情绪信号（Mock 或真实 sentiment API） */
  private signalSentiment(_bars: OHLCV[]): number {
    // Mock: 使用确定性伪随机
    // 生产环境: await this.provider.getSentiment(symbol)
    return 0; // 默认为 0，当 sentiment 数据不可用时不影响投票
  }

  // ─── Private: Gate Check ────────────────────────────────────────────

  private runGateCheck(bars: OHLCV[]): InvestmentGateCheck {
    const reasons: string[] = [];

    if (bars.length < 20) {
      reasons.push(`行情数据仅 ${bars.length} 条，至少需要 20 条`);
    }
    if (bars.length < 50) {
      reasons.push(`数据不足以计算 MA50 等技术指标`);
    }

    // 检查数据连续性（缺失日期）
    const gaps = this.detectDataGaps(bars);
    if (gaps > 5) {
      reasons.push(`检测到 ${gaps} 个数据缺失点`);
    }

    // 检查价格合理性
    const lastClose = bars.length > 0 ? bars[bars.length - 1].close : 0;
    if (lastClose <= 0) {
      reasons.push('最新收盘价为 0 或负值');
    }

    let result: InvestmentGateCheck['result'];
    if (reasons.length >= 2) {
      result = 'insufficient_data';
    } else if (reasons.length === 1) {
      result = 'wait';
    } else {
      result = 'proceed';
    }

    return {
      result,
      reasons,
      dataPoints: bars.length,
      dateRange: bars.length >= 2
        ? { from: bars[0].timestamp, to: bars[bars.length - 1].timestamp }
        : null,
    };
  }

  private detectDataGaps(bars: OHLCV[]): number {
    let gaps = 0;
    for (let i = 1; i < bars.length; i++) {
      const diff = new Date(bars[i].timestamp).getTime() - new Date(bars[i - 1].timestamp).getTime();
      if (diff > 86400000 * 3) gaps++; // > 3 days gap
    }
    return gaps;
  }

  // ─── Private: Decision Trace ────────────────────────────────────────

  private buildPortfolioDecisionTrace(
    positions: PositionAnalysis[],
    metrics: {
      totalValue: number;
      totalReturn: number;
      returnPct: number;
      sharpeRatio: number;
      maxDrawdown: number;
      diversification: number;
      riskLevel: string;
    },
    gateCheck: InvestmentGateCheck,
  ): InvestmentDecisionTrace {
    const nodes: InvestmentDecisionNode[] = [];

    // Node 1: 数据充分性（locked）
    nodes.push({
      id: 'inv_gate_1',
      label: '数据充分性检查',
      authority: 'locked',
      programValue: gateCheck.result === 'proceed',
      finalValue: gateCheck.result === 'proceed',
      evidence: `${gateCheck.dataPoints} 个持仓数据点`,
    });

    // Node 2: 仓位集中度（locked — Kelly criterion 上限）
    const maxWeight = Math.max(...positions.map((p) => p.weight), 0);
    const kellyLimit = MAX_KELLY_FRACTION;
    nodes.push({
      id: 'inv_position_sizing',
      label: '仓位集中度 (Kelly)',
      authority: 'locked',
      programValue: { maxWeight, kellyLimit, withinLimit: maxWeight <= kellyLimit },
      finalValue: { maxWeight, kellyLimit, withinLimit: maxWeight <= kellyLimit },
      evidence: `最大持仓占比 ${(maxWeight * 100).toFixed(1)}%，Kelly 上限 ${(kellyLimit * 100).toFixed(0)}%`,
    });

    // Node 3: 最大回撤（locked）
    nodes.push({
      id: 'inv_max_drawdown',
      label: '最大回撤限制',
      authority: 'locked',
      programValue: {
        maxDrawdown: metrics.maxDrawdown,
        limit: MAX_DRAWDOWN_LIMIT,
        withinLimit: metrics.maxDrawdown <= MAX_DRAWDOWN_LIMIT,
      },
      finalValue: {
        maxDrawdown: metrics.maxDrawdown,
        limit: MAX_DRAWDOWN_LIMIT,
        withinLimit: metrics.maxDrawdown <= MAX_DRAWDOWN_LIMIT,
      },
      evidence: `组合最大回撤 ${(metrics.maxDrawdown * 100).toFixed(1)}%，限制 ${(MAX_DRAWDOWN_LIMIT * 100).toFixed(0)}%`,
    });

    // Node 4: 相关性矩阵（locked）
    nodes.push({
      id: 'inv_correlation',
      label: '持仓相关性',
      authority: 'locked',
      programValue: { diversification: metrics.diversification },
      finalValue: { diversification: metrics.diversification },
      evidence: `Herfindahl 分散度 ${metrics.diversification}（1=完全分散）`,
    });

    // Node 5: 行业配置（overridable）
    const sectorWeights = this.calcSectorWeights(positions);
    nodes.push({
      id: 'inv_sector_alloc',
      label: '行业配置目标',
      authority: 'overridable',
      programValue: sectorWeights,
      finalValue: sectorWeights,
      evidence: `${Object.keys(sectorWeights).length} 个行业/板块`,
    });

    // Node 6: 入场/出场信号（overridable）
    const entryExitSignals = positions.map((p) => ({
      symbol: p.symbol,
      signal: p.signal?.tier ?? 'HOLD',
      confidence: p.signal?.confidence ?? 0,
    }));
    nodes.push({
      id: 'inv_entry_exit',
      label: '入场/出场信号',
      authority: 'overridable',
      programValue: entryExitSignals,
      finalValue: entryExitSignals,
      evidence: `${positions.length} 个持仓信号`,
    });

    // Node 7: 市场评论（ai_primary）
    nodes.push({
      id: 'inv_market_commentary',
      label: '市场评论与宏观分析',
      authority: 'ai_primary',
      programValue: {
        riskLevel: metrics.riskLevel,
        returnPct: metrics.returnPct,
        sharpeRatio: metrics.sharpeRatio,
      },
      finalValue: {
        riskLevel: metrics.riskLevel,
        returnPct: metrics.returnPct,
        sharpeRatio: metrics.sharpeRatio,
      },
      evidence: `风险等级 ${metrics.riskLevel}，收益率 ${metrics.returnPct}%`,
    });

    const overallConfidence = this.calcPortfolioConfidence(positions, gateCheck);

    return {
      nodes,
      dataSufficient: gateCheck.result === 'proceed',
      overallConfidence,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Private: Continuity Guard ──────────────────────────────────────

  private checkContinuity(
    key: string,
    current: PreviousRecommendation,
  ): InvestmentContinuityResult {
    const previous = this.previousRecommendations.get(key);
    if (!previous || previous.length === 0) {
      return {
        passed: true,
        contradictions: [],
        suggestion: 'proceed',
        hintForLLM: `${current.symbol} 首次分析，无历史推荐记录。`,
      };
    }

    const last = previous[previous.length - 1];
    const contradictions: InvestmentContradiction[] = [];

    // 检查 1: 信号翻转冷却期
    const timeSinceLast = Date.now() - new Date(last.timestamp).getTime();
    if (timeSinceLast < FLIP_COOLDOWN_MS) {
      const isFlip = this.isSignalFlip(last.tier, current.tier);
      if (isFlip) {
        contradictions.push({
          type: 'signal_flip',
          description: `${current.symbol} 在冷却期内从 ${last.tier} 翻转为 ${current.tier}`,
          severity: 'critical',
          symbols: [current.symbol],
        });
      }
    }

    // 检查 2: 止损失效
    if (last.stopLoss && current.tier === 'STRONG_BUY') {
      contradictions.push({
        type: 'stoploss_invalidated',
        description: `${current.symbol} 之前设止损 ${last.stopLoss}，但现在信号为强烈买入`,
        severity: 'warning',
        symbols: [current.symbol],
      });
    }

    const hasCritical = contradictions.some((c) => c.severity === 'critical');
    const suggestion: InvestmentContinuityResult['suggestion'] =
      hasCritical ? 'block' : contradictions.length > 0 ? 'warn' : 'proceed';

    return {
      passed: !hasCritical,
      contradictions,
      suggestion,
      hintForLLM: contradictions.length > 0
        ? contradictions.map((c) => c.description).join('; ')
        : `${current.symbol} 推荐与上次一致，无矛盾。`,
    };
  }

  private isSignalFlip(prev: string, curr: string): boolean {
    const bullish = ['STRONG_BUY', 'BUY'];
    const bearish = ['STRONG_SELL', 'SELL'];
    return (
      (bullish.includes(prev) && bearish.includes(curr)) ||
      (bearish.includes(prev) && bullish.includes(curr))
    );
  }

  private storeRecommendation(key: string, rec: PreviousRecommendation): void {
    if (!this.previousRecommendations.has(key)) {
      this.previousRecommendations.set(key, []);
    }
    const list = this.previousRecommendations.get(key)!;
    list.push(rec);
    // 只保留最近 50 条
    if (list.length > 50) list.splice(0, list.length - 50);
  }

  // ─── Private: Risk Assessment ───────────────────────────────────────

  private assessRiskLevel(
    maxDrawdown: number,
    diversification: number,
    positions: PositionAnalysis[],
  ): PortfolioAnalysis['riskLevel'] {
    let score = 0;

    // 回撤越大，风险越高
    if (maxDrawdown > 0.25) score += 3;
    else if (maxDrawdown > 0.15) score += 2;
    else if (maxDrawdown > 0.08) score += 1;

    // 分散度越低，风险越高
    if (diversification < 0.3) score += 2;
    else if (diversification < 0.5) score += 1;

    // 加密资产占比
    const cryptoWeight = positions
      .filter((p) => ['BTC', 'ETH', 'SOL', 'DeFi'].includes(p.market))
      .reduce((s, p) => s + p.weight, 0);
    if (cryptoWeight > 0.5) score += 2;
    else if (cryptoWeight > 0.2) score += 1;

    // 单只持仓集中度
    const maxWeight = Math.max(...positions.map((p) => p.weight), 0);
    if (maxWeight > 0.4) score += 2;
    else if (maxWeight > 0.25) score += 1;

    if (score >= 7) return 'extreme';
    if (score >= 4) return 'aggressive';
    if (score >= 2) return 'balanced';
    return 'conservative';
  }

  // ─── Private: Portfolio Recommendations ─────────────────────────────

  private generateRecommendations(
    positions: PositionAnalysis[],
    _weights: number[],
    riskLevel: PortfolioAnalysis['riskLevel'],
  ): PortfolioRecommendation[] {
    const recs: PortfolioRecommendation[] = [];

    for (const pos of positions) {
      // 强信号卖出
      if (pos.signal?.tier === 'STRONG_SELL') {
        recs.push({
          type: 'close',
          symbol: pos.symbol,
          name: pos.name,
          reason: `技术信号强烈看空 (${pos.signal.signalScore})`,
          urgency: 'high',
          expectedImpact: `止损约 ${Math.abs(pos.unrealizedPnlPct).toFixed(1)}%`,
        });
      }

      // 过度集中
      if (pos.weight > MAX_KELLY_FRACTION) {
        recs.push({
          type: 'reduce',
          symbol: pos.symbol,
          name: pos.name,
          reason: `持仓占比 ${(pos.weight * 100).toFixed(1)}% 超过 Kelly 上限 ${(MAX_KELLY_FRACTION * 100).toFixed(0)}%`,
          urgency: 'high',
          expectedImpact: '降低集中度风险',
        });
      }

      // 强烈买入且亏损（加仓机会）
      if (pos.signal?.tier === 'STRONG_BUY' && pos.unrealizedPnl < 0) {
        recs.push({
          type: 'add',
          symbol: pos.symbol,
          name: pos.name,
          reason: `技术信号强烈看多且当前浮亏 ${Math.abs(pos.unrealizedPnlPct).toFixed(1)}%`,
          urgency: 'medium',
          expectedImpact: '摊低成本',
        });
      }
    }

    // 组合级建议
    if (riskLevel === 'extreme' || riskLevel === 'aggressive') {
      recs.push({
        type: 'hedge',
        symbol: 'INDEX_PUT',
        name: '指数看跌期权',
        reason: `组合风险等级为 ${riskLevel}，建议对冲尾部风险`,
        urgency: 'medium',
        expectedImpact: '降低最大回撤',
      });
    }

    return recs;
  }

  // ─── Private: Factor Mining Helpers ─────────────────────────────────

  private extractFeatures(bars: OHLCV[]): Record<MarketFeature, number[]> {
    const closes = bars.map((b) => b.close);
    const opens = bars.map((b) => b.open);
    const highs = bars.map((b) => b.high);
    const lows = bars.map((b) => b.low);
    const volumes = bars.map((b) => b.volume);

    const returns = closes.map((c, i) => i === 0 ? 0 : (c - closes[i - 1]) / closes[i - 1]);
    const logReturns = closes.map((c, i) => i === 0 ? 0 : Math.log(c / closes[i - 1]));
    const highLowRange = bars.map((b) => (b.high - b.low) / b.close);
    const closeOpenRange = bars.map((b) => (b.close - b.open) / b.open);
    const volumeChange = volumes.map((v, i) => i === 0 ? 0 : (v - volumes[i - 1]) / (volumes[i - 1] || 1));
    const priceMomentum = closes.map((c, i) => i < 10 ? 0 : (c - closes[i - 10]) / closes[i - 10]);

    // 波动率（10 日滚动标准差）
    const volatility = returns.map((_, i) => {
      if (i < 10) return 0;
      const slice = returns.slice(i - 10, i);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance = slice.reduce((s, r) => s + (r - mean) ** 2, 0) / slice.length;
      return Math.sqrt(variance);
    });

    return {
      close: closes,
      open: opens,
      high: highs,
      low: lows,
      volume: volumes,
      returns,
      log_returns: logReturns,
      high_low_range: highLowRange,
      close_open_range: closeOpenRange,
      volume_change: volumeChange,
      price_momentum: priceMomentum,
      volatility,
    };
  }

  private applyOperator(f1: number[], f2: number[], op: MathOperator): number[] {
    const len = Math.min(f1.length, f2.length);
    const result: number[] = [];

    switch (op) {
      case 'add':
        for (let i = 0; i < len; i++) result.push(f1[i] + f2[i]);
        break;
      case 'sub':
        for (let i = 0; i < len; i++) result.push(f1[i] - f2[i]);
        break;
      case 'mul':
        for (let i = 0; i < len; i++) result.push(f1[i] * f2[i]);
        break;
      case 'div':
        for (let i = 0; i < len; i++) result.push(f2[i] !== 0 ? f1[i] / f2[i] : 0);
        break;
      case 'rank': {
        // 截面排名（归一化到 0-1）
        const combined = f1.map((v, i) => v - f2[i]);
        const sorted = [...combined].sort((a, b) => a - b);
        for (let i = 0; i < len; i++) {
          const rank = sorted.indexOf(combined[i]);
          result.push(sorted.length > 1 ? rank / (sorted.length - 1) : 0.5);
        }
        break;
      }
      case 'zscore': {
        const diff = f1.map((v, i) => v - f2[i]);
        const mean = diff.reduce((a, b) => a + b, 0) / (diff.length || 1);
        const std = Math.sqrt(diff.reduce((s, v) => s + (v - mean) ** 2, 0) / (diff.length || 1)) || 1;
        for (let i = 0; i < len; i++) result.push((diff[i] - mean) / std);
        break;
      }
      case 'ema': {
        const diff = f1.map((v, i) => v - f2[i]);
        result.push(...calcEMA(diff, 10));
        break;
      }
      case 'std': {
        const diff = f1.map((v, i) => v - f2[i]);
        for (let i = 0; i < len; i++) {
          if (i < 10) {
            result.push(0);
          } else {
            const slice = diff.slice(i - 10, i);
            const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
            const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length;
            result.push(Math.sqrt(variance));
          }
        }
        break;
      }
    }

    return result;
  }

  private backtestFactor(factorValues: number[], closes: number[]): number[] {
    // 简化回测：因子值 > 0 做多，< 0 做空
    const returns: number[] = [];
    for (let i = 1; i < Math.min(factorValues.length, closes.length); i++) {
      const dailyReturn = (closes[i] - closes[i - 1]) / closes[i - 1];
      const position = factorValues[i - 1] > 0 ? 1 : factorValues[i - 1] < 0 ? -1 : 0;
      returns.push(dailyReturn * position);
    }
    return returns;
  }

  // ─── Private: DeFi Helpers ──────────────────────────────────────────

  private isStablePair(token0: string, token1: string): boolean {
    const stables = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX'];
    return stables.includes(token0.toUpperCase()) || stables.includes(token1.toUpperCase());
  }

  private estimateGasCost(chain: string, investmentAmount: number): number {
    // 年化 Gas 成本占投资金额的百分比
    // 假设每月调仓 1 次
    const gasByChain: Record<string, number> = {
      'ETH': 15,       // $15 per tx
      'SOL': 0.01,     // $0.01 per tx
      'BSC': 0.5,      // $0.5 per tx
      'Arbitrum': 1,   // $1 per tx
      'Polygon': 0.1,  // $0.1 per tx
    };
    const gasPerTx = gasByChain[chain] ?? 5;
    const annualGas = gasPerTx * 12 * 2; // 12 months × 2 txs (deposit + withdraw)
    return +((annualGas / investmentAmount) * 100).toFixed(2);
  }

  // ─── Private: Utility ───────────────────────────────────────────────

  private calcSignalAgreement(signals: Record<string, number>): number {
    const values = Object.values(signals);
    if (values.length === 0) return 0;
    const positiveCount = values.filter((v) => v > 0).length;
    const negativeCount = values.filter((v) => v < 0).length;
    const dominant = Math.max(positiveCount, negativeCount);
    return dominant / values.length;
  }

  private calcPortfolioConfidence(
    positions: PositionAnalysis[],
    gateCheck: InvestmentGateCheck,
  ): number {
    let confidence = 0.4;

    // 持仓数量
    if (positions.length >= 5) confidence += 0.15;
    else if (positions.length >= 3) confidence += 0.1;

    // 数据充分
    if (gateCheck.result === 'proceed') confidence += 0.15;

    // 信号覆盖
    const signalCoverage = positions.filter((p) => p.signal !== null).length / (positions.length || 1);
    confidence += signalCoverage * 0.15;

    // 平均信号置信度
    const avgSignalConf = positions.reduce((s, p) => s + (p.signal?.confidence ?? 0), 0) / (positions.length || 1);
    confidence += avgSignalConf * 0.15;

    return +Math.min(1, Math.max(0, confidence)).toFixed(2);
  }

  private calcSectorWeights(positions: PositionAnalysis[]): Record<string, number> {
    const sectors: Record<string, number> = {};
    for (const pos of positions) {
      const sector = pos.signal ? pos.market : 'unknown';
      sectors[sector] = (sectors[sector] ?? 0) + pos.weight;
    }
    return sectors;
  }

  private buildReasoning(
    symbol: string,
    signals: Record<string, number>,
    totalScore: number,
    direction: string,
  ): string {
    const lines = [`${symbol} 综合评分 ${totalScore.toFixed(2)}，方向: ${direction}`];
    for (const [key, value] of Object.entries(signals)) {
      const label = this.signalLabel(key);
      const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→';
      lines.push(`  ${label}: ${value.toFixed(2)} ${arrow}`);
    }
    return lines.join('\n');
  }

  private signalLabel(key: string): string {
    const labels: Record<string, string> = {
      technical_trend: '技术趋势',
      momentum: '动量',
      volume_profile: '量能',
      volatility_regime: '波动率',
      sentiment: '情绪',
    };
    return labels[key] ?? key;
  }

  private buildNeutralSignal(
    symbol: string,
    market: string,
    reason: string,
  ): InvestmentSignal {
    return {
      symbol,
      market,
      direction: 'neutral',
      signalScore: 0,
      signals: {},
      confidence: 0,
      tier: 'HOLD',
      reasoning: `数据不足，无法生成有效信号: ${reason}`,
      timestamp: new Date().toISOString(),
    };
  }

  private generateMockReturns(
    positions: Array<{ marketValue: number }>,
    days: number,
  ): number[] {
    const totalValue = positions.reduce((s, p) => s + p.marketValue, 0);
    const returns: number[] = [];
    // 简单的 mock 日收益序列
    for (let i = 0; i < days; i++) {
      const baseReturn = 0.0003; // ~8% annualized
      const noise = (Math.sin(i * 0.7) * 0.01 + Math.cos(i * 1.3) * 0.005);
      returns.push(baseReturn + noise);
    }
    return returns;
  }

  private toCumulative(returns: number[], initialValue: number): number[] {
    const values: number[] = [initialValue];
    for (const r of returns) {
      values.push(values[values.length - 1] * (1 + r));
    }
    return values;
  }

  // ─── Mock Data ──────────────────────────────────────────────────────

  private mockPortfolioPositions(): Array<{
    symbol: string;
    name: string;
    market: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
  }> {
    return [
      { symbol: '600519', name: '贵州茅台', market: 'A股', quantity: 10, avgCost: 1800, currentPrice: 1850, marketValue: 18500 },
      { symbol: '000858', name: '五粮液', market: 'A股', quantity: 50, avgCost: 150, currentPrice: 162, marketValue: 8100 },
      { symbol: 'AAPL', name: 'Apple Inc', market: '美股', quantity: 20, avgCost: 170, currentPrice: 195, marketValue: 3900 },
      { symbol: 'NVDA', name: 'NVIDIA', market: '美股', quantity: 10, avgCost: 450, currentPrice: 880, marketValue: 8800 },
      { symbol: 'BTC', name: 'Bitcoin', market: 'BTC', quantity: 0.1, avgCost: 42000, currentPrice: 67000, marketValue: 6700 },
      { symbol: 'ETH', name: 'Ethereum', market: 'ETH', quantity: 2, avgCost: 2800, currentPrice: 3500, marketValue: 7000 },
    ];
  }

  private mockStockCandidates(criteria: StockScreenCriteria): Array<{ symbol: string }> {
    const candidates: Record<string, string[]> = {
      'A股': ['600519', '000858', '601318', '000333', '300750', '600036', '601166', '002475', '300059', '000001'],
      '港股': ['00700', '09988', '03690', '09618', '01810', '02318', '00941', '01299', '02020', '09999'],
      '美股': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JPM', 'V'],
    };
    const symbols = candidates[criteria.market] ?? candidates['A股'];
    return symbols.map((s) => ({ symbol: s }));
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * 创建投资分析引擎实例
 * @param provider 可选的行情数据提供者，不传则使用 Mock
 */
export function createInvestmentEngine(provider?: MarketDataProvider): InvestmentAnalysisEngine {
  return new InvestmentAnalysisEngine(provider);
}
