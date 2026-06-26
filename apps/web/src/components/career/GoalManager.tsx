'use client';

import React from 'react';
import {
  Target,
  ChevronRight,
  ChevronDown,
  Trash2,
  Plus,
  Loader2,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GoalRow {
  id: string;
  parentGoalId: string | null;
  title: string;
  description: string | null;
  category: 'ACADEMIC' | 'CAREER' | 'LIFESTYLE' | 'OTHER';
  priority: number;
  completed: boolean;
  deadline: string | null;
  depth: number;
  sortOrder: number;
  careerPathId: string | null;
  createdAt: string;
}

export interface GoalManagerProps {
  refreshKey?: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<GoalRow['category'], string> = {
  ACADEMIC: '学业',
  CAREER: '职业',
  LIFESTYLE: '生活',
  OTHER: '其他',
};

const CATEGORY_COLORS: Record<GoalRow['category'], string> = {
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

type CategoryFilter = GoalRow['category'] | 'ALL';
type CompletionFilter = 'ALL' | 'COMPLETED' | 'INCOMPLETE';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GoalManager({ refreshKey }: GoalManagerProps) {
  /* ---- state ---- */
  const [goals, setGoals] = React.useState<GoalRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>('ALL');
  const [completionFilter, setCompletionFilter] = React.useState<CompletionFilter>('ALL');

  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  /* new-goal form */
  const [showForm, setShowForm] = React.useState(false);
  const [formTitle, setFormTitle] = React.useState('');
  const [formCategory, setFormCategory] = React.useState<GoalRow['category']>('ACADEMIC');
  const [formPriority, setFormPriority] = React.useState(3);
  const [formDeadline, setFormDeadline] = React.useState('');
  const [formParentId, setFormParentId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  /* ---- fetch ---- */
  const fetchGoals = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (completionFilter === 'COMPLETED') params.set('completed', 'true');
      if (completionFilter === 'INCOMPLETE') params.set('completed', 'false');

      const res = await fetch(`/api/career/goals?${params.toString()}`);
      if (!res.ok) throw new Error('获取目标失败');
      const json = await res.json();
      setGoals(json.data ?? []);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, completionFilter]);

  React.useEffect(() => {
    fetchGoals();
  }, [fetchGoals, refreshKey]);

  /* ---- helpers ---- */
  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCompleted = async (goal: GoalRow) => {
    try {
      const res = await fetch(`/api/career/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !goal.completed }),
      });
      if (!res.ok) throw new Error('更新失败');
      setGoals((prev) =>
        prev.map((g) => (g.id === goal.id ? { ...g, completed: !g.completed } : g)),
      );
    } catch (err: any) {
      setError(err.message || '操作失败');
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      const res = await fetch(`/api/career/goals/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      setGoals((prev) => prev.filter((g) => g.id !== id && g.parentGoalId !== id));
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        title: formTitle.trim(),
        category: formCategory,
        priority: formPriority,
      };
      if (formDeadline) body.deadline = formDeadline;
      if (formParentId) body.parentGoalId = formParentId;

      const res = await fetch('/api/career/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('创建目标失败');

      /* reset form */
      setFormTitle('');
      setFormPriority(3);
      setFormDeadline('');
      setFormParentId(null);
      setShowForm(false);
      await fetchGoals();
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openSubGoalForm = (parentId: string) => {
    setFormParentId(parentId);
    setShowForm(true);
  };

  /* ---- tree building ---- */
  const rootGoals = goals.filter((g) => g.parentGoalId === null);
  const childrenMap: Record<string, GoalRow[]> = {};
  goals.forEach((g) => {
    if (g.parentGoalId) {
      if (!childrenMap[g.parentGoalId]) childrenMap[g.parentGoalId] = [];
      childrenMap[g.parentGoalId].push(g);
    }
  });

  /* ---- render helpers ---- */
  const renderPriorityDot = (priority: number) => (
    <span
      className={`inline-block h-2 w-2 rounded-full ${PRIORITY_COLORS[priority] ?? 'bg-gray-400'}`}
      title={`优先级 ${priority}`}
    />
  );

  const renderGoalNode = (goal: GoalRow) => {
    const children = childrenMap[goal.id] ?? [];
    const isCollapsed = collapsed.has(goal.id);
    const hasChildren = children.length > 0;
    const canAddChild = goal.depth < 3;

    const depthPadding =
      goal.depth === 1 ? 'pl-0' : goal.depth === 2 ? 'pl-8' : 'pl-16';

    return (
      <div key={goal.id}>
        {/* node row */}
        <div
          className={`group flex items-center gap-2 py-2 ${depthPadding} ${
            goal.depth > 1 ? 'border-l-2 border-border ml-2' : ''
          }`}
        >
          {/* expand / collapse chevron */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleCollapse(goal.id)}
              className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {/* checkbox */}
          <input
            type="checkbox"
            checked={goal.completed}
            onChange={() => toggleCompleted(goal)}
            className="h-4 w-4 shrink-0 rounded border-border accent-blue cursor-pointer"
          />

          {/* title */}
          <span
            className={`text-sm ${
              goal.completed
                ? 'text-text-tertiary line-through'
                : 'text-text-primary'
            }`}
          >
            {goal.title}
          </span>

          {/* priority dot */}
          {renderPriorityDot(goal.priority)}

          {/* category badge */}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              CATEGORY_COLORS[goal.category]
            }`}
          >
            {CATEGORY_LABELS[goal.category]}
          </span>

          {/* deadline */}
          {goal.deadline && (
            <span className="text-xs text-text-tertiary">
              {goal.deadline.slice(0, 10)}
            </span>
          )}

          {/* actions — visible on hover */}
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canAddChild && (
              <button
                type="button"
                onClick={() => openSubGoalForm(goal.id)}
                className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors"
              >
                添加子目标
              </button>
            )}
            <button
              type="button"
              onClick={() => deleteGoal(goal.id)}
              className="rounded p-1 text-text-tertiary hover:text-red-500 transition-colors"
              title="删除目标"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* children */}
        {hasChildren && !isCollapsed && (
          <div>
            {children.map((child) => renderGoalNode(child))}
          </div>
        )}
      </div>
    );
  };

  /* ---- render ---- */
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

      {/* ---- New goal form (inline) ---- */}
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-surface p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">
              {formParentId ? '添加子目标' : '新建目标'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormParentId(null);
              }}
              className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              取消
            </button>
          </div>

          <input
            type="text"
            placeholder="目标名称"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue transition-colors"
            required
          />

          <div className="flex flex-wrap gap-3">
            {/* category select */}
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as GoalRow['category'])}
              className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue transition-colors sm:w-auto"
            >
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>

            {/* priority */}
            <input
              type="number"
              min={1}
              max={5}
              value={formPriority}
              onChange={(e) => setFormPriority(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue transition-colors sm:w-24"
              title="优先级 (1=最高, 5=最低)"
            />

            {/* deadline */}
            <input
              type="date"
              value={formDeadline}
              onChange={(e) => setFormDeadline(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue transition-colors sm:w-auto"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !formTitle.trim()}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {submitting && (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              创建目标
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setFormParentId(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          新建目标
        </button>
      )}

      {/* ---- Filter bar ---- */}
      <div className="flex flex-wrap items-center gap-4">
        {/* category chips */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['ALL', '全部'],
              ['ACADEMIC', '学业'],
              ['CAREER', '职业'],
              ['LIFESTYLE', '生活'],
              ['OTHER', '其他'],
            ] as [CategoryFilter, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setCategoryFilter(val)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                categoryFilter === val
                  ? 'bg-blue text-white'
                  : 'border border-border text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* completion toggle */}
        <div className="flex gap-2">
          {(
            [
              ['ALL', '全部'],
              ['INCOMPLETE', '未完成'],
              ['COMPLETED', '已完成'],
            ] as [CompletionFilter, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setCompletionFilter(val)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                completionFilter === val
                  ? 'bg-navy/10 text-navy'
                  : 'border border-border text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Goal tree ---- */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue border-t-transparent" />
        </div>
      ) : rootGoals.length === 0 ? (
        /* empty state */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="h-12 w-12 text-text-tertiary mb-4" />
          <p className="text-sm font-medium text-text-secondary mb-1">
            还没有目标
          </p>
          <p className="text-xs text-text-tertiary max-w-xs">
            点击上方「新建目标」创建你的第一个目标，或者在「规划模板」中一键导入预设路线
          </p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {rootGoals.map((goal) => renderGoalNode(goal))}
        </div>
      )}
    </div>
  );
}
