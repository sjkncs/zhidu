'use client';

import { Calendar, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';

interface DeadlineItem {
  id: string;
  type: 'todo' | 'memo';
  title: string;
  dueDate: string;
  href: string;
  isOverdue: boolean;
}

function formatDueDate(dateStr: string): { label: string; color: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMs < 0) {
    return { label: '已过期', color: 'text-red-500' };
  }
  if (diffHours < 24) {
    return { label: '今天', color: 'text-amber-500' };
  }
  if (diffDays === 1) {
    return { label: '明天', color: 'text-amber-500' };
  }
  if (diffDays < 7) {
    return { label: `${diffDays} 天后`, color: 'text-blue' };
  }
  return {
    label: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    color: 'text-text-tertiary',
  };
}

export function UpcomingDeadlines({ items }: { items: DeadlineItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="mb-4 text-base font-semibold text-text-primary">即将到来</h3>
        <div className="flex flex-col items-center py-8 text-center">
          <Calendar className="mb-3 h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-secondary">暂无即将到来的截止日期</p>
          <p className="mt-1 text-xs text-text-tertiary">添加带截止日期的待办事项后将在此显示</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="mb-4 text-base font-semibold text-text-primary">即将到来</h3>
      <div className="space-y-1">
        {items.map((item) => {
          const { label, color } = formatDueDate(item.dueDate);
          return (
            <Link
              key={`${item.type}-${item.id}`}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-elevated"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.isOverdue ? 'bg-red-500/10 text-red-500' : 'bg-blue/10 text-blue'}`}>
                {item.isOverdue ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{item.title}</p>
                <p className="text-xs text-text-tertiary">
                  {new Date(item.dueDate).toLocaleDateString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-medium ${color}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
