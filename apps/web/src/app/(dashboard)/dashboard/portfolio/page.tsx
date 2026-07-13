'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  RefreshCw,
  PieChart,
  BarChart3,
  Plus,
  Search,
  Coins,
  FileDown,
  Brain,
  ArrowUpDown,
  Shield,
  Activity,
  DollarSign,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  FileText,
  History,
  Target,
} from 'lucide-react';
import FundPanel from '@/components/portfolio/FundPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Position {
  id: string;
  symbol: string;
  name: string;
  market: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  weight: number;
  ai_signal: string | null;
  sector?: string;
}

interface Portfolio {
  id: string;
  name: string;
  description?: string;
  market_type: string;
  currency: string;
  total_value: number;
  total_cost: number;
  total_return: number;
  return_pct: number;
  risk_level: string;
  positions: Position[];
}

interface AnalysisResult {
  gatePassed: boolean;
  gateReasons?: string[];
  confidence: number;
  decisionTrace: string[];
  decisionTraceFull?: {
    nodes: Array<{
      id: string;
      label: string;
      authority: string;
      finalValue: unknown;
      evidence: string;
    }>;
  };
  recommendations: string[];
  recommendationsDetail?: Array<{
    type: string;
    symbol: string;
    name: string;
    reason: string;
    urgency: string;
    targetWeight?: number;
    confidence: number;
    traceNodeId: string;
  }>;
  riskAssessment: string;
  portfolioAssessment?: {
    totalValue: number;
    totalCost: number;
    totalReturn: number;
    returnPct: number;
    sharpeRatio: number;
    maxDrawdown: number;
    diversification: number;
    riskLevel: string;
    marketConcentration: Record<string, number>;
    sectorConcentration: Record<string, number>;
  };
  positionSignals?: Array<{
    symbol: string;
    name: string;
    market: string;
    signal: {
      direction: string;
      signalScore: number;
      signals: Record<string, number>;
      confidence: number;
      tier: string;
    };
    kellyPosition: number;
    positionDeviation: number;
    action: string;
  }>;
  continuityCheck?: {
    passed: boolean;
    contradictions: Array<{ type: string; description: string; severity: string }>;
    suggestion: string;
    hintForLLM: string;
  };
  metrics: {
    totalPositions: number;
    avgPnlPercent: number;
    maxSingleWeight: number;
    marketDiversification: number;
    winRate: number;
  };
  behavioralBiases?: Array<{
    biasId: string;
    biasName: string;
    biasNameCN: string;
    severity: number;
    evidence: string;
    mitigation: string;
  }>;
  matchedStrategies?: Array<{
    id: string;
    name: string;
    nameCN: string;
    regime: string;
    rules: string[];
    prohibitions: string[];
  }>;
  timestamp: string;
}

interface HistoryRecord {
  id: string;
  created_at: string;
  gate_result: string;
  confidence: number;
  recommendation: unknown;
  raw_output: string;
}

type SortKey = 'symbol' | 'name' | 'market' | 'quantity' | 'avg_cost' | 'current_price' | 'unrealized_pnl' | 'unrealized_pnl_pct' | 'weight' | 'ai_signal';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIGNAL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  strong_buy: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-500', label: '强烈买入' },
  buy:        { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-500', label: '买入' },
  hold:       { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-500', label: '持有' },
  sell:       { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-500', label: '卖出' },
  strong_sell:{ bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-500', label: '强烈卖出' },
};

const RISK_LABELS: Record<string, { label: string; color: string }> = {
  conservative:     { label: '保守型', color: 'bg-green-500/10 text-green-500 border-green-500/30' },
  balanced:         { label: '均衡型', color: 'bg-blue/10 text-blue border-blue/30' },
  aggressive:       { label: '积极型', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  extreme:          { label: '激进型', color: 'bg-red-500/10 text-red-500 border-red-500/30' },
  very_aggressive:  { label: '激进型', color: 'bg-red-500/10 text-red-500 border-red-500/30' },
};

const ALLOCATION_COLORS = [
  '#2E75B6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899',
];

const MARKET_OPTIONS = ['A股', '港股', '美股', 'BTC', 'ETH', 'SOL', 'DeFi', 'other'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMoney(val: number): string {
  if (Math.abs(val) >= 10000) {
    return (val / 10000).toFixed(2) + '万';
  }
  return val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPrice(val: number): string {
  return val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Overview Cards
// ---------------------------------------------------------------------------

function OverviewCards({ portfolio }: { portfolio: Portfolio | null }) {
  if (!portfolio) return null;

  const isPositive = portfolio.total_return >= 0;
  const risk = RISK_LABELS[portfolio.risk_level] ?? RISK_LABELS.balanced;

  const cards = [
    {
      title: '总资产',
      value: `¥${formatMoney(portfolio.total_value)}`,
      subtitle: portfolio.return_pct >= 0
        ? `+${portfolio.return_pct.toFixed(2)}% 累计`
        : `${portfolio.return_pct.toFixed(2)}% 累计`,
      icon: DollarSign,
      iconColor: 'text-blue',
    },
    {
      title: '总收益',
      value: `${isPositive ? '+' : ''}¥${formatMoney(portfolio.total_return)}`,
      subtitle: `${isPositive ? '+' : ''}${portfolio.return_pct.toFixed(2)}%`,
      icon: isPositive ? TrendingUp : TrendingDown,
      iconColor: isPositive ? 'text-green-500' : 'text-red-500',
      valueColor: isPositive ? 'text-green-500' : 'text-red-500',
    },
    {
      title: '持仓数量',
      value: String(portfolio.positions?.length ?? 0),
      subtitle: `${portfolio.market_type} 组合`,
      icon: Activity,
      iconColor: 'text-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <section key={card.title} className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-text-secondary">{card.title}</span>
            <card.icon className={`w-4 h-4 ${card.iconColor}`} />
          </div>
          <div className={`text-2xl font-bold ${card.valueColor ?? 'text-text-primary'}`}>
            {card.value}
          </div>
          <p className={`text-xs mt-1 ${card.valueColor ?? 'text-text-tertiary'}`}>
            {card.subtitle}
          </p>
        </section>
      ))}

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-text-secondary">风险等级</span>
          <Shield className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-2xl font-bold text-text-primary mb-2">{risk.label}</div>
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${risk.color}`}>
          {risk.label}
        </span>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset Allocation Donut
// ---------------------------------------------------------------------------

function AllocationSection({ positions }: { positions: Position[] }) {
  const allocations = useMemo(() => {
    const marketMap = new Map<string, number>();
    const total = positions.reduce((s, p) => s + (p.market_value || p.current_price * p.quantity), 0);
    if (total === 0) return [];

    for (const p of positions) {
      const mv = p.market_value || p.current_price * p.quantity;
      marketMap.set(p.market, (marketMap.get(p.market) ?? 0) + mv);
    }

    return Array.from(marketMap.entries())
      .map(([label, value]) => ({ label, percent: (value / total) * 100 }))
      .sort((a, b) => b.percent - a.percent)
      .map((item, i) => ({ ...item, color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length] }));
  }, [positions]);

  const gradient = useMemo(() => {
    if (allocations.length === 0) return 'conic-gradient(#333 0% 100%)';
    let acc = 0;
    const stops = allocations.map((a) => {
      const start = acc;
      acc += a.percent;
      return `${a.color} ${start}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, [allocations]);

  if (positions.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <PieChart className="w-5 h-5 text-blue" />
        资产配置
      </h2>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
        <div className="relative flex-shrink-0">
          <div className="w-48 h-48 rounded-full" style={{ background: gradient }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-28 h-28 rounded-full bg-surface flex flex-col items-center justify-center">
              <span className="text-xs text-text-tertiary">配置</span>
              <span className="text-sm font-bold text-text-primary">{allocations.length} 类</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 min-w-[180px]">
          {allocations.map((a) => (
            <div key={a.label} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
              <span className="text-sm text-text-primary flex-1">{a.label}</span>
              <span className="text-sm font-semibold text-text-primary">{a.percent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Holdings Table
// ---------------------------------------------------------------------------

function HoldingsTable({ positions }: { positions: Position[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('weight');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = useMemo(() => {
    return [...positions].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [positions, sortKey, sortAsc]);

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: 'symbol', label: '代码' },
    { key: 'name', label: '名称' },
    { key: 'market', label: '市场' },
    { key: 'quantity', label: '数量', align: 'right' },
    { key: 'avg_cost', label: '均价', align: 'right' },
    { key: 'current_price', label: '现价', align: 'right' },
    { key: 'unrealized_pnl', label: '盈亏', align: 'right' },
    { key: 'unrealized_pnl_pct', label: '盈亏%', align: 'right' },
    { key: 'weight', label: '权重', align: 'right' },
    { key: 'ai_signal', label: 'AI 信号', align: 'center' },
  ];

  if (positions.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-blue" />
          持仓明细
        </h2>
        <div className="flex flex-col items-center py-10 text-text-tertiary">
          <BarChart3 className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无持仓数据</p>
          <p className="text-xs mt-1">点击下方「添加持仓」开始记录您的投资</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-blue" />
        持仓明细
      </h2>
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th key={col.key} className={`px-3 py-3 text-xs font-medium text-text-tertiary uppercase tracking-wider ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                  <button type="button" onClick={() => handleSort(col.key)} className="inline-flex items-center gap-1 hover:text-text-primary transition-colors">
                    {col.label}
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sorted.map((pos) => {
              const signal = SIGNAL_STYLES[pos.ai_signal ?? 'hold'] ?? SIGNAL_STYLES.hold;
              return (
                <tr key={pos.id} className="hover:bg-surface-elevated/50 transition-colors">
                  <td className="px-3 py-3 text-sm font-mono text-text-primary">{pos.symbol}</td>
                  <td className="px-3 py-3 text-sm text-text-primary font-medium">{pos.name}</td>
                  <td className="px-3 py-3 text-sm text-text-secondary">{pos.market}</td>
                  <td className="px-3 py-3 text-sm text-text-primary text-right tabular-nums">{pos.quantity.toLocaleString()}</td>
                  <td className="px-3 py-3 text-sm text-text-secondary text-right tabular-nums">{formatPrice(pos.avg_cost)}</td>
                  <td className="px-3 py-3 text-sm text-text-primary text-right tabular-nums font-medium">{formatPrice(pos.current_price)}</td>
                  <td className={`px-3 py-3 text-sm text-right tabular-nums font-medium ${pos.unrealized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {pos.unrealized_pnl >= 0 ? '+' : ''}{formatPrice(pos.unrealized_pnl)}
                  </td>
                  <td className={`px-3 py-3 text-sm text-right tabular-nums font-medium ${pos.unrealized_pnl_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {pos.unrealized_pnl_pct >= 0 ? '+' : ''}{pos.unrealized_pnl_pct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-3 text-sm text-text-secondary text-right tabular-nums">{pos.weight.toFixed(1)}%</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${signal.bg} ${signal.text}`}>
                      {signal.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Modal: Full Decision Trace Log
// ---------------------------------------------------------------------------

function DecisionTraceModal({ analysis, onClose }: { analysis: AnalysisResult | null; onClose: () => void }) {
  if (!analysis) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[80vh] rounded-xl border border-border bg-surface shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue" />
            完整决策追踪日志
          </h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Gate */}
          <div className={`rounded-lg border p-3 ${analysis.gatePassed ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold ${analysis.gatePassed ? 'text-green-500' : 'text-red-500'}`}>
                {analysis.gatePassed ? '✅ Gate 通过' : '❌ Gate 未通过'}
              </span>
              <span className="text-xs text-text-tertiary">{new Date(analysis.timestamp).toLocaleString('zh-CN')}</span>
            </div>
            {analysis.gateReasons && analysis.gateReasons.length > 0 && (
              <p className="text-xs text-text-secondary">{analysis.gateReasons.join('; ')}</p>
            )}
          </div>

          {/* Confidence */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">总体置信度</span>
              <span className="text-sm font-bold text-blue">{(analysis.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-border/50 overflow-hidden">
              <div className="h-full rounded-full bg-blue transition-all" style={{ width: `${analysis.confidence * 100}%` }} />
            </div>
          </div>

          {/* Decision nodes */}
          {analysis.decisionTraceFull?.nodes && (
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2">决策节点</h4>
              <div className="space-y-2">
                {analysis.decisionTraceFull.nodes.map((node) => {
                  const authIcon = node.authority === 'locked' ? '🔒' : node.authority === 'overridable' ? '🔓' : '🤖';
                  return (
                    <div key={node.id} className="rounded-lg border border-border bg-surface-elevated/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{authIcon}</span>
                        <span className="text-sm font-medium text-text-primary">{node.label}</span>
                        <span className="text-xs text-text-tertiary ml-auto">{node.authority}</span>
                      </div>
                      <p className="text-xs text-text-secondary mb-1">
                        值: {typeof node.finalValue === 'object' ? JSON.stringify(node.finalValue) : String(node.finalValue)}
                      </p>
                      <p className="text-xs text-text-tertiary">依据: {node.evidence}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Decision trace text */}
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-2">追踪步骤</h4>
            <div className="space-y-1.5">
              {analysis.decisionTrace.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue/10 text-blue text-xs flex items-center justify-center font-medium mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Position signals */}
          {analysis.positionSignals && analysis.positionSignals.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2">个券信号明细</h4>
              <div className="space-y-2">
                {analysis.positionSignals.map((ps) => {
                  const scoreStr = ps.signal.signalScore > 0 ? `+${ps.signal.signalScore}` : `${ps.signal.signalScore}`;
                  const dirColor = ps.signal.direction === 'bullish' ? 'text-green-500'
                    : ps.signal.direction === 'bearish' ? 'text-red-500' : 'text-amber-500';
                  return (
                    <div key={ps.symbol} className="rounded-lg border border-border bg-surface-elevated/30 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-text-primary">{ps.name}（{ps.symbol}）</span>
                        <span className={`text-xs font-bold ${dirColor}`}>{ps.signal.direction} ({scoreStr})</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-text-tertiary">
                        <div>操作建议: {ps.signal.tier}</div>
                        <div>置信度: {(ps.signal.confidence * 100).toFixed(0)}%</div>
                        <div>Kelly 建议: {ps.kellyPosition.toFixed(1)}%</div>
                        <div>当前偏差: {ps.positionDeviation > 0 ? '+' : ''}{ps.positionDeviation.toFixed(1)}%</div>
                      </div>
                      <div className="mt-2 text-xs text-text-tertiary">
                        5-Signal: {Object.entries(ps.signal.signals).map(([k, v]) => `${k}:${v > 0 ? '+' : ''}${v}`).join(' | ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Continuity */}
          {analysis.continuityCheck && (
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2">连续性守卫</h4>
              <div className={`rounded-lg border p-3 ${analysis.continuityCheck.passed ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <p className="text-xs text-text-secondary">
                  状态: {analysis.continuityCheck.passed ? '✅ 通过' : '❌ 被阻止'} | 建议: {analysis.continuityCheck.suggestion}
                </p>
                {analysis.continuityCheck.contradictions.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {analysis.continuityCheck.contradictions.map((c, i) => (
                      <p key={i} className="text-xs text-text-tertiary">- [{c.severity}] {c.description}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 投资行为学偏差检测 */}
          {analysis.behavioralBiases && analysis.behavioralBiases.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2">⚠️ 投资行为偏差检测</h4>
              <div className="space-y-2">
                {analysis.behavioralBiases.map((bias) => (
                  <div key={bias.biasId} className={`rounded-lg border p-3 ${
                    bias.severity > 0.6 ? 'border-red-500/30 bg-red-500/5' :
                    bias.severity > 0.3 ? 'border-amber-500/30 bg-amber-500/5' :
                    'border-border bg-surface-elevated/30'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-text-primary">{bias.biasNameCN}</span>
                      <span className={`text-xs font-medium ${
                        bias.severity > 0.6 ? 'text-red-500' : bias.severity > 0.3 ? 'text-amber-500' : 'text-text-tertiary'
                      }`}>
                        严重度 {(bias.severity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mb-1">{bias.evidence}</p>
                    <p className="text-xs text-blue">💡 {bias.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 匹配策略模板 */}
          {analysis.matchedStrategies && analysis.matchedStrategies.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2">📋 匹配策略模板</h4>
              <div className="space-y-2">
                {analysis.matchedStrategies.map((strat) => (
                  <div key={strat.id} className="rounded-lg border border-border bg-surface-elevated/30 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-text-primary">{strat.nameCN}</span>
                      <span className="text-xs text-text-tertiary px-2 py-0.5 rounded bg-surface-elevated">{strat.regime}</span>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-text-tertiary mb-1">核心规则:</p>
                      {strat.rules.slice(0, 3).map((rule, i) => (
                        <p key={i} className="text-xs text-text-secondary ml-2">• {rule}</p>
                      ))}
                    </div>
                    {strat.prohibitions.length > 0 && (
                      <div className="mt-1">
                        <p className="text-xs text-red-500/80 mb-0.5">禁止行为:</p>
                        {strat.prohibitions.map((p, i) => (
                          <p key={i} className="text-xs text-text-tertiary ml-2">✗ {p}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: Rebalance Report
// ---------------------------------------------------------------------------

function RebalanceReportModal({ analysis, onClose }: { analysis: AnalysisResult | null; onClose: () => void }) {
  if (!analysis) return null;

  const recs = analysis.recommendationsDetail ?? [];
  const pa = analysis.portfolioAssessment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[80vh] rounded-xl border border-border bg-surface shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Target className="w-5 h-5 text-blue" />
            可视化调仓建议报告
          </h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Portfolio metrics */}
          {pa && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '夏普比率', value: pa.sharpeRatio.toFixed(2), color: pa.sharpeRatio >= 1 ? 'text-green-500' : 'text-amber-500' },
                { label: '最大回撤', value: `${pa.maxDrawdown.toFixed(1)}%`, color: pa.maxDrawdown < 10 ? 'text-green-500' : 'text-red-500' },
                { label: '分散度', value: `${(pa.diversification * 100).toFixed(0)}%`, color: pa.diversification > 0.6 ? 'text-green-500' : 'text-amber-500' },
                { label: '风险等级', value: pa.riskLevel, color: 'text-text-primary' },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-border bg-surface-elevated/30 p-3 text-center">
                  <p className="text-xs text-text-tertiary mb-1">{m.label}</p>
                  <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {recs.length > 0 ? (
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-3">调仓建议（{recs.length} 条）</h4>
              <div className="space-y-3">
                {recs.map((rec, i) => {
                  const urgencyConfig = {
                    immediate: { border: 'border-red-500/30', bg: 'bg-red-500/5', badge: '🔴 立即执行', badgeColor: 'text-red-500' },
                    soon: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', badge: '🟡 近期执行', badgeColor: 'text-amber-500' },
                    optional: { border: 'border-border', bg: '', badge: '🟢 可选', badgeColor: 'text-text-tertiary' },
                  };
                  const cfg = urgencyConfig[rec.urgency as keyof typeof urgencyConfig] ?? urgencyConfig.optional;
                  return (
                    <div key={i} className={`rounded-lg border ${cfg.border} ${cfg.bg} p-4`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-primary uppercase px-2 py-0.5 rounded bg-surface-elevated">
                            {rec.type}
                          </span>
                          <span className="text-sm font-medium text-text-primary">{rec.name}（{rec.symbol}）</span>
                        </div>
                        <span className={`text-xs font-medium ${cfg.badgeColor}`}>{cfg.badge}</span>
                      </div>
                      <p className="text-sm text-text-secondary mb-2">{rec.reason}</p>
                      <div className="flex items-center gap-4 text-xs text-text-tertiary">
                        {rec.targetWeight !== undefined && (
                          <span>目标仓位: <span className="text-blue font-medium">{rec.targetWeight.toFixed(1)}%</span></span>
                        )}
                        <span>置信度: {(rec.confidence * 100).toFixed(0)}%</span>
                        <span>溯源: {rec.traceNodeId}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-text-tertiary">
              <Check className="w-10 h-10 mb-3 text-green-500 opacity-60" />
              <p className="text-sm">当前组合状态良好，暂无调仓建议</p>
            </div>
          )}

          {/* Market concentration */}
          {pa && Object.keys(pa.marketConcentration).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2">市场集中度</h4>
              <div className="space-y-2">
                {Object.entries(pa.marketConcentration).map(([market, pct]) => (
                  <div key={market} className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary w-16">{market}</span>
                    <div className="flex-1 h-2 rounded-full bg-border/50 overflow-hidden">
                      <div className="h-full rounded-full bg-blue" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <span className="text-xs text-text-primary font-medium w-12 text-right">{pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk assessment */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-4">
            <h4 className="text-sm font-medium text-amber-500 mb-1">风险评估总结</h4>
            <p className="text-sm text-text-secondary">{analysis.riskAssessment}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: History Comparison
// ---------------------------------------------------------------------------

function HistoryModal({ portfolioId, onClose }: { portfolioId: string; onClose: () => void }) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/portfolio/history?portfolioId=${portfolioId}`);
        if (res.ok) {
          const json = await res.json();
          setRecords(json.records ?? []);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [portfolioId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[80vh] rounded-xl border border-border bg-surface shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <History className="w-5 h-5 text-blue" />
            历史分析记录
          </h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-text-tertiary">
              <History className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">暂无历史分析记录</p>
              <p className="text-xs mt-1">每次运行 AI 诊断后会自动保存</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((rec) => (
                <div key={rec.id} className="rounded-lg border border-border bg-surface-elevated/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-primary">
                      {new Date(rec.created_at).toLocaleString('zh-CN')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                        rec.gate_result === 'proceed'
                          ? 'bg-green-500/10 text-green-500 border-green-500/30'
                          : 'bg-red-500/10 text-red-500 border-red-500/30'
                      }`}>
                        {rec.gate_result === 'proceed' ? '通过' : '未通过'}
                      </span>
                      <span className="text-xs text-blue font-medium">
                        {(rec.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {rec.raw_output && (
                    <p className="text-xs text-text-tertiary line-clamp-2">{rec.raw_output.substring(0, 200)}...</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Analysis Panel
// ---------------------------------------------------------------------------

function AIAnalysisPanel({
  portfolioId,
  hasPositions,
  onAnalysisComplete,
}: {
  portfolioId: string | null;
  hasPositions: boolean;
  onAnalysisComplete: (result: AnalysisResult) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!portfolioId) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await fetch('/api/portfolio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId }),
      });
      if (!res.ok) throw new Error('分析请求失败');
      const json = await res.json();
      const data = json.data;
      setResult(data);
      onAnalysisComplete(data);
    } catch (err) {
      console.error('AI 分析失败:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue" />
          AI 诊断
        </h2>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={analyzing || !hasPositions}
          className="flex items-center gap-1.5 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? (
            <><Loader2 className="w-4 h-4 animate-spin" />分析中...</>
          ) : (
            <><Brain className="w-4 h-4" />AI 诊断</>
          )}
        </button>
      </div>

      {!result && !analyzing && (
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Brain className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">{hasPositions ? '点击 "AI 诊断" 开始智能分析您的投资组合' : '添加持仓后可运行 AI 诊断'}</p>
        </div>
      )}

      {analyzing && (
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue" />
          <p className="text-sm">PortfolioAgent 正在执行三阶段分析流水线...</p>
          <p className="text-xs text-text-tertiary mt-1">Gate Check → 5-Signal Voting → Kelly Sizing → Validation</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              result.gatePassed ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'
            }`}>
              {result.gatePassed ? 'Gate 通过' : 'Gate 未通过'}
            </span>
            <span className="text-xs text-text-tertiary">{new Date(result.timestamp).toLocaleString('zh-CN')}</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-text-primary">置信度</span>
              <span className="text-sm font-bold text-blue">{(result.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-border/50 overflow-hidden">
              <div className="h-full rounded-full bg-blue transition-all" style={{ width: `${result.confidence * 100}%` }} />
            </div>
          </div>

          {result.recommendations && result.recommendations.length > 0 && (
            <div className="space-y-2">
              {result.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="rounded-lg border border-border bg-surface-elevated/30 p-3">
                  <p className="text-sm text-text-secondary">{rec}</p>
                </div>
              ))}
            </div>
          )}

          {result.portfolioAssessment && (
            <div className="grid grid-cols-3 gap-2 text-xs text-text-tertiary">
              <div>夏普: {result.portfolioAssessment.sharpeRatio.toFixed(2)}</div>
              <div>回撤: {result.portfolioAssessment.maxDrawdown.toFixed(1)}%</div>
              <div>分散度: {(result.portfolioAssessment.diversification * 100).toFixed(0)}%</div>
            </div>
          )}

          {/* 行为偏差快速提醒 */}
          {result.behavioralBiases && result.behavioralBiases.length > 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
              <h4 className="text-xs font-medium text-amber-500 mb-1.5">⚠️ 行为偏差提醒（{result.behavioralBiases.length} 项）</h4>
              {result.behavioralBiases.slice(0, 2).map((bias) => (
                <p key={bias.biasId} className="text-xs text-text-secondary mt-1">
                  <span className="font-medium">{bias.biasNameCN}</span>: {bias.evidence}
                </p>
              ))}
              {result.behavioralBiases.length > 2 && (
                <p className="text-xs text-text-tertiary mt-1">还有 {result.behavioralBiases.length - 2} 项，详见决策追踪日志</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Add Position Modal
// ---------------------------------------------------------------------------

function AddPositionModal({ portfolioId, onClose, onAdded }: { portfolioId: string; onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ symbol: '', name: '', market: 'A股', quantity: '', avgCost: '', currentPrice: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/portfolio/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          symbol: form.symbol.trim(),
          name: form.name.trim() || form.symbol.trim(),
          market: form.market,
          quantity: parseFloat(form.quantity),
          avgCost: parseFloat(form.avgCost),
          currentPrice: parseFloat(form.currentPrice) || parseFloat(form.avgCost),
        }),
      });
      if (!res.ok) throw new Error('添加失败');
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || '添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">添加持仓</h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1">代码 *</label>
              <input type="text" required value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary" placeholder="如 600519.SH" />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">名称 *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary" placeholder="如 贵州茅台" />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">市场 *</label>
            <select value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary">
              {MARKET_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1">数量 *</label>
              <input type="number" required min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary" />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">均价 *</label>
              <input type="number" required min="0" step="any" value={form.avgCost} onChange={(e) => setForm({ ...form, avgCost: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary" />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">现价</label>
              <input type="number" min="0" step="any" value={form.currentPrice} onChange={(e) => setForm({ ...form, currentPrice: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary" />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-elevated">取消</button>
            <button type="submit" disabled={submitting} className="flex items-center gap-1.5 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue/90 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}添加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Portfolio Modal
// ---------------------------------------------------------------------------

function CreatePortfolioModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ name: '', marketType: 'mixed', riskLevel: 'balanced' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, marketType: form.marketType, riskLevel: form.riskLevel }),
      });
      if (!res.ok) throw new Error('创建失败');
      const json = await res.json();
      onCreated(json.portfolio.id);
      onClose();
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">创建投资组合</h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">组合名称 *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary" placeholder="如 我的成长组合" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1">市场类型</label>
              <select value={form.marketType} onChange={(e) => setForm({ ...form, marketType: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary">
                <option value="mixed">混合</option><option value="stock">股票</option><option value="crypto">加密货币</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">风险偏好</label>
              <select value={form.riskLevel} onChange={(e) => setForm({ ...form, riskLevel: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary">
                <option value="conservative">保守型</option><option value="balanced">均衡型</option>
                <option value="aggressive">积极型</option><option value="extreme">激进型</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-elevated">取消</button>
            <button type="submit" disabled={submitting} className="flex items-center gap-1.5 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue/90 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PortfolioPage() {
  const pathname = usePathname();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const fetchCountRef = useRef(0);

  const fetchPortfolio = useCallback(async () => {
    const fetchId = ++fetchCountRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portfolio');
      if (!res.ok) {
        if (res.status === 404 || res.status === 401) {
          setPortfolio(null);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      // Guard against stale responses
      if (fetchId !== fetchCountRef.current) return;

      const portfolios = json.portfolios ?? [];
      if (portfolios.length > 0) {
        const p = portfolios[0];
        const positions: Position[] = (p.positions ?? []).map((pos: any) => {
          const mv = Number(pos.market_value ?? 0) || Number(pos.current_price ?? 0) * Number(pos.quantity ?? 0);
          const cost = Number(pos.avg_cost ?? 0) * Number(pos.quantity ?? 0);
          const pnl = Number(pos.unrealized_pnl ?? 0) || (mv - cost);
          const pnlPct = Number(pos.unrealized_pnl_pct ?? 0) || (cost > 0 ? ((mv - cost) / cost) * 100 : 0);
          return { ...pos, market_value: mv, unrealized_pnl: pnl, unrealized_pnl_pct: pnlPct, weight: Number(pos.weight ?? 0) };
        });

        const totalValue = positions.reduce((s, p) => s + (p.market_value || p.current_price * p.quantity), 0);
        const totalCost = positions.reduce((s, p) => s + (p.avg_cost * p.quantity), 0);
        const totalReturn = totalValue - totalCost;
        const returnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

        for (const pos of positions) {
          const mv = pos.market_value || pos.current_price * pos.quantity;
          pos.weight = totalValue > 0 ? (mv / totalValue) * 100 : 0;
        }

        setPortfolio({ ...p, positions, total_value: totalValue, total_cost: totalCost, total_return: totalReturn, return_pct: returnPct });
      } else {
        setPortfolio(null);
      }
    } catch (err: any) {
      if (fetchId !== fetchCountRef.current) return;
      setError(err.message || '加载失败');
    } finally {
      if (fetchId === fetchCountRef.current) setLoading(false);
    }
  }, []);

  // Fetch on mount and when pathname changes (client-side navigation)
  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio, pathname]);

  const positions = portfolio?.positions ?? [];

  // ─── Empty State ──────────────────────────────────────────────────
  if (!loading && !portfolio && !error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
            <TrendingUp className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">资管</h1>
            <p className="text-sm text-text-secondary">AI驱动的投资组合管理与量化分析</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <PieChart className="w-16 h-16 mb-4 opacity-30" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">开始您的投资之旅</h2>
          <p className="text-sm mb-6 text-center max-w-md">创建您的第一个投资组合，AI 将帮助您进行科学的资产配置和风险管理</p>
          <button onClick={() => setShowCreatePortfolio(true)} className="flex items-center gap-2 rounded-lg bg-blue px-6 py-3 text-sm font-medium text-white hover:bg-blue/90">
            <Plus className="w-5 h-5" />创建投资组合
          </button>
        </div>
        {showCreatePortfolio && <CreatePortfolioModal onClose={() => setShowCreatePortfolio(false)} onCreated={() => fetchPortfolio()} />}
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
            <TrendingUp className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">资管</h1>
            <p className="text-sm text-text-secondary">AI驱动的投资组合管理与量化分析</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
            <TrendingUp className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">资管</h1>
            <p className="text-sm text-text-secondary">AI驱动的投资组合管理与量化分析</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <AlertCircle className="w-10 h-10 mb-3 text-red-500 opacity-60" />
          <p className="text-sm text-text-secondary mb-1">{error}</p>
          <button onClick={fetchPortfolio} className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/20">
            <RefreshCw className="h-3.5 w-3.5" />重试
          </button>
        </div>
      </div>
    );
  }

  // ─── Main View ────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
            <TrendingUp className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{portfolio?.name ?? '资管'}</h1>
            <p className="text-sm text-text-secondary">AI驱动的投资组合管理与量化分析</p>
          </div>
        </div>
        <button onClick={fetchPortfolio} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-elevated">
          <RefreshCw className="w-3.5 h-3.5" />刷新
        </button>
      </div>

      <FundPanel />

      <OverviewCards portfolio={portfolio} />
      <AllocationSection positions={positions} />
      <HoldingsTable positions={positions} />
      <AIAnalysisPanel
        portfolioId={portfolio?.id ?? null}
        hasPositions={positions.length > 0}
        onAnalysisComplete={(r) => setLastAnalysis(r)}
      />

      {/* Quick Actions + 3 new features */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Activity className="w-5 h-5 text-blue" />
          快捷操作
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { icon: Plus, label: '添加持仓', color: 'bg-blue hover:bg-blue/90 text-white', onClick: () => setShowAddPosition(true) },
            { icon: FileText, label: '决策追踪日志', color: 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 border border-indigo-500/30', onClick: () => setShowTraceModal(true) },
            { icon: Target, label: '调仓建议报告', color: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 border border-purple-500/30', onClick: () => setShowReportModal(true) },
            { icon: History, label: '历史分析对比', color: 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 border border-cyan-500/30', onClick: () => setShowHistoryModal(true) },
            { icon: Search, label: 'AI 选股', color: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30', onClick: () => {} },
            { icon: Coins, label: 'DeFi 收益', color: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30', onClick: () => {} },
            { icon: FileDown, label: '导出报告', color: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30', onClick: () => {} },
          ].map((action) => (
            <button key={action.label} type="button" onClick={action.onClick} className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-colors ${action.color}`}>
              <action.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Modals */}
      {showAddPosition && portfolio && (
        <AddPositionModal portfolioId={portfolio.id} onClose={() => setShowAddPosition(false)} onAdded={fetchPortfolio} />
      )}
      {showTraceModal && <DecisionTraceModal analysis={lastAnalysis} onClose={() => setShowTraceModal(false)} />}
      {showReportModal && <RebalanceReportModal analysis={lastAnalysis} onClose={() => setShowReportModal(false)} />}
      {showHistoryModal && portfolio && <HistoryModal portfolioId={portfolio.id} onClose={() => setShowHistoryModal(false)} />}
    </div>
  );
}
