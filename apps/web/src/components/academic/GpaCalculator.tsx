'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, Award, BookOpen, Target } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AcademicSummary {
  gpa: number;
  weightedAvg: number;
  totalCredits: number;
  earnedCredits: number;
  courseCount: number;
}

interface SemesterGpa {
  semester: string;
  gpa: number;
  weightedAvg: number;
  courseCount: number;
  totalCredits: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gpaLevel(gpa: number): { label: string; color: string } {
  if (gpa >= 3.7) return { label: '优秀', color: 'text-emerald-600' };
  if (gpa >= 3.0) return { label: '良好', color: 'text-blue' };
  if (gpa >= 2.0) return { label: '中等', color: 'text-amber-600' };
  if (gpa >= 1.0) return { label: '及格', color: 'text-orange-500' };
  return { label: '待提升', color: 'text-red-500' };
}

function gpaBarWidth(gpa: number): string {
  return `${(gpa / 4.0) * 100}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GpaCalculator() {
  const [summary, setSummary] = useState<AcademicSummary | null>(null);
  const [trend, setTrend] = useState<SemesterGpa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await fetch('/api/academic/summary');
        if (res.ok) {
          const json = await res.json();
          setSummary(json.data.summary);
          setTrend(json.data.gpaTrend ?? []);
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
  const level = gpaLevel(data.gpa);
  const maxTrendGpa = Math.max(...trend.map((t) => t.gpa), 4.0);

  return (
    <div className="space-y-6">
      {/* Main GPA display */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* GPA */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-text-tertiary" />
            <p className="text-xs font-medium text-text-tertiary">GPA (4.0 制)</p>
          </div>
          <p className={`mt-2 text-3xl font-bold ${data.courseCount > 0 ? level.color : 'text-text-tertiary'}`}>
            {data.gpa.toFixed(2)}
          </p>
          <div className="mt-2 h-2 w-full rounded-full bg-border">
            <div
              className="h-2 rounded-full bg-blue transition-all duration-500"
              style={{ width: gpaBarWidth(data.gpa) }}
            />
          </div>
          <p className="mt-1.5 text-xs text-text-secondary">
            {data.courseCount > 0 ? level.label : '暂无数据'}
          </p>
        </div>

        {/* Weighted avg */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-text-tertiary" />
            <p className="text-xs font-medium text-text-tertiary">加权平均分</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-text-primary">
            {data.weightedAvg.toFixed(1)}
          </p>
          <p className="mt-2 text-xs text-text-secondary">百分制加权</p>
        </div>

        {/* Total credits */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-text-tertiary" />
            <p className="text-xs font-medium text-text-tertiary">总学分</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-text-primary">
            {data.totalCredits}
          </p>
          <p className="mt-2 text-xs text-text-secondary">
            已修 {data.earnedCredits} 学分
          </p>
        </div>

        {/* Course count */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-text-tertiary" />
            <p className="text-xs font-medium text-text-tertiary">已录课程</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-text-primary">
            {data.courseCount}
          </p>
          <p className="mt-2 text-xs text-text-secondary">门课程</p>
        </div>
      </div>

      {/* Semester trend chart */}
      {trend.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">
            学期 GPA 趋势
          </h3>
          <div className="space-y-4">
            {trend.map((t) => {
              const tLevel = gpaLevel(t.gpa);
              return (
                <div key={t.semester} className="flex items-center gap-4">
                  <span className="w-32 shrink-0 truncate text-sm text-text-secondary">
                    {t.semester}
                  </span>
                  <div className="relative h-8 flex-1 rounded-lg bg-border/50">
                    <div
                      className="flex h-8 items-center rounded-lg bg-blue/15 transition-all duration-500"
                      style={{ width: `${(t.gpa / maxTrendGpa) * 100}%` }}
                    >
                      <span className="px-3 text-sm font-semibold text-blue">
                        {t.gpa.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    <span className={`text-xs font-medium ${tLevel.color}`}>
                      {tLevel.label}
                    </span>
                  </div>
                  <span className="hidden w-16 shrink-0 text-right text-xs text-text-tertiary sm:block">
                    {t.courseCount}门 / {t.totalCredits}学分
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <TrendingUp className="mx-auto mb-3 h-10 w-10 text-text-tertiary/40" />
          <p className="text-sm text-text-secondary">录入课程成绩后，GPA 趋势将在此显示</p>
        </div>
      )}

      {/* GPA reference table */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">
          绩点换算参考
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
          {[
            { range: '90-100', point: '4.0', level: '优秀' },
            { range: '85-89', point: '3.7', level: '良好' },
            { range: '78-84', point: '3.0-3.3', level: '中等' },
            { range: '60-77', point: '1.0-2.7', level: '及格' },
            { range: '<60', point: '0.0', level: '不及格' },
          ].map((item) => (
            <div
              key={item.range}
              className="rounded-lg bg-background p-3 text-center"
            >
              <p className="font-medium text-text-primary">{item.range}</p>
              <p className="mt-1 text-text-secondary">{item.point}</p>
              <p className="mt-0.5 text-text-tertiary">{item.level}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
