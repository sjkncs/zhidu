'use client';

import { BookOpen, BookMarked, StickyNote, Target, Clock } from 'lucide-react';
import Link from 'next/link';

interface ActivityItem {
  id: string;
  type: 'course' | 'diary' | 'memo' | 'goal' | 'skill' | 'resume';
  title: string;
  subtitle?: string;
  href: string;
  createdAt: string;
}

const typeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  course: { icon: BookOpen, label: '课程', color: 'bg-blue/10 text-blue' },
  diary: { icon: BookMarked, label: '日记', color: 'bg-emerald-500/10 text-emerald-600' },
  memo: { icon: StickyNote, label: '备忘', color: 'bg-amber-500/10 text-amber-600' },
  goal: { icon: Target, label: '目标', color: 'bg-purple-500/10 text-purple-600' },
  skill: { icon: Target, label: '技能', color: 'bg-teal-500/10 text-teal-600' },
  resume: { icon: BookOpen, label: '简历', color: 'bg-rose-500/10 text-rose-600' },
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="mb-4 text-base font-semibold text-text-primary">最近动态</h3>
        <div className="flex flex-col items-center py-8 text-center">
          <Clock className="mb-3 h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-secondary">暂无最近活动</p>
          <p className="mt-1 text-xs text-text-tertiary">添加课程、写日记或创建备忘后将在此显示</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="mb-4 text-base font-semibold text-text-primary">最近动态</h3>
      <div className="space-y-1">
        {items.map((item) => {
          const config = typeConfig[item.type] ?? typeConfig.memo;
          const Icon = config.icon;
          return (
            <Link
              key={`${item.type}-${item.id}`}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-elevated"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-text-tertiary">{item.subtitle}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-text-tertiary">
                {formatTimeAgo(item.createdAt)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
