'use client';

/**
 * 三点脉冲动画 — 等待首个 content delta 时显示
 */
export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy text-xs font-bold text-white">
        知
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary [animation-delay:300ms]" />
      </div>
    </div>
  );
}
