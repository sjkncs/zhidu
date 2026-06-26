'use client';

import React from 'react';
import {
  Compass,
  Sparkles,
  Target,
  TrendingUp,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  Plus,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@zhidu/ui';

interface CareerGoal {
  title: string;
  description: string;
  deadline: string;
}

interface CareerPathRow {
  id: string;
  targetRole: string;
  targetIndustry: string | null;
  salaryRange: string | null;
  requiredSkills: string[];
  shortTermGoals: CareerGoal[];
  midTermGoals: CareerGoal[];
  longTermGoals: CareerGoal[];
  industryTrends: string | null;
  matchScore: number;
  sourceMajor: string | null;
  createdAt: string;
}

interface CareerExplorerProps {
  onGoalsCreated?: () => void;
}

export default function CareerExplorer({ onGoalsCreated }: CareerExplorerProps) {
  const [major, setMajor] = React.useState('');
  const [mbti, setMbti] = React.useState('');
  const [holland, setHolland] = React.useState('');
  const [showMoreOptions, setShowMoreOptions] = React.useState(false);

  const [paths, setPaths] = React.useState<CareerPathRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const [historyPaths, setHistoryPaths] = React.useState<CareerPathRow[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);

  const [convertingId, setConvertingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Fetch saved paths on mount
  React.useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch('/api/career/paths');
      if (!res.ok) {
        throw new Error('获取历史记录失败');
      }
      const data = await res.json();
      setHistoryPaths(Array.isArray(data) ? data : []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : '获取历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleGenerate() {
    if (!major.trim()) {
      setError('请输入你的专业');
      return;
    }
    setLoading(true);
    setError(null);
    setPaths([]);
    setExpandedId(null);

    try {
      const res = await fetch('/api/career/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          major: major.trim(),
          ...(showMoreOptions && mbti.trim() ? { mbti: mbti.trim() } : {}),
          ...(showMoreOptions && holland.trim() ? { holland: holland.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || '生成职业路径失败，请稍后重试');
      }
      const data = await res.json();
      setPaths(Array.isArray(data) ? data : data.paths || []);
      // Refresh history after generating
      fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成职业路径失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleConvertToGoals(path: CareerPathRow) {
    setConvertingId(path.id);
    try {
      const allGoals = [
        ...path.shortTermGoals,
        ...path.midTermGoals,
        ...path.longTermGoals,
      ];

      const res = await fetch('/api/career/goals/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals: allGoals, pathId: path.id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || '转化目标失败');
      }

      onGoalsCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '转化目标失败');
    } finally {
      setConvertingId(null);
    }
  }

  async function handleDelete(pathId: string) {
    setDeletingId(pathId);
    try {
      const res = await fetch('/api/career/paths', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pathId }),
      });

      if (!res.ok) {
        throw new Error('删除失败');
      }

      setHistoryPaths((prev) => prev.filter((p) => p.id !== pathId));
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-blue" />
          <h2 className="text-lg font-semibold text-text-primary">探索职业路径</h2>
        </div>
        <p className="text-sm text-text-secondary">
          输入你的专业信息，AI 将为你生成个性化的职业发展路径与阶段性目标。
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              专业名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="例如：计算机科学与技术、金融学、临床医学..."
              className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerate();
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="flex items-center gap-1 text-xs font-medium text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {showMoreOptions ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            更多选项
          </button>

          {showMoreOptions && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                  MBTI 类型
                </label>
                <input
                  type="text"
                  value={mbti}
                  onChange={(e) => setMbti(e.target.value)}
                  placeholder="例如：INTJ、ENFP..."
                  className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                  霍兰德代码
                </label>
                <input
                  type="text"
                  value={holland}
                  onChange={(e) => setHolland(e.target.value)}
                  placeholder="例如：RIA、SEC..."
                  className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue transition-colors"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !major.trim()}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                正在生成...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                生成职业路径
              </>
            )}
          </button>
        </div>
      </section>

      {/* Loading Skeletons */}
      {loading && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface p-5 space-y-3"
            >
              <div className="h-5 w-2/3 rounded bg-surface-elevated animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-surface-elevated animate-pulse" />
              <div className="h-3 w-full rounded bg-surface-elevated animate-pulse" />
              <div className="flex gap-2">
                <div className="h-6 w-16 rounded-full bg-surface-elevated animate-pulse" />
                <div className="h-6 w-16 rounded-full bg-surface-elevated animate-pulse" />
                <div className="h-6 w-16 rounded-full bg-surface-elevated animate-pulse" />
              </div>
              <div className="h-8 w-24 rounded-lg bg-surface-elevated animate-pulse" />
            </div>
          ))}
        </section>
      )}

      {/* Results Section */}
      {!loading && paths.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue" />
            <h3 className="text-base font-semibold text-text-primary">推荐职业路径</h3>
            <span className="text-xs text-text-tertiary">
              共 {paths.length} 条路径
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paths.map((path) => (
              <CareerPathCard
                key={path.id}
                path={path}
                expanded={expandedId === path.id}
                onToggle={() => toggleExpand(path.id)}
                onConvert={() => handleConvertToGoals(path)}
                converting={convertingId === path.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* History Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-text-tertiary" />
          <h3 className="text-base font-semibold text-text-primary">历史路径</h3>
        </div>

        {historyError && (
          <p className="text-sm text-red-500">{historyError}</p>
        )}

        {historyLoading && (
          <div className="flex items-center gap-2 py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue border-t-transparent" />
            <span className="text-sm text-text-tertiary">加载中...</span>
          </div>
        )}

        {!historyLoading && historyPaths.length === 0 && (
          <p className="py-4 text-sm text-text-tertiary">
            暂无历史记录，生成职业路径后将自动保存。
          </p>
        )}

        {!historyLoading && historyPaths.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {historyPaths.map((path) => (
              <CareerPathCard
                key={path.id}
                path={path}
                expanded={expandedId === path.id}
                onToggle={() => toggleExpand(path.id)}
                onConvert={() => handleConvertToGoals(path)}
                converting={convertingId === path.id}
                onDelete={() => handleDelete(path.id)}
                deleting={deletingId === path.id}
                isHistory
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────
   CareerPathCard sub-component
   ──────────────────────────────────────────── */

interface CareerPathCardProps {
  path: CareerPathRow;
  expanded: boolean;
  onToggle: () => void;
  onConvert: () => void;
  converting: boolean;
  onDelete?: () => void;
  deleting?: boolean;
  isHistory?: boolean;
}

function CareerPathCard({
  path,
  expanded,
  onToggle,
  onConvert,
  converting,
  onDelete,
  deleting,
  isHistory,
}: CareerPathCardProps) {
  const score = path.matchScore ?? 0;

  return (
    <div className="rounded-xl border border-border bg-surface hover:border-blue/20 transition-colors overflow-hidden">
      {/* Card header */}
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-text-primary truncate">
              {path.targetRole}
            </h4>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {path.targetIndustry && (
                <Badge variant="secondary" className="bg-blue/10 text-blue text-xs">
                  {path.targetIndustry}
                </Badge>
              )}
              {path.salaryRange && (
                <span className="text-xs text-text-tertiary flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {path.salaryRange}
                </span>
              )}
            </div>
          </div>

          {/* Match score ring */}
          <div className="relative flex items-center justify-center">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-border"
              />
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${score * 1.13} 113`}
                strokeLinecap="round"
                className="text-blue"
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-text-primary">
              {score}
            </span>
          </div>
        </div>

        {/* Skills */}
        {path.requiredSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {path.requiredSkills.slice(0, 6).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-medium text-navy"
              >
                {skill}
              </span>
            ))}
            {path.requiredSkills.length > 6 && (
              <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] text-text-tertiary">
                +{path.requiredSkills.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Expand toggle */}
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors"
        >
          {expanded ? (
            <>
              收起详情 <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              查看详情 <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border p-5 space-y-4 bg-background">
          {/* Goals timeline */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <GoalColumn
              title="短期目标"
              icon={<Target className="h-3.5 w-3.5" />}
              goals={path.shortTermGoals}
            />
            <GoalColumn
              title="中期目标"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              goals={path.midTermGoals}
            />
            <GoalColumn
              title="长期目标"
              icon={<ArrowRight className="h-3.5 w-3.5" />}
              goals={path.longTermGoals}
            />
          </div>

          {/* Industry trends */}
          {path.industryTrends && (
            <div className="space-y-1.5">
              <h5 className="text-xs font-medium text-text-secondary">行业趋势</h5>
              <p className="text-xs leading-relaxed text-text-tertiary">
                {path.industryTrends}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onConvert}
              disabled={converting}
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {converting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  转化中...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  转化为目标
                </>
              )}
            </button>

            {isHistory && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                删除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   GoalColumn sub-component
   ──────────────────────────────────────────── */

function GoalColumn({
  title,
  icon,
  goals,
}: {
  title: string;
  icon: React.ReactNode;
  goals: CareerGoal[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-blue">{icon}</span>
        <h5 className="text-xs font-medium text-text-primary">{title}</h5>
      </div>
      {goals.length === 0 && (
        <p className="text-[11px] text-text-tertiary">暂无目标</p>
      )}
      <ul className="space-y-2">
        {goals.map((goal, idx) => (
          <li key={idx} className="space-y-0.5">
            <p className="text-xs font-medium text-text-secondary">{goal.title}</p>
            {goal.description && (
              <p className="text-[11px] leading-relaxed text-text-tertiary">
                {goal.description}
              </p>
            )}
            {goal.deadline && (
              <p className="text-[10px] text-text-tertiary">
                {goal.deadline}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
