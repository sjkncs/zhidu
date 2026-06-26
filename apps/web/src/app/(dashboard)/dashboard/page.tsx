'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { ModuleGrid, QuickActions } from './module-grid';

interface Stats {
  volunteerPlans: number | null;
  skillTrees: number | null;
  knowledgeBookmarks: string;
  diaryStreak: number | null;
}

function calculateDiaryStreak(entries: Array<{ date?: string; created_at?: string }>): number {
  if (!entries || entries.length === 0) return 0;

  const dates = new Set(
    entries.map((e) => {
      const raw = e.date ?? e.created_at;
      return raw ? new Date(raw).toISOString().split('T')[0] : '';
    }).filter(Boolean),
  );

  const sorted = Array.from(dates).sort().reverse();
  if (sorted.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];

    if (sorted[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<Stats>({
    volunteerPlans: null,
    skillTrees: null,
    knowledgeBookmarks: '-',
    diaryStreak: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      const next: Stats = { ...stats };

      const [plansRes, treesRes, diaryRes] = await Promise.allSettled([
        fetch('/api/volunteer/plans'),
        fetch('/api/skills/trees'),
        fetch('/api/diary'),
      ]);

      if (!cancelled) {
        if (plansRes.status === 'fulfilled' && plansRes.value.ok) {
          try {
            const data = await plansRes.value.json();
            next.volunteerPlans = Array.isArray(data) ? data.length : (data.count ?? data.length ?? 0);
          } catch {
            next.volunteerPlans = 0;
          }
        } else {
          next.volunteerPlans = 0;
        }

        if (treesRes.status === 'fulfilled' && treesRes.value.ok) {
          try {
            const data = await treesRes.value.json();
            next.skillTrees = Array.isArray(data) ? data.length : (data.count ?? data.length ?? 0);
          } catch {
            next.skillTrees = 0;
          }
        } else {
          next.skillTrees = 0;
        }

        next.knowledgeBookmarks = '-';

        if (diaryRes.status === 'fulfilled' && diaryRes.value.ok) {
          try {
            const data = await diaryRes.value.json();
            const entries = Array.isArray(data) ? data : (data.entries ?? data.data ?? []);
            next.diaryStreak = calculateDiaryStreak(entries);
          } catch {
            next.diaryStreak = 0;
          }
        } else {
          next.diaryStreak = 0;
        }

        setStats(next);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userEmail = user?.email ?? '用户';
  const displayName = user?.user_metadata?.name ?? userEmail.split('@')[0];

  const isLoading = stats.volunteerPlans === null;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome section */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          你好，{displayName}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          欢迎回渡。今天想从哪里开始？
        </p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-tertiary">志愿方案</p>
          {isLoading ? (
            <div className="mt-1 h-8 w-12 animate-pulse rounded bg-surface-elevated" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-text-primary">{stats.volunteerPlans}</p>
          )}
          <p className="mt-1 text-xs text-text-secondary">开始创建你的第一个方案</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-tertiary">知识收藏</p>
          {isLoading ? (
            <div className="mt-1 h-8 w-12 animate-pulse rounded bg-surface-elevated" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-text-primary">{stats.knowledgeBookmarks}</p>
          )}
          <p className="mt-1 text-xs text-text-secondary">探索院校与专业信息</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-tertiary">技能点数</p>
          {isLoading ? (
            <div className="mt-1 h-8 w-12 animate-pulse rounded bg-surface-elevated" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-text-primary">{stats.skillTrees}</p>
          )}
          <p className="mt-1 text-xs text-text-secondary">点亮你的技能树</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-tertiary">连续打卡</p>
          {isLoading ? (
            <div className="mt-1 h-8 w-16 animate-pulse rounded bg-surface-elevated" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-text-primary">{stats.diaryStreak} 天</p>
          )}
          <p className="mt-1 text-xs text-text-secondary">坚持每日记录</p>
        </div>
      </div>

      {/* Module grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          功能模块
        </h2>
        <ModuleGrid />
      </div>

      {/* Quick actions */}
      <QuickActions />
    </div>
  );
}
