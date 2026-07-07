'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserCog,
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  Filter,
  BarChart3,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FunnelStep {
  label: string;
  value: number;
  conversionRate: number;
}

interface Cohort {
  name: string;
  userCount: number;
  retentionD1: number;
  retentionD7: number;
  retentionD30: number;
}

interface Segment {
  name: string;
  userCount: number;
  description: string;
}

interface UserOpsData {
  funnel: FunnelStep[];
  cohorts: Cohort[];
  segments: Segment[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEGMENT_COLORS = [
  'bg-blue/10 border-blue/30 text-blue',
  'bg-green-500/10 border-green-500/30 text-green-600',
  'bg-purple-500/10 border-purple-500/30 text-purple-500',
  'bg-amber-500/10 border-amber-500/30 text-amber-500',
  'bg-pink-500/10 border-pink-500/30 text-pink-500',
  'bg-cyan-500/10 border-cyan-500/30 text-cyan-500',
];

const FUNNEL_COLORS = [
  'bg-blue',
  'bg-blue/80',
  'bg-blue/60',
  'bg-blue/40',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getRetentionColor(rate: number): string {
  if (rate >= 50) return 'text-green-500';
  if (rate >= 30) return 'text-amber-500';
  return 'text-red-500';
}

// ---------------------------------------------------------------------------
// Section: Funnel Visualization
// ---------------------------------------------------------------------------

function FunnelSection({ steps }: { steps: FunnelStep[] }) {
  if (steps.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Filter className="w-5 h-5 text-blue" />
          转化漏斗
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Filter className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  const maxVal = Math.max(...steps.map((s) => s.value), 1);

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Filter className="w-5 h-5 text-blue" />
        转化漏斗
      </h2>
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const widthPercent = (step.value / maxVal) * 100;
          const barColor = FUNNEL_COLORS[idx % FUNNEL_COLORS.length];

          return (
            <div key={step.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue/10 text-xs font-semibold text-blue">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{step.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-text-primary">
                    {formatNumber(step.value)}
                  </span>
                  {idx > 0 && (
                    <span className="text-xs text-text-tertiary">
                      转化率 {step.conversionRate.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div
                className="h-8 w-full rounded-lg bg-border/30 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(widthPercent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${step.label} ${formatNumber(step.value)}`}
              >
                <div
                  className={`h-full rounded-lg transition-all ${barColor} flex items-center justify-end pr-3`}
                  style={{ width: `${Math.max(widthPercent, 5)}%` }}
                >
                  {widthPercent > 20 && (
                    <span className="text-xs font-medium text-white">
                      {((step.value / maxVal) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowRight className="w-3 h-3 text-text-tertiary rotate-90" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Cohort Table
// ---------------------------------------------------------------------------

function CohortSection({ cohorts }: { cohorts: Cohort[] }) {
  if (cohorts.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-blue" />
          留存分析
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <BarChart3 className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-blue" />
        留存分析
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">队列</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">用户数</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">次日留存 (D1)</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">7日留存 (D7)</th>
              <th className="text-center font-medium text-text-tertiary pb-3">30日留存 (D30)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {cohorts.map((c) => (
              <tr key={c.name} className="hover:bg-surface-elevated transition-colors">
                <td className="py-3 pr-4 font-medium text-text-primary">{c.name}</td>
                <td className="py-3 pr-4 text-right font-semibold text-text-primary">
                  {formatNumber(c.userCount)}
                </td>
                <td className={`py-3 pr-4 text-center font-semibold ${getRetentionColor(c.retentionD1)}`}>
                  {c.retentionD1.toFixed(1)}%
                </td>
                <td className={`py-3 pr-4 text-center font-semibold ${getRetentionColor(c.retentionD7)}`}>
                  {c.retentionD7.toFixed(1)}%
                </td>
                <td className={`py-3 text-center font-semibold ${getRetentionColor(c.retentionD30)}`}>
                  {c.retentionD30.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: User Segments
// ---------------------------------------------------------------------------

function SegmentsSection({ segments }: { segments: Segment[] }) {
  if (segments.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Users className="w-5 h-5 text-blue" />
          用户分群
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Users className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  const totalUsers = segments.reduce((sum, s) => sum + s.userCount, 0);

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Users className="w-5 h-5 text-blue" />
        用户分群
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((seg, idx) => {
          const colorStyle = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];
          const percent = totalUsers > 0 ? ((seg.userCount / totalUsers) * 100).toFixed(1) : '0';

          return (
            <div key={seg.name} className="rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorStyle}`}>
                  {seg.name}
                </span>
                <span className="text-xs text-text-tertiary">{percent}%</span>
              </div>
              <p className="text-xl font-bold text-text-primary mb-1">
                {formatNumber(seg.userCount)}
              </p>
              <p className="text-xs text-text-tertiary">{seg.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function UserOpsPage() {
  const [data, setData] = useState<UserOpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user-ops');
      if (!res.ok) throw new Error('获取用户运营信息失败');
      const json = await res.json();
      setData(json.data ?? json);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <UserCog className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">用户运营</h1>
            <p className="text-sm text-text-secondary">漏斗、留存与用户分群</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <UserCog className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">用户运营</h1>
            <p className="text-sm text-text-secondary">漏斗、留存与用户分群</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <AlertCircle className="w-10 h-10 mb-3 text-red-500 opacity-60" />
          <p className="text-sm text-text-secondary mb-1">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
          <UserCog className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">用户运营</h1>
          <p className="text-sm text-text-secondary">漏斗、留存与用户分群</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.04] px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span className="text-sm text-text-secondary">{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      )}

      <FunnelSection steps={data?.funnel ?? []} />
      <CohortSection cohorts={data?.cohorts ?? []} />
      <SegmentsSection segments={data?.segments ?? []} />
    </div>
  );
}
