'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Loader2,
  AlertCircle,
  RefreshCw,
  Target,
  Flag,
  Calendar,
  BarChart3,
  ChevronRight,
  CheckCircle2,
  Circle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KeyResult {
  title: string;
  progress: number;
  status: string;
}

interface Objective {
  title: string;
  keyResults: KeyResult[];
}

interface Milestone {
  title: string;
  dueDate: string;
  status: string;
}

interface StrategyData {
  objectives: Objective[];
  milestones: Milestone[];
  overallProgress: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KR_STATUS_STYLE: Record<string, string> = {
  on_track: 'bg-green-500/10 text-green-600 border-green-500/30',
  at_risk: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  behind: 'bg-red-500/10 text-red-500 border-red-500/30',
  completed: 'bg-blue/10 text-blue border-blue/30',
};

const KR_STATUS_LABEL: Record<string, string> = {
  on_track: '正常',
  at_risk: '风险',
  behind: '滞后',
  completed: '已完成',
};

const MS_STATUS_STYLE: Record<string, string> = {
  upcoming: 'bg-blue/10 text-blue border-blue/30',
  in_progress: 'bg-green-500/10 text-green-600 border-green-500/30',
  completed: 'bg-green-500/10 text-green-600 border-green-500/30',
  overdue: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const MS_STATUS_LABEL: Record<string, string> = {
  upcoming: '即将开始',
  in_progress: '进行中',
  completed: '已完成',
  overdue: '已逾期',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

// ---------------------------------------------------------------------------
// Section: Progress Summary
// ---------------------------------------------------------------------------

function ProgressSummary({ progress }: { progress: number }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center gap-4">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-border/50"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="text-blue transition-all"
            />
          </svg>
          <span className="absolute text-lg font-bold text-text-primary">
            {progress.toFixed(0)}%
          </span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">整体进度</h2>
          <p className="text-sm text-text-secondary mt-1">
            战略目标总体完成度
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: OKR Board
// ---------------------------------------------------------------------------

function OkrBoard({ objectives }: { objectives: Objective[] }) {
  if (objectives.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Target className="w-5 h-5 text-blue" />
          OKR 看板
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Target className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Target className="w-5 h-5 text-blue" />
        OKR 看板
      </h2>
      <div className="space-y-6">
        {objectives.map((obj) => {
          const avgProgress = obj.keyResults.length > 0
            ? obj.keyResults.reduce((sum, kr) => sum + kr.progress, 0) / obj.keyResults.length
            : 0;

          return (
            <div key={obj.title} className="rounded-lg border border-border bg-surface-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-blue" />
                  <h3 className="text-sm font-semibold text-text-primary">{obj.title}</h3>
                </div>
                <span className="text-sm font-medium text-text-secondary">
                  {avgProgress.toFixed(0)}%
                </span>
              </div>
              <div
                className="h-2 w-full rounded-full bg-border/50 overflow-hidden mb-4"
                role="progressbar"
                aria-valuenow={Math.round(avgProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`目标进度 ${avgProgress.toFixed(0)}%`}
              >
                <div
                  className="h-full rounded-full bg-blue transition-all"
                  style={{ width: `${Math.min(avgProgress, 100)}%` }}
                />
              </div>
              <div className="space-y-3">
                {obj.keyResults.map((kr) => {
                  const style = KR_STATUS_STYLE[kr.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
                  const label = KR_STATUS_LABEL[kr.status] || kr.status;
                  return (
                    <div key={kr.title} className="flex items-center gap-3">
                      {kr.progress >= 100 ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{kr.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="h-1.5 flex-1 rounded-full bg-border/50 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue/70 transition-all"
                              style={{ width: `${Math.min(kr.progress, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-tertiary w-8 text-right">
                            {kr.progress.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${style}`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Milestones Timeline
// ---------------------------------------------------------------------------

function MilestonesTimeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Calendar className="w-5 h-5 text-blue" />
          里程碑时间线
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Calendar className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Calendar className="w-5 h-5 text-blue" />
        里程碑时间线
      </h2>
      <div className="relative pl-6">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
        <div className="space-y-5">
          {milestones.map((ms) => {
            const style = MS_STATUS_STYLE[ms.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
            const label = MS_STATUS_LABEL[ms.status] || ms.status;
            const isDone = ms.status === 'completed';

            return (
              <div key={ms.title} className="relative flex items-start gap-4">
                {/* Timeline dot */}
                <div className={`absolute -left-6 top-1 h-[10px] w-[10px] rounded-full border-2 ${isDone ? 'border-green-500 bg-green-500' : 'border-blue bg-surface'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-medium ${isDone ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                      {ms.title}
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
                      {label}
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(ms.dueDate)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function StrategyPage() {
  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/strategy');
      if (!res.ok) throw new Error('获取战略信息失败');
      const json = await res.json();
      const raw = json.data ?? json;
      const objectives = (raw.objectives ?? []).map((o: any) => ({
        title: o.title,
        keyResults: (o.strat_key_results ?? []).map((kr: any) => ({
          title: kr.title, progress: kr.target_value > 0 ? Math.min((kr.current_value / kr.target_value) * 100, 100) : 0,
          status: kr.status ?? 'on_track',
        })),
      }));
      const milestones = (raw.milestones ?? []).map((m: any) => ({
        title: m.title, dueDate: m.due_date ?? '', status: m.status ?? 'pending',
      }));
      const overallProgress = objectives.length > 0
        ? objectives.reduce((s: number, o: any) => {
            const krs = o.keyResults ?? [];
            const avg = krs.length > 0 ? krs.reduce((sum: number, kr: any) => sum + kr.progress, 0) / krs.length : 0;
            return s + avg;
          }, 0) / objectives.length
        : 0;
      setData({ objectives, milestones, overallProgress });
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
            <Compass className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">战略中心</h1>
            <p className="text-sm text-text-secondary">OKR、里程碑与战略进度</p>
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
            <Compass className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">战略中心</h1>
            <p className="text-sm text-text-secondary">OKR、里程碑与战略进度</p>
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
          <Compass className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">战略中心</h1>
          <p className="text-sm text-text-secondary">OKR、里程碑与战略进度</p>
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

      <ProgressSummary progress={data?.overallProgress ?? 0} />
      <OkrBoard objectives={data?.objectives ?? []} />
      <MilestonesTimeline milestones={data?.milestones ?? []} />
    </div>
  );
}
