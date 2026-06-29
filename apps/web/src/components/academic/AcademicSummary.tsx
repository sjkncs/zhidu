'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, BarChart3, PieChart, TrendingUp } from 'lucide-react';

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

interface AcademicSummary {
  gpa: number;
  weightedAvg: number;
  totalCredits: number;
  earnedCredits: number;
  courseCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  '必修': '#2E75B6',
  '选修': '#10B981',
  '公选': '#F59E0B',
  '体育': '#EF4444',
  '通识': '#8B5CF6',
};

const FALLBACK_COLORS = ['#6B7280', '#EC4899', '#14B8A6', '#F97316', '#06B6D4'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryColor(category: string, index: number): string {
  return CATEGORY_COLORS[category] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AcademicSummaryView() {
  const [summary, setSummary] = useState<AcademicSummary | null>(null);
  const [trend, setTrend] = useState<SemesterGpa[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await fetch('/api/academic/summary');
        if (res.ok) {
          const json = await res.json();
          setSummary(json.data.summary);
          setTrend(json.data.gpaTrend ?? []);
          setCategoryStats(json.data.categoryStats ?? []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  const data = summary ?? { gpa: 0, weightedAvg: 0, totalCredits: 0, earnedCredits: 0, courseCount: 0 };
  const hasData = data.courseCount > 0;
  const totalCatCredits = categoryStats.reduce((sum, c) => sum + c.totalCredits, 0);

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
          <p className="mt-1 text-xs text-text-secondary">4.0 制</p>
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
              {/* Credit bar */}
              <div className="flex h-4 w-full overflow-hidden rounded-full">
                {categoryStats.map((cat, i) => (
                  <div
                    key={cat.category}
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${totalCatCredits > 0 ? (cat.totalCredits / totalCatCredits) * 100 : 0}%`,
                      backgroundColor: getCategoryColor(cat.category, i),
                    }}
                    title={`${cat.category}: ${cat.totalCredits}学分`}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-2">
                {categoryStats.map((cat, i) => (
                  <div key={cat.category} className="flex items-center gap-2 rounded-lg bg-background p-2.5">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: getCategoryColor(cat.category, i) }}
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
                return (
                  <div key={t.semester} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-xs text-text-secondary">
                      {t.semester}
                    </span>
                    <div className="relative h-6 flex-1 rounded bg-border/50">
                      <div
                        className="flex h-6 items-center rounded bg-blue/20 transition-all duration-500"
                        style={{ width: `${(t.gpa / 4.0) * 100}%` }}
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
              <p className="mt-1 text-xl font-bold text-text-primary">
                {data.totalCredits > 0 ? Math.round((data.earnedCredits / data.totalCredits) * 100) : 0}%
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-border">
                <div
                  className="h-1.5 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${data.totalCredits > 0 ? (data.earnedCredits / data.totalCredits) * 100 : 0}%` }}
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
