'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  BarChart3,
  PieChart,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryStat {
  category: string;
  count: number;
  totalCredits: number;
  avgGrade: number;
}

interface SemesterGpa {
  semester: string;
  gpa: number;
  weightedAvg: number;
  courseCount: number;
  totalCredits: number;
}

interface AcademicSummaryData {
  gpa: number;
  weightedAvg: number;
  totalCredits: number;
  earnedCredits: number;
  courseCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_GPA = 4.0;
const PERCENT = 100;
const MAX_RETRY = 2;
const RETRY_DELAY_MS = 1000;

const CATEGORY_COLORS: Record<string, string> = {
  '必修': '#2E75B6',
  '选修': '#10B981',
  '公选': '#F59E0B',
  '体育': '#EF4444',
  '通识': '#8B5CF6',
};

/**
 * Accessible hatching patterns (CSS repeating-linear-gradient) for progress
 * bar segments.  Each category gets a unique pattern overlaid on its color so
 * colorblind users can still distinguish segments visually.
 */
const CATEGORY_PATTERNS: Record<string, string> = {
  '必修': 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)',
  '选修': 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)',
  '公选': 'repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.12) 4px, rgba(255,255,255,0.12) 8px)',
  '体育': 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)',
  '通识': 'repeating-linear-gradient(60deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)',
};

const FALLBACK_COLORS = ['#6B7280', '#EC4899', '#14B8A6', '#F97316', '#06B6D4'];
const FALLBACK_PATTERNS = [
  'repeating-linear-gradient(120deg, transparent, transparent 3px, rgba(255,255,255,0.12) 3px, rgba(255,255,255,0.12) 6px)',
  'repeating-linear-gradient(30deg, transparent, transparent 4px, rgba(255,255,255,0.12) 4px, rgba(255,255,255,0.12) 8px)',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryColor(category: string, index: number): string {
  return CATEGORY_COLORS[category] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function getCategoryPattern(category: string, index: number): string {
  return CATEGORY_PATTERNS[category] ?? FALLBACK_PATTERNS[index % FALLBACK_PATTERNS.length];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AcademicSummaryView() {
  const [summary, setSummary] = useState<AcademicSummaryData | null>(null);
  const [trend, setTrend] = useState<SemesterGpa[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);

    for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
      try {
        const res = await fetch('/api/academic/summary', { signal });
        if (!res.ok) {
          throw new Error(`服务器返回 ${res.status}`);
        }
        const json = await res.json();
        setSummary(json.data.summary);
        setTrend(json.data.gpaTrend ?? []);
        setCategoryStats(json.data.categoryStats ?? []);
        return; // success
      } catch (err) {
        if (signal.aborted) return; // unmounted, bail silently
        console.error(`[AcademicSummary] 加载失败 (第${attempt + 1}次)`, err);
        if (attempt < MAX_RETRY) {
          await delay(RETRY_DELAY_MS * (attempt + 1)); // backoff
          if (signal.aborted) return;
        } else {
          const msg = err instanceof Error ? err.message : '加载学业数据失败';
          setError(msg);
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  // --- Retry handler -------------------------------------------------------
  const handleRetry = useCallback(() => {
    const controller = new AbortController();
    loadData(controller.signal);
  }, [loadData]);

  // --- Loading state -------------------------------------------------------
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  // --- Error state ---------------------------------------------------------
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-16 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-red-500/60" />
        <p className="text-sm font-medium text-text-primary">加载失败</p>
        <p className="mt-1 text-xs text-text-tertiary">{error}</p>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-xs font-medium text-white transition hover:bg-navy-light"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重试
        </button>
      </div>
    );
  }

  // --- Render --------------------------------------------------------------
  const data = summary ?? { gpa: 0, weightedAvg: 0, totalCredits: 0, earnedCredits: 0, courseCount: 0 };
  const hasData = data.courseCount > 0;
  const creditPct =
    data.totalCredits > 0
      ? Math.round((data.earnedCredits / data.totalCredits) * PERCENT)
      : 0;

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-medium text-text-tertiary">累计学分</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{data.totalCredits}</p>
          <p className="mt-1 text-xs text-text-secondary">已修 {data.earnedCredits} 学分</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-medium text-text-tertiary">课程总数</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{data.courseCount}</p>
          <p className="mt-1 text-xs text-text-secondary">门</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-medium text-text-tertiary">总 GPA</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{data.gpa.toFixed(2)}</p>
          <p className="mt-1 text-xs text-text-secondary">{MAX_GPA} 制</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-medium text-text-tertiary">加权均分</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{data.weightedAvg.toFixed(1)}</p>
          <p className="mt-1 text-xs text-text-secondary">百分制</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Category distribution */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-sm font-semibold text-text-primary">类别分布</h3>
          </div>
          {categoryStats.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <PieChart className="mb-2 h-8 w-8 text-text-tertiary/40" />
              <p className="text-xs text-text-tertiary">暂无数据</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Credit bar (accessible) */}
              <div
                className="flex h-4 w-full overflow-hidden rounded-full"
                role="img"
                aria-label="学分类别分布条形图"
              >
                {categoryStats.map((cat, i) => {
                  const pct =
                    cat.totalCredits > 0
                      ? (cat.totalCredits /
                          categoryStats.reduce((s, c) => s + c.totalCredits, 0)) *
                        PERCENT
                      : 0;
                  return (
                    <div
                      key={cat.category}
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: getCategoryColor(cat.category, i),
                        backgroundImage: getCategoryPattern(cat.category, i),
                      }}
                      title={`${cat.category}: ${cat.totalCredits}学分`}
                      aria-label={`${cat.category} ${cat.totalCredits}学分 ${pct.toFixed(0)}%`}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-2">
                {categoryStats.map((cat, i) => (
                  <div key={cat.category} className="flex items-center gap-2 rounded-lg bg-background p-2.5">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: getCategoryColor(cat.category, i),
                        backgroundImage: getCategoryPattern(cat.category, i),
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-text-primary">
                        {cat.category}
                      </p>
                      <p className="text-[10px] text-text-tertiary">
                        {cat.count}门 / {cat.totalCredits}学分
                        {cat.avgGrade > 0 && ` / 均分${cat.avgGrade}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Semester comparison */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-sm font-semibold text-text-primary">学期对比</h3>
          </div>
          {trend.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <BarChart3 className="mb-2 h-8 w-8 text-text-tertiary/40" />
              <p className="text-xs text-text-tertiary">暂无数据</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trend.map((t, i) => {
                const prevGpa = i > 0 ? trend[i - 1].gpa : null;
                const diff = prevGpa != null ? t.gpa - prevGpa : null;
                const barPct = (t.gpa / MAX_GPA) * PERCENT;
                return (
                  <div key={t.semester} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-xs text-text-secondary">
                      {t.semester}
                    </span>
                    <div
                      className="relative h-6 flex-1 rounded bg-border/50"
                      role="progressbar"
                      aria-valuenow={t.gpa}
                      aria-valuemin={0}
                      aria-valuemax={MAX_GPA}
                      aria-label={`${t.semester} GPA ${t.gpa.toFixed(2)}`}
                    >
                      <div
                        className="flex h-6 items-center rounded bg-blue/20 transition-all duration-500"
                        style={{ width: `${barPct}%` }}
                      >
                        <span className="px-2 text-xs font-semibold text-blue">
                          {t.gpa.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-text-tertiary">
                      {t.courseCount}门
                    </span>
                    {diff != null && (
                      <span className={`w-12 shrink-0 text-right text-xs font-medium ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-text-tertiary'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Progress summary */}
      {hasData && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-sm font-semibold text-text-primary">学业进度</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-background p-4 text-center">
              <p className="text-xs text-text-tertiary">学分完成率</p>
              <p className="mt-1 text-xl font-bold text-text-primary">{creditPct}%</p>
              <div
                className="mt-2 h-1.5 w-full rounded-full bg-border"
                role="progressbar"
                aria-valuenow={creditPct}
                aria-valuemin={0}
                aria-valuemax={PERCENT}
                aria-label={`学分完成率 ${creditPct}%`}
              >
                <div
                  className="h-1.5 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${creditPct}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg bg-background p-4 text-center">
              <p className="text-xs text-text-tertiary">最高学期 GPA</p>
              <p className="mt-1 text-xl font-bold text-text-primary">
                {trend.length > 0 ? Math.max(...trend.map((t) => t.gpa)).toFixed(2) : '-'}
              </p>
            </div>
            <div className="rounded-lg bg-background p-4 text-center">
              <p className="text-xs text-text-tertiary">单学期最多课程</p>
              <p className="mt-1 text-xl font-bold text-text-primary">
                {trend.length > 0 ? Math.max(...trend.map((t) => t.courseCount)) : '-'}
              </p>
              <p className="text-xs text-text-tertiary">门</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
