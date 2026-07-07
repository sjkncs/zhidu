'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Loader2,
  AlertCircle,
  RefreshCw,
  ClipboardList,
  CheckSquare,
  BarChart3,
  Clock,
  FileCheck,
  Target,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SOP {
  title: string;
  category: string;
  frequency: string;
  completionCount: number;
}

interface ChecklistItem {
  title: string;
  status: string;
  assignee: string;
}

interface KpiMetric {
  name: string;
  current: number;
  target: number;
  unit: string;
}

interface OpsData {
  sops: SOP[];
  checklist: ChecklistItem[];
  kpis: KpiMetric[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREQ_LABEL: Record<string, string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  quarterly: '每季度',
};

const CHECKLIST_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  in_progress: 'bg-blue/10 text-blue border-blue/30',
  completed: 'bg-green-500/10 text-green-600 border-green-500/30',
  overdue: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const CHECKLIST_STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  overdue: '已逾期',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Section: Active SOPs
// ---------------------------------------------------------------------------

function ActiveSopsSection({ sops }: { sops: SOP[] }) {
  if (sops.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <ClipboardList className="w-5 h-5 text-blue" />
          活跃 SOP
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <ClipboardList className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <ClipboardList className="w-5 h-5 text-blue" />
        活跃 SOP
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">标题</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">类别</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">频率</th>
              <th className="text-right font-medium text-text-tertiary pb-3">完成次数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sops.map((sop) => (
              <tr key={sop.title} className="hover:bg-surface-elevated transition-colors">
                <td className="py-3 pr-4 font-medium text-text-primary">{sop.title}</td>
                <td className="py-3 pr-4">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-blue/10 text-blue border-blue/30">
                    {sop.category}
                  </span>
                </td>
                <td className="py-3 pr-4 text-center text-text-secondary">
                  {FREQ_LABEL[sop.frequency] || sop.frequency}
                </td>
                <td className="py-3 text-right font-semibold text-text-primary">
                  {sop.completionCount}
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
// Section: Today's Checklist
// ---------------------------------------------------------------------------

function ChecklistSection({ items }: { items: ChecklistItem[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <CheckSquare className="w-5 h-5 text-blue" />
          今日清单
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <CheckSquare className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  const completedCount = items.filter((i) => i.status === 'completed').length;

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-blue" />
          今日清单
        </h2>
        <span className="text-sm text-text-tertiary">
          {completedCount} / {items.length} 已完成
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const style = CHECKLIST_STATUS_STYLE[item.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
          const label = CHECKLIST_STATUS_LABEL[item.status] || item.status;
          const isDone = item.status === 'completed';

          return (
            <div key={item.title} className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDone ? 'bg-green-500/10' : 'bg-blue/10'}`}>
                  {isDone ? (
                    <FileCheck className="h-4 w-4 text-green-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-blue" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDone ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-text-tertiary">{item.assignee}</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: KPI Dashboard
// ---------------------------------------------------------------------------

function KpiDashboardSection({ kpis }: { kpis: KpiMetric[] }) {
  if (kpis.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-blue" />
          KPI 看板
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
        KPI 看板
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => {
          const percent = kpi.target > 0 ? Math.min((kpi.current / kpi.target) * 100, 100) : 0;
          const isOnTrack = kpi.current >= kpi.target * 0.8;
          const barColor = isOnTrack ? 'bg-green-500' : 'bg-amber-500';

          return (
            <div key={kpi.name} className="rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-primary">{kpi.name}</span>
                <div className="flex items-center gap-1">
                  {isOnTrack ? (
                    <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-xl font-bold text-text-primary">{kpi.current}</span>
                <span className="text-xs text-text-tertiary">/ {kpi.target} {kpi.unit}</span>
              </div>
              <div
                className="h-2 w-full rounded-full bg-border/50 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${kpi.name} 达成率 ${percent.toFixed(1)}%`}
              >
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-xs text-text-tertiary mt-1.5">达成率 {percent.toFixed(1)}%</p>
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

export default function OpsSupportPage() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ops');
      if (!res.ok) throw new Error('获取营运支持信息失败');
      const json = await res.json();
      const raw = json.data ?? json;
      const sops = (raw.sops ?? []).map((s: any) => ({
        title: s.title ?? '', category: s.category ?? 'general', frequency: s.frequency ?? 'once',
        completionCount: s.completion_count ?? 0,
      }));
      const checklist = (raw.recentRuns ?? []).map((r: any) => ({
        title: `SOP #${(r.sop_id ?? '').slice(0, 8)}`, status: r.status ?? 'pending', assignee: r.run_date ?? '',
      }));
      const kpis = (raw.kpis ?? []).map((k: any) => ({
        name: k.metric_name ?? '', current: Number(k.metric_value) ?? 0, target: Number(k.target_value) ?? 0, unit: k.unit ?? '',
      }));
      setData({ sops, checklist, kpis });
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
            <Wrench className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">营运支持</h1>
            <p className="text-sm text-text-secondary">SOP、清单与 KPI 管理</p>
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
            <Wrench className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">营运支持</h1>
            <p className="text-sm text-text-secondary">SOP、清单与 KPI 管理</p>
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
          <Wrench className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">营运支持</h1>
          <p className="text-sm text-text-secondary">SOP、清单与 KPI 管理</p>
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

      <ActiveSopsSection sops={data?.sops ?? []} />
      <ChecklistSection items={data?.checklist ?? []} />
      <KpiDashboardSection kpis={data?.kpis ?? []} />
    </div>
  );
}
