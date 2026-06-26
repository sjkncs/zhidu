'use client';

import React from 'react';
import {
  BookOpen,
  Briefcase,
  Plane,
  ChevronDown,
  ChevronUp,
  Check,
  Target,
} from 'lucide-react';
import { planningTemplates } from '@/data/planning-templates';
import type { PlanningTemplate } from '@/data/planning-templates';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PlanningTemplatesProps {
  onTemplateApplied?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  ACADEMIC: '学业',
  CAREER: '职业',
  LIFESTYLE: '生活',
  OTHER: '其他',
};

const CATEGORY_COLORS: Record<string, string> = {
  ACADEMIC: 'bg-blue/10 text-blue',
  CAREER: 'bg-green-500/10 text-green-600',
  LIFESTYLE: 'bg-purple-500/10 text-purple-600',
  OTHER: 'bg-gray-500/10 text-gray-500',
};

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-blue',
  5: 'bg-gray-400',
};

const ICON_MAP: Record<string, React.ElementType> = {
  BookOpen,
  Briefcase,
  Plane,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PlanningTemplates({ onTemplateApplied }: PlanningTemplatesProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [applyingId, setApplyingId] = React.useState<string | null>(null);
  const [appliedId, setAppliedId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const applyTemplate = async (template: PlanningTemplate) => {
    setApplyingId(template.id);
    setError(null);
    try {
      const goals = template.milestones.map((m) => ({
        title: m.title,
        description: m.description,
        category: m.category,
        priority: m.priority,
        deadline: m.suggestedDeadline,
      }));

      const res = await fetch('/api/career/goals/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals }),
      });
      if (!res.ok) throw new Error('导入模板失败');

      setAppliedId(template.id);
      onTemplateApplied?.();
    } catch (err: any) {
      setError(err.message || '导入失败，请重试');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* error banner */}
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setError(null)}
          >
            关闭
          </button>
        </div>
      )}

      {/* header */}
      <div>
        <h2 className="text-base font-semibold text-text-primary">规划模板</h2>
        <p className="mt-1 text-sm text-text-tertiary">
          选择一条适合你的发展路线，一键导入预设目标体系
        </p>
      </div>

      {/* template grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {planningTemplates.map((template) => {
          const IconComponent = ICON_MAP[template.icon] ?? Target;
          const isExpanded = expandedId === template.id;
          const isApplying = applyingId === template.id;
          const isApplied = appliedId === template.id;

          return (
            <div
              key={template.id}
              className="rounded-xl border border-border bg-surface hover:border-blue/20 transition-colors"
            >
              {/* card header */}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
                      <IconComponent className="h-5 w-5 text-blue" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">
                        {template.name}
                      </h3>
                      <p className="text-xs text-text-tertiary">
                        {template.duration}
                      </p>
                    </div>
                  </div>

                  {/* milestone count badge */}
                  <span className="inline-flex items-center rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-medium text-navy">
                    {template.milestones.length} 个里程碑
                  </span>
                </div>

                <p className="text-sm text-text-secondary leading-relaxed">
                  {template.description}
                </p>

                {/* action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => applyTemplate(template)}
                    disabled={isApplying || isApplied}
                    className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isApplying ? (
                      <>
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        导入中...
                      </>
                    ) : isApplied ? (
                      <>
                        <Check className="h-4 w-4" />
                        已导入
                      </>
                    ) : (
                      '使用此模板'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpand(template.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors inline-flex items-center gap-1"
                  >
                    {isExpanded ? '收起' : '查看详情'}
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* expanded milestone list */}
              {isExpanded && (
                <div className="border-t border-border px-5 py-4 space-y-3">
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
                    里程碑详情
                  </p>
                  <ol className="space-y-2.5">
                    {template.milestones.map((milestone, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 rounded-lg bg-background p-3"
                      >
                        {/* step number */}
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue/10 text-xs font-semibold text-blue">
                          {idx + 1}
                        </span>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">
                              {milestone.title}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                CATEGORY_COLORS[milestone.category] ??
                                CATEGORY_COLORS.OTHER
                              }`}
                            >
                              {CATEGORY_LABELS[milestone.category] ?? milestone.category}
                            </span>
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                PRIORITY_COLORS[milestone.priority] ?? 'bg-gray-400'
                              }`}
                              title={`优先级 ${milestone.priority}`}
                            />
                          </div>
                          <p className="text-xs text-text-tertiary leading-relaxed">
                            {milestone.description}
                          </p>
                          {milestone.suggestedDeadline && (
                            <p className="text-xs text-text-tertiary">
                              建议截止: {milestone.suggestedDeadline}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* fallback empty state if no templates loaded */}
      {planningTemplates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="h-12 w-12 text-text-tertiary mb-4" />
          <p className="text-sm font-medium text-text-secondary mb-1">
            暂无可用模板
          </p>
          <p className="text-xs text-text-tertiary max-w-xs">
            规划模板正在准备中，请稍后再来查看
          </p>
        </div>
      )}
    </div>
  );
}
