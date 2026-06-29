'use client';

import { MatchResult, VolunteerRecommendation } from '@zhidu/ai/volunteer-engine';
import { TrendingUp, Shield, AlertTriangle, Info } from 'lucide-react';

const tierConfig = {
  RUSH: { label: '冲一冲', color: 'text-red-500', bg: 'bg-red-500/10', icon: TrendingUp },
  STABLE: { label: '稳一稳', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Shield },
  SAFE: { label: '保一保', color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: Shield },
};

function ProbabilityBar({ probability }: { probability: number }) {
  const width = `${Math.max(3, probability)}%`;
  let barColor = 'bg-red-400';
  if (probability >= 75) barColor = 'bg-emerald-500';
  else if (probability >= 40) barColor = 'bg-amber-400';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${barColor}`} style={{ width }} />
      </div>
      <span className="text-xs font-medium tabular-nums text-text-secondary">
        {probability}%
      </span>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const styles: Record<string, string> = {
    high: 'bg-emerald-500/10 text-emerald-600',
    medium: 'bg-amber-500/10 text-amber-600',
    low: 'bg-red-500/10 text-red-500',
  };
  const labels: Record<string, string> = {
    high: '数据充足',
    medium: '数据一般',
    low: '数据不足',
  };

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[confidence] ?? styles.low}`}>
      {labels[confidence] ?? '未知'}
    </span>
  );
}

function MatchCard({ item }: { item: MatchResult }) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:bg-surface-elevated">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-primary">{item.universityName}</p>
          <p className="text-sm text-text-secondary">{item.majorName}</p>
          {item.note && (
            <p className="mt-0.5 text-xs text-text-tertiary">{item.note}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ProbabilityBar probability={item.probability} />
          <ConfidenceBadge confidence={item.confidence} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-tertiary">
        <span>历年最低: {item.historicalMinScore}分</span>
        {item.historicalMinRank && <span>最低位次: {item.historicalMinRank}</span>}
        {item.historicalAvgScore && <span>历年均分: {item.historicalAvgScore}</span>}
        {item.salaryInfo?.avgSalary && (
          <span className="text-emerald-600">
            参考薪资: {item.salaryInfo.avgSalary.toLocaleString()}元/月
          </span>
        )}
      </div>
    </div>
  );
}

export function VolunteerResultsPanel({ data }: { data: VolunteerRecommendation }) {
  const tiers: Array<{ key: 'rush' | 'stable' | 'safe'; items: MatchResult[] }> = [
    { key: 'rush', items: data.rush },
    { key: 'stable', items: data.stable },
    { key: 'safe', items: data.safe },
  ];

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Info className="h-4 w-4" />
          <span>
            共匹配 {data.summary.totalMatched} 个院校专业组合，
            参考 {data.summary.dataYears.join('/')} 年数据，
            考生位次 {data.rank?.toLocaleString() ?? '未知'}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {tiers.map(({ key, items }) => {
            const config = tierConfig[key.toUpperCase() as keyof typeof tierConfig];
            const Icon = config.icon;
            return (
              <div key={key} className={`rounded-lg ${config.bg} p-3 text-center`}>
                <Icon className={`mx-auto mb-1 h-5 w-5 ${config.color}`} />
                <p className={`text-lg font-bold ${config.color}`}>{items.length}</p>
                <p className="text-xs text-text-secondary">{config.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Results by tier */}
      {tiers.map(({ key, items }) => {
        if (items.length === 0) return null;
        const config = tierConfig[key.toUpperCase() as keyof typeof tierConfig];
        const Icon = config.icon;
        return (
          <div key={key}>
            <div className="mb-3 flex items-center gap-2">
              <Icon className={`h-4 w-4 ${config.color}`} />
              <h3 className={`text-sm font-semibold ${config.color}`}>
                {config.label}
              </h3>
              <span className="text-xs text-text-tertiary">({items.length} 个)</span>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <MatchCard
                  key={`${item.universityId}-${item.majorId}`}
                  item={item}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs text-text-tertiary">
          以上数据基于历年录取记录计算，仅供参考。实际录取受招生计划变动、考生志愿分布等因素影响，
          建议结合官方数据和专业老师指导做最终决策。
        </p>
      </div>
    </div>
  );
}
