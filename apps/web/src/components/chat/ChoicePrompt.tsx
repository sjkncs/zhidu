'use client';

import { useState, useCallback } from 'react';
import { Check, ChevronRight, SkipForward } from 'lucide-react';
import type { ChoicePromptData } from '@/lib/sse-parser';

interface ChoicePromptProps {
  prompt: ChoicePromptData;
  answered?: boolean;
  previousResponse?: string[];
  onConfirm: (selectedLabels: string[]) => void;
}

/**
 * P1: 结构化选择引导组件
 *
 * 在对话流中渲染为选项卡片列表，支持单选/多选，
 * 用户确认后将选择结果回传给 AI 继续对话。
 */
export function ChoicePrompt({
  prompt,
  answered,
  previousResponse,
  onConfirm,
}: ChoicePromptProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleOption = useCallback(
    (label: string) => {
      if (answered) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (prompt.multiSelect) {
          // 多选: 切换选中状态
          if (next.has(label)) {
            next.delete(label);
          } else {
            next.add(label);
          }
        } else {
          // 单选: 清除其他选中项
          next.clear();
          next.add(label);
        }
        return next;
      });
    },
    [answered, prompt.multiSelect],
  );

  const handleConfirm = useCallback(() => {
    if (selected.size === 0) return;
    onConfirm(Array.from(selected));
  }, [selected, onConfirm]);

  const handleSkip = useCallback(() => {
    onConfirm(['跳过']);
  }, [onConfirm]);

  // 已回答状态: 显示用户之前的选择
  if (answered && previousResponse) {
    return (
      <div className="my-3 rounded-xl border border-border/40 bg-surface/50 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-text-tertiary">
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          <span>{prompt.header ?? '已回答'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {previousResponse.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-lg border border-blue/20 bg-blue/5 px-3 py-1.5 text-sm text-blue"
            >
              <Check className="h-3 w-3" />
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/60 bg-surface shadow-sm">
      {/* 头部: 问题文本 */}
      <div className="border-b border-border/40 bg-surface-elevated/50 px-4 py-3">
        {prompt.header && (
          <span className="mb-1 inline-block rounded-md bg-blue/10 px-2 py-0.5 text-xs font-medium text-blue">
            {prompt.header}
          </span>
        )}
        <p className="text-sm font-medium text-text-primary leading-relaxed">
          {prompt.question}
        </p>
      </div>

      {/* 选项列表 */}
      <div className="p-2">
        {prompt.options.map((option) => {
          const isSelected = selected.has(option.label);
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => toggleOption(option.label)}
              className={[
                'flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-150',
                isSelected
                  ? 'border-blue/40 bg-blue/5 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]'
                  : 'border-transparent hover:border-border/40 hover:bg-surface-elevated/30',
              ].join(' ')}
            >
              {/* 选中标记 */}
              <div
                className={[
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                  isSelected
                    ? 'border-blue bg-blue text-white'
                    : 'border-border/60 bg-background',
                ].join(' ')}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </div>

              {/* 选项内容 */}
              <div className="min-w-0 flex-1">
                <span
                  className={[
                    'block text-sm font-medium',
                    isSelected ? 'text-blue' : 'text-text-primary',
                  ].join(' ')}
                >
                  {option.label}
                </span>
                {option.description && (
                  <span className="mt-0.5 block text-xs text-text-tertiary leading-relaxed">
                    {option.description}
                  </span>
                )}
              </div>

              {/* 右侧箭头 */}
              <ChevronRight
                className={[
                  'mt-0.5 h-4 w-4 shrink-0 transition-colors',
                  isSelected ? 'text-blue' : 'text-text-quaternary',
                ].join(' ')}
              />
            </button>
          );
        })}
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between border-t border-border/40 px-4 py-2.5">
        <button
          type="button"
          onClick={handleSkip}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-tertiary transition-colors hover:bg-surface-elevated/50 hover:text-text-secondary"
        >
          <SkipForward className="h-3 w-3" />
          跳过
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selected.size === 0}
          className={[
            'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
            selected.size > 0
              ? 'bg-blue text-white shadow-sm hover:bg-blue/90'
              : 'cursor-not-allowed bg-border/30 text-text-quaternary',
          ].join(' ')}
        >
          确认{prompt.multiSelect && selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
      </div>
    </div>
  );
}
