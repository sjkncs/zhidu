'use client';

/**
 * AI 思考中动画 — 显示"知"图标 + 脉冲波纹 + 阶段文字
 */
export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-navy to-blue text-xs font-bold text-white shadow-sm">
        知
      </div>
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-md border border-border/60 bg-surface/80 px-4 py-2.5 backdrop-blur-sm">
        {/* 脉冲波纹 */}
        <div className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue/20" style={{ animationDuration: '1.5s' }} />
          <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-blue/30" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue/60" />
        </div>
        {/* 阶段文字 */}
        <span className="text-sm text-text-secondary animate-pulse" style={{ animationDuration: '2s' }}>
          正在思考...
        </span>
      </div>
    </div>
  );
}
