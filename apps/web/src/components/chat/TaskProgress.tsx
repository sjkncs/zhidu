'use client';

import {
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  ListChecks,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import type { TaskUpdateData } from '@/lib/sse-parser';

interface TaskProgressProps {
  tasks: TaskUpdateData[];
}

const STATUS_CONFIG = {
  pending: {
    icon: Circle,
    color: 'text-text-quaternary',
    label: '等待中',
  },
  in_progress: {
    icon: Loader2,
    color: 'text-blue',
    label: '执行中',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    label: '已完成',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    label: '失败',
  },
} as const;

/**
 * P3: 实时任务进度组件
 *
 * 渲染多步骤任务的执行进度，支持 4 种状态:
 * pending (灰色圆圈) / in_progress (蓝色旋转) / completed (绿色勾选) / failed (红色叉号)
 */
export function TaskProgress({ tasks }: TaskProgressProps) {
  const [expanded, setExpanded] = useState(true);

  if (!tasks || tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;
  const runningCount = tasks.filter((t) => t.status === 'in_progress').length;
  const allDone = completedCount + failedCount === tasks.length;

  // 状态摘要
  const summary = allDone
    ? failedCount > 0
      ? `${completedCount}/${tasks.length} 完成, ${failedCount} 失败`
      : `${completedCount}/${tasks.length} 完成`
    : runningCount > 0
      ? `执行中 ${runningCount}/${tasks.length}`
      : `等待中 ${tasks.length - completedCount}/${tasks.length}`;

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/40 bg-surface/50">
      {/* 头部 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-blue transition-colors hover:bg-blue/[0.04]"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue/10">
          <ListChecks className="h-3 w-3" />
        </div>
        <span>执行步骤</span>
        <span className="rounded-full bg-blue/10 px-2 py-0.5 text-[10px] font-bold text-blue">
          {summary}
        </span>
        <span className="flex-1" />
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 任务列表 */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/20 px-4 py-2">
            <div className="space-y-1.5">
              {tasks.map((task) => {
                const config = STATUS_CONFIG[task.status];
                const Icon = config.icon;
                const isAnimating = 'animate' in config && config.animate;

                return (
                  <div
                    key={task.taskId}
                    className="flex items-center gap-2.5 py-1"
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${config.color} ${
                        isAnimating ? 'animate-spin' : ''
                      }`}
                    />
                    <span
                      className={`text-[13px] leading-relaxed ${
                        task.status === 'completed'
                          ? 'text-text-secondary'
                          : task.status === 'failed'
                            ? 'text-red-500/80'
                            : task.status === 'in_progress'
                              ? 'text-text-primary font-medium'
                              : 'text-text-tertiary'
                      }`}
                    >
                      {task.description}
                    </span>
                    {task.durationMs != null && task.durationMs > 0 && (
                      <span className="ml-auto shrink-0 text-[10px] text-text-quaternary">
                        {task.durationMs < 1000
                          ? `${task.durationMs}ms`
                          : `${(task.durationMs / 1000).toFixed(1)}s`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
