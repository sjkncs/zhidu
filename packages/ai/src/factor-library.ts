/**
 * @zhidu/ai — 因子库 + 投资行为学知识库
 *
 * 来源：
 *   PA_Agent: 31 策略文件 + 13 市场特征 + 15 K线几何特征 + 5 信号投票 + 经验库
 *   栀染 AlphaGPT: 12 维因子空间 + 12 算子 + RL 奖励函数 + Polish notation
 *   栀染 cjquant: Risk Parity / Black-Litterman / HRP 优化器 + RBSA 穿透分析
 *   栀染 no_JIT: HJI 微分博弈 Nash 均衡费用设计
 *   栀染 NS-NTK: NTK 谱分析过拟合检测 + EAT/PVR 优化器
 *   栀染 capacity_estimator: Q-learning 市场冲击 Oracle + 平方根冲击模型
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 1. AlphaGPT 因子空间：市场特征 + 数学算子
// ═══════════════════════════════════════════════════════════════════════════════

/** 市场特征定义（AlphaGPT AdvancedFactorEngineer 12 维空间） */
export interface FactorMarketFeature {
  id: string;
  name: string;
  nameCN: string;
  formula: string;
  category: 'momentum' | 'volatility' | 'liquidity' | 'microstructure' | 'trend';
  /** 适用市场 */
  markets: string[];
}

export const MARKET_FEATURES: FactorMarketFeature[] = [
  // ── 传统 ETF/股票（AlphaGPT times.py） ──
  { id: 'RET', name: 'Return', nameCN: '日收益率', formula: '(close - prev_close) / prev_close', category: 'momentum', markets: ['A股', '港股', '美股'] },
  { id: 'RET5', name: '5D Return', nameCN: '5日收益率', formula: 'pct_change(5)', category: 'momentum', markets: ['A股', '港股', '美股'] },
  { id: 'VOL_CHG', name: 'Volume Change', nameCN: '成交量变化', formula: 'vol / rolling_mean(vol, 20) - 1', category: 'liquidity', markets: ['A股', '港股', '美股'] },
  { id: 'V_RET', name: 'Volume-Weighted Return', nameCN: '量价收益率', formula: 'ret * (vol_chg + 1)', category: 'momentum', markets: ['A股', '港股', '美股'] },
  { id: 'TREND', name: 'Trend Deviation', nameCN: '趋势偏离', formula: 'close / rolling_mean(close, 60) - 1', category: 'trend', markets: ['A股', '港股', '美股'] },

  // ── 高级因子（AlphaGPT model_core/factors.py） ──
  { id: 'PRESSURE', name: 'Buy/Sell Pressure', nameCN: '买卖压力', formula: 'tanh((close - open) / (high - low) * 3)', category: 'microstructure', markets: ['A股', '港股', '美股', 'BTC', 'ETH'] },
  { id: 'FOMO', name: 'FOMO Index', nameCN: '追涨指数', formula: 'clamp(vol_acceleration, -5, 5)', category: 'liquidity', markets: ['BTC', 'ETH', 'SOL', 'DeFi'] },
  { id: 'DEV', name: 'MA Deviation', nameCN: '均线偏离', formula: '(close - MA20) / MA20', category: 'trend', markets: ['A股', '港股', '美股', 'BTC', 'ETH'] },
  { id: 'VOL_CLUSTER', name: 'Volatility Clustering', nameCN: '波动聚集', formula: 'sqrt(MA10(ret^2))', category: 'volatility', markets: ['A股', '港股', '美股', 'BTC', 'ETH'] },
  { id: 'MOM_REV', name: 'Momentum Reversal', nameCN: '动量反转', formula: 'mom * prev_mom < 0 (binary)', category: 'momentum', markets: ['A股', '港股', '美股'] },
  { id: 'REL_STRENGTH', name: 'Relative Strength', nameCN: '相对强弱', formula: '(RSI14 - 50) / 50', category: 'momentum', markets: ['A股', '港股', '美股', 'BTC', 'ETH'] },
  { id: 'HL_RANGE', name: 'High-Low Range', nameCN: '振幅', formula: '(high - low) / close', category: 'volatility', markets: ['A股', '港股', '美股', 'BTC', 'ETH'] },
  { id: 'CLOSE_POS', name: 'Close Position', nameCN: '收盘位置', formula: '(close - low) / (high - low)', category: 'microstructure', markets: ['A股', '港股', '美股', 'BTC', 'ETH'] },
  { id: 'VOL_TREND', name: 'Volume Trend', nameCN: '量能趋势', formula: '(vol - prev_vol) / prev_vol', category: 'liquidity', markets: ['A股', '港股', '美股', 'BTC', 'ETH'] },

  // ── 加密市场专用 ──
  { id: 'LIQ_SCORE', name: 'Liquidity Score', nameCN: '流动性评分', formula: 'clamp(liquidity / fdv * 4, 0, 1)', category: 'liquidity', markets: ['BTC', 'ETH', 'SOL', 'DeFi'] },
  { id: 'LOG_VOL', name: 'Log Volume', nameCN: '对数成交量', formula: 'log1p(volume)', category: 'liquidity', markets: ['BTC', 'ETH', 'SOL', 'DeFi'] },
];

/** 数学算子（AlphaGPT ops.py 12 算子） */
export interface FactorMathOperator {
  id: string;
  name: string;
  arity: number;
  formula: string;
  description: string;
}

export const MATH_OPERATORS: FactorMathOperator[] = [
  { id: 'ADD', name: 'Add', arity: 2, formula: 'x + y', description: '加法' },
  { id: 'SUB', name: 'Subtract', arity: 2, formula: 'x - y', description: '减法' },
  { id: 'MUL', name: 'Multiply', arity: 2, formula: 'x * y', description: '乘法' },
  { id: 'DIV', name: 'Divide', arity: 2, formula: 'x / (y + 1e-6)', description: '保护除法' },
  { id: 'NEG', name: 'Negate', arity: 1, formula: '-x', description: '取负' },
  { id: 'ABS', name: 'Absolute', arity: 1, formula: '|x|', description: '绝对值' },
  { id: 'SIGN', name: 'Sign', arity: 1, formula: 'sign(x)', description: '符号' },
  { id: 'GATE', name: 'Gate', arity: 3, formula: 'if cond > 0 then x else y', description: '条件分支' },
  { id: 'JUMP', name: 'Jump', arity: 1, formula: 'relu(zscore(x) - 3)', description: '异常跳跃（z>3 时激活）' },
  { id: 'DECAY', name: 'Decay', arity: 1, formula: 'x + 0.8*delay(x,1) + 0.6*delay(x,2)', description: '指数衰减' },
  { id: 'DELAY1', name: 'Delay', arity: 1, formula: 'delay(x, 1)', description: '滞后一期' },
  { id: 'MAX3', name: 'Max3', arity: 1, formula: 'max(x, delay(x,1), delay(x,2))', description: '三期最大值' },
  // ── PA_Agent 扩展算子 ──
  { id: 'DELTA5', name: 'Delta5', arity: 1, formula: 'x - delay(x, 5)', description: '5期变化量' },
  { id: 'MA20', name: 'MA20', arity: 1, formula: 'linear_decay_mean(x, 20)', description: '20期线性加权均值' },
  { id: 'STD20', name: 'ZScore20', arity: 1, formula: '(x - mean20) / (std20 + 1e-6)', description: '20期标准化' },
  { id: 'TS_RANK20', name: 'TSRank20', arity: 1, formula: 'rank(x, window=20)', description: '20期时序排名' },
];

/** RL 奖励函数参数（AlphaGPT Sortino-based） */
export const RL_REWARD_PARAMS = {
  COST_RATE: 0.0005,         // 5bps 单边交易成本
  ANNUALIZATION: 15.87,      // sqrt(252) 年化因子
  RISK_FREE_RATE: 0.02,      // 2% 无风险利率
  MIN_PNL_THRESHOLD: 0,      // 负 PnL 惩罚阈值
  MAX_TURNOVER: 0.5,         // 换手率惩罚阈值
  REWARD_CLAMP: [-3, 5] as [number, number],
  INVALID_FORMULA_PENALTY: -1.0,
  NO_POSITION_PENALTY: -2.0,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. 5 信号投票系统（PA_Agent + AlphaGPT 融合）
// ═══════════════════════════════════════════════════════════════════════════════

export interface VotingSignal {
  id: string;
  name: string;
  nameCN: string;
  /** 计算方法 */
  compute: (bars: PriceBar[]) => number; // -1 to +1
  /** 数据需求（最少 K 线数） */
  minBars: number;
}

export interface PriceBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

/** 5 信号投票系统 */
export const VOTING_SIGNALS: VotingSignal[] = [
  {
    id: 'ema_slope',
    name: 'EMA Slope',
    nameCN: 'EMA 斜率',
    minBars: 20,
    compute: (bars) => {
      if (bars.length < 20) return 0;
      const ema10 = computeEMA(bars.map((b) => b.close), 10);
      const slope = (ema10[ema10.length - 1] - ema10[ema10.length - 2]) / (ema10[ema10.length - 2] + 1e-9);
      return Math.sign(slope) * Math.min(1, Math.abs(slope) * 1000);
    },
  },
  {
    id: 'close_gravity',
    name: 'Weighted Close Gravity',
    nameCN: '加权收盘重心',
    minBars: 8,
    compute: (bars) => {
      if (bars.length < 8) return 0;
      const recent = bars.slice(-8);
      const weights = recent.map((_, i) => i + 1);
      const totalWeight = weights.reduce((s, w) => s + w, 0);
      const weightedClose = recent.reduce((s, b, i) => s + b.close * weights[i], 0) / totalWeight;
      const avgClose = recent.reduce((s, b) => s + b.close, 0) / recent.length;
      return Math.sign(weightedClose - avgClose) * Math.min(1, Math.abs(weightedClose - avgClose) / avgClose * 100);
    },
  },
  {
    id: 'swing_structure',
    name: 'Swing Structure',
    nameCN: '摆动结构',
    minBars: 10,
    compute: (bars) => {
      if (bars.length < 10) return 0;
      // 检测 HH+HL (看多) vs LL+LH (看空)
      const swings = detectSwings(bars.slice(-10));
      const hh = swings.highs.filter((h, i) => i > 0 && h > swings.highs[i - 1]).length;
      const hl = swings.lows.filter((l, i) => i > 0 && l > swings.lows[i - 1]).length;
      const ll = swings.lows.filter((l, i) => i > 0 && l < swings.lows[i - 1]).length;
      const lh = swings.highs.filter((h, i) => i > 0 && h < swings.highs[i - 1]).length;
      const bullish = hh + hl;
      const bearish = ll + lh;
      if (bullish + bearish === 0) return 0;
      return (bullish - bearish) / (bullish + bearish);
    },
  },
  {
    id: 'trend_bar_dominance',
    name: 'Trend Bar Dominance',
    nameCN: '趋势K线优势度',
    minBars: 10,
    compute: (bars) => {
      if (bars.length < 10) return 0;
      const recent = bars.slice(-10);
      let bullBars = 0, bearBars = 0;
      for (const b of recent) {
        const body = b.close - b.open;
        const range = b.high - b.low;
        if (range > 0 && Math.abs(body) / range > 0.6) {
          if (body > 0) bullBars++;
          else bearBars++;
        }
      }
      const total = bullBars + bearBars;
      if (total === 0) return 0;
      return (bullBars - bearBars) / total;
    },
  },
  {
    id: 'overlap_ratio',
    name: 'Overlap Ratio',
    nameCN: 'K线重叠率',
    minBars: 8,
    compute: (bars) => {
      if (bars.length < 8) return 0;
      const recent = bars.slice(-8);
      let overlapCount = 0;
      for (let i = 1; i < recent.length; i++) {
        const prev = recent[i - 1];
        const curr = recent[i];
        const overlap = Math.min(prev.high, curr.high) - Math.max(prev.low, curr.low);
        if (overlap > 0) overlapCount++;
      }
      const ratio = overlapCount / (recent.length - 1);
      // 低重叠 = 趋势 → 正值；高重叠 = 震荡 → 负值
      return (0.5 - ratio) * 2;
    },
  },
];

/** 投票合成方向 */
export function synthesizeDirection(signals: Record<string, number>): {
  direction: 'bullish' | 'bearish' | 'neutral';
  score: number;
  consensus: number;
} {
  const values = Object.values(signals);
  const score = values.reduce((s, v) => s + v, 0);
  const consensus = values.reduce((s, v) => s + Math.abs(v), 0) / values.length;

  let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (score >= 3) direction = 'bullish';
  else if (score <= -3) direction = 'bearish';

  return { direction, score, consensus };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. 投资组合优化器（cjquant 移植）
// ═══════════════════════════════════════════════════════════════════════════════

export interface OptimizerResult {
  weights: Record<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
  method: string;
}

/** 风险平价优化器（cjquant Risk Parity） */
export function riskParityOptimize(
  assets: string[],
  covMatrix: number[][],
): OptimizerResult {
  const n = assets.length;
  // 简化版：等风险贡献 → 反方差加权
  const variances = covMatrix.map((row, i) => row[i]);
  const invVariances = variances.map((v) => 1 / (v + 1e-9));
  const totalInvVar = invVariances.reduce((s, v) => s + v, 0);
  const weights: Record<string, number> = {};
  assets.forEach((a, i) => {
    weights[a] = invVariances[i] / totalInvVar;
  });

  return {
    weights,
    expectedReturn: 0,
    expectedVolatility: 0,
    sharpeRatio: 0,
    method: 'Risk Parity (Inverse Variance)',
  };
}

/** 最大夏普优化器（cjquant Mean-Variance） */
export function maxSharpeOptimize(
  assets: string[],
  expectedReturns: number[],
  covMatrix: number[][],
  riskFreeRate: number = 0.02,
): OptimizerResult {
  const n = assets.length;
  // 简化：均值方差最优 → 闭式解 w* = Σ⁻¹(μ - rf·1) / 1'Σ⁻¹(μ - rf·1)
  const excessReturns = expectedReturns.map((r) => r - riskFreeRate);

  // 对角协方差简化
  const invCovDiag = covMatrix.map((row, i) => 1 / (row[i] + 1e-9));
  const numerator = invCovDiag.map((inv, i) => inv * excessReturns[i]);
  const denominator = numerator.reduce((s, v) => s + v, 0);

  const weights: Record<string, number> = {};
  assets.forEach((a, i) => {
    weights[a] = Math.max(0, numerator[i] / (denominator + 1e-9));
  });

  // 归一化
  const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
  if (totalWeight > 0) {
    Object.keys(weights).forEach((k) => { weights[k] /= totalWeight; });
  }

  return {
    weights,
    expectedReturn: expectedReturns.reduce((s, r, i) => s + r * (weights[assets[i]] ?? 0), 0),
    expectedVolatility: 0,
    sharpeRatio: 0,
    method: 'Mean-Variance (Max Sharpe)',
  };
}

/** Black-Litterman 后验收益（cjquant Black-Litterman） */
export function blackLittermanPosterior(
  equilibriumReturns: number[],
  views: { P: number[][]; Q: number[]; confidence: number[] },
  covMatrix: number[][],
  tau: number = 0.05,
): number[] {
  // Omega = diag(diag(P * (tau * Sigma) * P^T))
  // Posterior = [(tau*Sigma)^-1 + P'*Omega^-1*P]^-1 * [(tau*Sigma)^-1*Pi + P'*Omega^-1*Q]
  // 简化版：仅支持对角协方差
  const n = equilibriumReturns.length;
  const tauSigmaDiag = covMatrix.map((row, i) => tau * row[i]);
  const invTauSigma = tauSigmaDiag.map((v) => 1 / (v + 1e-9));

  // 简化：单视图场景
  const posterior = equilibriumReturns.map((pi, i) => {
    const viewImpact = views.confidence[0] * (views.Q[0] - pi);
    return pi + tau * viewImpact;
  });

  return posterior;
}

/** HRP 层级风险平价（cjquant Hierarchical Risk Parity） */
export function hierarchicalRiskParity(
  assets: string[],
  corrMatrix: number[][],
): OptimizerResult {
  const n = assets.length;
  // 简化版：距离矩阵 → 聚类 → 递归二分
  // 距离 = sqrt(0.5 * (1 - corr))
  const distances = corrMatrix.map((row) => row.map((c) => Math.sqrt(0.5 * (1 - c))));

  // 简化：等权作为 HRP 近似
  const weights: Record<string, number> = {};
  assets.forEach((a) => { weights[a] = 1 / n; });

  return {
    weights,
    expectedReturn: 0,
    expectedVolatility: 0,
    sharpeRatio: 0,
    method: 'Hierarchical Risk Parity (simplified)',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. 市场冲击模型（capacity_estimator 移植）
// ═══════════════════════════════════════════════════════════════════════════════

export interface MarketImpactParams {
  /** 永久冲击系数 */
  permanentImpactCoeff: number;
  /** 冲击指数（平方根模型 = 0.5） */
  impactExponent: number;
  /** 最大参与率 */
  maxParticipationRate: number;
  /** 日均成交额（元） */
  dailyADV: number;
  /** 基准滑点（bps） */
  baselineSlippageBps: number;
}

export const DEFAULT_IMPACT_PARAMS: MarketImpactParams = {
  permanentImpactCoeff: 0.15,
  impactExponent: 0.5,
  maxParticipationRate: 0.05,
  dailyADV: 10_000_000_000, // 100 亿
  baselineSlippageBps: 5.0,
};

/** 计算市场冲击成本（平方根冲击模型） */
export function calculateMarketImpact(
  tradeSize: number,
  params: MarketImpactParams = DEFAULT_IMPACT_PARAMS,
  qMultiplier: number = 1.0,
): {
  impactBps: number;
  impactCost: number;
  participationRate: number;
  liquidityPenalty: number;
} {
  const participationRate = tradeSize / params.dailyADV;
  const scaledImpact = params.permanentImpactCoeff * qMultiplier *
    Math.pow(participationRate, params.impactExponent);

  let liquidityPenalty = 1.0;
  if (participationRate > params.maxParticipationRate) {
    const excess = participationRate - params.maxParticipationRate;
    liquidityPenalty += Math.pow(excess * 15, 2);
  }

  const finalImpact = scaledImpact * liquidityPenalty;
  const impactBps = finalImpact * 10000;
  const impactCost = tradeSize * finalImpact;

  return { impactBps, impactCost, participationRate, liquidityPenalty };
}

/** AUM 容量估算 */
export function estimateAUMCapacity(
  signals: Array<{ alpha: number; weight: number }>,
  params: MarketImpactParams = DEFAULT_IMPACT_PARAMS,
  aumMin: number = 10_000_000,
  aumMax: number = 10_000_000_000,
  aumStep: number = 10_000_000,
): { bestAUM: number; maxNetPnl: number; curve: Array<{ aum: number; netPnl: number }> } {
  const curve: Array<{ aum: number; netPnl: number }> = [];
  let bestAUM = aumMin;
  let maxNetPnl = -Infinity;

  for (let aum = aumMin; aum <= aumMax; aum += aumStep) {
    let netPnl = 0;
    for (const sig of signals) {
      const tradeSize = aum * sig.weight;
      const grossPnl = tradeSize * (sig.alpha / 10000);
      const impact = calculateMarketImpact(tradeSize, params);
      netPnl += grossPnl - impact.impactCost;
    }
    curve.push({ aum, netPnl });
    if (netPnl > maxNetPnl) {
      maxNetPnl = netPnl;
      bestAUM = aum;
    }
  }

  return { bestAUM, maxNetPnl, curve };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. 投资行为学知识库（认知偏差检测 + 守卫）
// ═══════════════════════════════════════════════════════════════════════════════

export interface BehavioralBias {
  id: string;
  name: string;
  nameCN: string;
  description: string;
  /** 检测条件 */
  detect: (context: TradingContext) => { triggered: boolean; severity: number; evidence: string };
  /** 建议对策 */
  mitigation: string;
  /** 来源 */
  source: 'PA_Agent' | 'AlphaGPT' | 'cjquant' | 'behavioral_finance';
}

export interface TradingContext {
  /** 最近交易记录 */
  recentTrades: Array<{ symbol: string; side: string; timestamp: number; pnl?: number }>;
  /** 持仓信息 */
  positions: Array<{ symbol: string; pnl: number; pnlPercent: number; holdingDays: number; weight: number }>;
  /** 组合收益序列 */
  returns: number[];
  /** 当前情绪状态（如果有） */
  mood?: 'fear' | 'greed' | 'neutral';
}

export const BEHAVIORAL_BIASES: BehavioralBias[] = [
  {
    id: 'disposition_effect',
    name: 'Disposition Effect',
    nameCN: '处置效应',
    description: '投资者倾向于过早卖出盈利股票，过久持有亏损股票',
    source: 'behavioral_finance',
    detect: (ctx) => {
      const soldWinners = ctx.recentTrades.filter((t) => t.side === 'sell' && (t.pnl ?? 0) > 0);
      const heldLosers = ctx.positions.filter((p) => p.pnl < 0 && p.holdingDays > 30);
      const triggered = soldWinners.length > 2 && heldLosers.length > 2;
      const severity = Math.min(1, (soldWinners.length + heldLosers.length) / 10);
      return {
        triggered,
        severity,
        evidence: `近期卖出 ${soldWinners.length} 只盈利股，持有 ${heldLosers.length} 只亏损超30天`,
      };
    },
    mitigation: '设定止损位并严格执行。盈利股让利润奔跑（Trailing Stop），亏损股及时截断。',
  },
  {
    id: 'loss_aversive_holding',
    name: 'Loss Aversion Holding',
    nameCN: '损失厌恶持有',
    description: '因不愿承认亏损而持续持有深度套牢的资产',
    source: 'cjquant',
    detect: (ctx) => {
      const deepLosers = ctx.positions.filter((p) => p.pnlPercent < -20 && p.holdingDays > 60);
      const triggered = deepLosers.length > 0;
      const severity = triggered ? Math.min(1, deepLosers.reduce((s, p) => s + Math.abs(p.pnlPercent), 0) / 100) : 0;
      return {
        triggered,
        severity,
        evidence: triggered ? `${deepLosers.length} 只持仓亏损超20%且持有超60天: ${deepLosers.map((p) => p.symbol).join(', ')}` : '',
      };
    },
    mitigation: 'cjquant 建议：对亏损超 20% 的持仓进行"归零测试"——如果今天空仓，你还会买入吗？如果答案是否，立即止损。',
  },
  {
    id: 'overtrading',
    name: 'Overtrading',
    nameCN: '过度交易',
    description: '频繁交易导致高额手续费和滑点侵蚀收益',
    source: 'AlphaGPT',
    detect: (ctx) => {
      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const recentCount = ctx.recentTrades.filter((t) => t.timestamp > sevenDaysAgo).length;
      const triggered = recentCount > 10;
      const severity = triggered ? Math.min(1, recentCount / 30) : 0;
      return {
        triggered,
        severity,
        evidence: triggered ? `7天内交易 ${recentCount} 次（AlphaGPT 阈值: 10次/周）` : '',
      };
    },
    mitigation: 'AlphaGPT 换手率惩罚: turnover > 0.5 时 reward -= 1.0。建议降低交易频率，仅在信号强度 > 0.85 时入场。',
  },
  {
    id: 'chasing_performance',
    name: 'Performance Chasing',
    nameCN: '追涨杀跌',
    description: '追逐近期表现好的资产，忽视均值回归风险',
    source: 'PA_Agent',
    detect: (ctx) => {
      const recentBuys = ctx.recentTrades.filter((t) => t.side === 'buy');
      const hotPursuit = recentBuys.filter((t) => {
        const pos = ctx.positions.find((p) => p.symbol === t.symbol);
        return pos && pos.pnlPercent > 30; // 买入已大涨的资产
      });
      const triggered = hotPursuit.length > 2;
      const severity = triggered ? Math.min(1, hotPursuit.length / 5) : 0;
      return {
        triggered,
        severity,
        evidence: triggered ? `近期买入 ${hotPursuit.length} 只已涨超30%的资产` : '',
      };
    },
    mitigation: 'PA_Agent 禁止追涨: 当 Always In 方向已经走了很远时，Section 14 禁止 chasing climax。等回调至支撑位再入场。',
  },
  {
    id: 'concentration_risk',
    name: 'Concentration Risk',
    nameCN: '集中度过高风险',
    description: '单一持仓或单一市场占比过高',
    source: 'cjquant',
    detect: (ctx) => {
      const maxWeight = Math.max(...ctx.positions.map((p) => p.weight));
      const triggered = maxWeight > 30;
      const severity = triggered ? Math.min(1, (maxWeight - 30) / 20) : 0;
      return {
        triggered,
        severity,
        evidence: triggered ? `最大单一持仓权重 ${maxWeight.toFixed(1)}%（阈值 25%）` : '',
      };
    },
    mitigation: 'cjquant Risk Parity: 使用等风险贡献配置，单一持仓不超过 20%。桥水全天候策略: 权益最大 30%。',
  },
  {
    id: 'recency_bias',
    name: 'Recency Bias',
    nameCN: '近因偏差',
    description: '过度依赖近期数据，忽视长期统计规律',
    source: 'PA_Agent',
    detect: (ctx) => {
      if (ctx.returns.length < 20) return { triggered: false, severity: 0, evidence: '' };
      const recent10 = ctx.returns.slice(-10);
      const earlier = ctx.returns.slice(-20, -10);
      const recentAvg = recent10.reduce((s, r) => s + r, 0) / 10;
      const earlierAvg = earlier.reduce((s, r) => s + r, 0) / 10;
      const divergence = Math.abs(recentAvg - earlierAvg);
      const triggered = divergence > 0.02; // 2% 以上偏差
      return {
        triggered,
        severity: triggered ? Math.min(1, divergence * 20) : 0,
        evidence: triggered ? `近10日均收益 ${(recentAvg * 100).toFixed(2)}% vs 前期 ${(earlierAvg * 100).toFixed(2)}%，差异显著` : '',
      };
    },
    mitigation: 'PA_Agent 双窗口设计: 近窗口(8 bars)做信号，背景窗口(20 bars)做参考。近窗口权威但背景不否决，防止被短期噪声误导。',
  },
  {
    id: 'anchoring',
    name: 'Anchoring',
    nameCN: '锚定效应',
    description: '过度依赖某个参考价格（如买入价）做决策',
    source: 'behavioral_finance',
    detect: (ctx) => {
      // 检测：所有卖出都在接近买入价的位置
      const sells = ctx.recentTrades.filter((t) => t.side === 'sell' && t.pnl !== undefined);
      if (sells.length < 3) return { triggered: false, severity: 0, evidence: '' };
      const nearCostSells = sells.filter((t) => Math.abs(t.pnl ?? 0) < (t.pnl ?? 0) * 0.05 + 100);
      const ratio = nearCostSells.length / sells.length;
      const triggered = ratio > 0.7;
      return {
        triggered,
        severity: triggered ? ratio : 0,
        evidence: triggered ? `${(ratio * 100).toFixed(0)}% 的卖出发生在接近成本价位置` : '',
      };
    },
    mitigation: '使用 trailing stop 代替固定目标价。AlphaGPT 策略: 盈利 5% 激活追踪止损，回撤 3% 从峰值平仓。',
  },
  {
    id: 'sunk_cost',
    name: 'Sunk Cost Fallacy',
    nameCN: '沉没成本谬误',
    description: '因已投入大量时间/金钱而不愿放弃亏损头寸',
    source: 'behavioral_finance',
    detect: (ctx) => {
      const longHeldLosers = ctx.positions.filter((p) => p.pnl < 0 && p.holdingDays > 90);
      const triggered = longHeldLosers.length > 1;
      const severity = triggered ? Math.min(1, longHeldLosers.length / 5) : 0;
      return {
        triggered,
        severity,
        evidence: triggered ? `${longHeldLosers.length} 只亏损持仓超90天: ${longHeldLosers.map((p) => `${p.symbol}(${p.holdingDays}天)`).join(', ')}` : '',
      };
    },
    mitigation: 'cjquant 赎回费模型: 持有 < 7天罚 1.5%，> 180天免费。但不要因为"已交了学费"就继续持有——过去的成本不应影响未来决策。',
  },
];

/** 运行行为偏差检测 */
export function detectBehavioralBiases(context: TradingContext): Array<{
  bias: BehavioralBias;
  result: { triggered: boolean; severity: number; evidence: string };
}> {
  return BEHAVIORAL_BIASES
    .map((bias) => ({ bias, result: bias.detect(context) }))
    .filter((item) => item.result.triggered)
    .sort((a, b) => b.result.severity - a.result.severity);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. 策略知识库（PA_Agent 31 策略文件 + cjquant 模板）
// ═══════════════════════════════════════════════════════════════════════════════

export interface StrategyTemplate {
  id: string;
  name: string;
  nameCN: string;
  /** 适用市场环境 */
  regime: 'trending' | 'ranging' | 'breakout' | 'reversal' | 'all_weather';
  /** 核心规则 */
  rules: string[];
  /** 禁止行为 */
  prohibitions: string[];
  /** 参考来源 */
  source: string;
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'spike_continuation',
    name: 'Spike Continuation',
    nameCN: '尖峰延续',
    regime: 'trending',
    rules: [
      '尖峰（连续大阳线/大阴线）后等待回调至 EMA20',
      '回调不破尖峰起点 → 顺势入场',
      '止损设在尖峰起点下方 1 ATR',
      '目标 = 尖峰幅度的 1.5 倍（Measured Move）',
    ],
    prohibitions: ['不追尖峰顶部', '不在尖峰中途反向交易'],
    source: 'PA_Agent: spike_channel_strategy.txt',
  },
  {
    id: 'trading_range',
    name: 'Trading Range',
    nameCN: '交易区间',
    regime: 'ranging',
    rules: [
      '在区间上沿做空、下沿做多',
      '突破区间后等待回测确认再入场',
      '止损设在区间外侧 1 ATR',
      '盈利目标 = 区间宽度的 0.8 倍',
    ],
    prohibitions: ['不在区间中部入场', '不追假突破'],
    source: 'PA_Agent: trading_range_strategy.txt',
  },
  {
    id: 'wedge_reversal',
    name: 'Wedge Reversal',
    nameCN: '楔形反转',
    regime: 'reversal',
    rules: [
      '上升楔形（3 push up）→ 看空',
      '下降楔形（3 push down）→ 看多',
      '等待楔形突破 + 回测确认',
      '目标 = 楔形高度的 1 倍',
    ],
    prohibitions: ['不在楔形形成过程中反向交易', '不追第一个突破（可能是假突破）'],
    source: 'PA_Agent: wedge_pattern.txt',
  },
  {
    id: 'bridgewater_all_weather',
    name: 'Bridgewater All Weather',
    nameCN: '桥水全天候',
    regime: 'all_weather',
    rules: [
      '股票 30% / 黄金 15% / 长期债券 40% / 短期债券 15%',
      '每季度再平衡',
      '使用 120 天滚动风险平价窗口',
      '4 象限覆盖: 增长上行/下行 × 通胀上行/下行',
    ],
    prohibitions: ['不做择时', '不做杠杆'],
    source: 'cjquant: Bridgewater strategy template',
  },
  {
    id: 'permanent_portfolio',
    name: 'Permanent Portfolio',
    nameCN: '永久组合（Harry Browne）',
    regime: 'all_weather',
    rules: [
      '股票 25% / 黄金 25% / 债券 25% / 现金 25%',
      '年度再平衡',
      '偏离阈值 5%: 任一资产偏离目标 5% 以上触发再平衡',
    ],
    prohibitions: ['不做预测', '不做杠杆', '不频繁调整'],
    source: 'cjquant: Permanent Portfolio template',
  },
  {
    id: 'moonbag_momentum',
    name: 'Moonbag Momentum',
    nameCN: 'Moonbag 动量策略',
    regime: 'trending',
    rules: [
      '入场信号: AI sigmoid score > 0.85 且流动性 > $500K',
      '最大同时持仓: 3 只',
      '止损: -5% 立即平仓',
      '止盈: +10% 卖出 50%（保留 moonbag）',
      '追踪止损: +5% 激活，从峰值回撤 3% 平仓',
    ],
    prohibitions: ['不在流动性 < $5K 时入场', '不买无卖出路径的代币（honeypot 检测）'],
    source: 'AlphaGPT: strategy_manager/config.py',
  },
  {
    id: 'defi_lp_protection',
    name: 'DeFi LP Protection',
    nameCN: 'DeFi LP 保护策略',
    regime: 'ranging',
    rules: [
      '使用 no_JIT Hook 保护流动性',
      '检测同区块 deltaL/L_active 比率',
      '比率超过阈值 → 自动提升手续费至 Nash 均衡费用',
      'Nash 均衡: Pi_attacker(a) = phi * (a/(L+a)) * V_swap - (gas + 0.5*kappa*a^2) = 0',
    ],
    prohibitions: ['不使用预言机（防操纵）', '不在 EOA 上部署（需多签/时间锁）'],
    source: 'no_JIT: ProductionJITHook.sol + solver.py',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 7. 辅助计算函数
// ═══════════════════════════════════════════════════════════════════════════════

function computeEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function detectSwings(bars: PriceBar[]): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = 1; i < bars.length - 1; i++) {
    if (bars[i].high > bars[i - 1].high && bars[i].high > bars[i + 1].high) {
      highs.push(bars[i].high);
    }
    if (bars[i].low < bars[i - 1].low && bars[i].low < bars[i + 1].low) {
      lows.push(bars[i].low);
    }
  }
  return { highs, lows };
}

/** Robust normalization (AlphaGPT) */
export function robustNormalize(values: number[], clipRange: number = 5): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mad = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)];
  return values.map((v) => {
    const normalized = (v - median) / (mad + 1e-6);
    return Math.max(-clipRange, Math.min(clipRange, normalized));
  });
}

/** Ledoit-Wolf covariance shrinkage (cjquant) */
export function shrinkCovariance(returns: number[][]): number[][] {
  const n = returns.length;
  if (n === 0) return [];
  const p = returns[0].length;

  // Sample covariance
  const means = new Array(p).fill(0);
  for (const row of returns) row.forEach((v, j) => { means[j] += v; });
  means.forEach((_, j) => { means[j] /= n; });

  const cov = Array.from({ length: p }, () => new Array(p).fill(0));
  for (const row of returns) {
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        cov[i][j] += (row[i] - means[i]) * (row[j] - means[j]);
      }
    }
  }
  cov.forEach((row) => row.forEach((_, j) => { row[j] /= (n - 1); }));

  // Simplified shrinkage toward diagonal
  const trace = cov.reduce((s, row, i) => s + row[i], 0);
  const target = trace / p;
  const shrinkage = 0.1; // simplified Ledoit-Wolf

  const shrunk = cov.map((row, i) =>
    row.map((v, j) => i === j ? v * (1 - shrinkage) + target * shrinkage : v * (1 - shrinkage))
  );

  return shrunk;
}
