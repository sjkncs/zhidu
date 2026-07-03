'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowUp, Loader2, Paperclip, Mic, Zap, BookOpen, MessageCircle } from 'lucide-react';

export type ChatMode = 'auto' | 'knowledge' | 'freechat';

const MODE_CONFIG: Record<ChatMode, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  auto: { label: '自动路由', icon: Zap, description: 'AI 自动判断走知识库还是直接对话' },
  knowledge: { label: '知识库优先', icon: BookOpen, description: '优先检索知识库参考资料' },
  freechat: { label: '自由对话', icon: MessageCircle, description: '跳过知识库，直接与 LLM 对话' },
};

const MODE_ORDER: ChatMode[] = ['auto', 'knowledge', 'freechat'];

interface ChatInputProps {
  onSend: (message: string, preferMode?: ChatMode) => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export function ChatInput({ onSend, disabled, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [mode, setMode] = useState<ChatMode>('auto');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 200;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const cycleMode = () => {
    const idx = MODE_ORDER.indexOf(mode);
    setMode(MODE_ORDER[(idx + 1) % MODE_ORDER.length]);
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed, mode);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !disabled && !isStreaming;

  return (
    <div className="border-t border-border/50 bg-gradient-to-t from-surface to-surface/80 px-4 py-4 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl">
        {/* 输入容器 */}
        <div
          className={[
            'relative flex items-end gap-2 rounded-2xl border bg-background px-4 py-3 shadow-sm transition-all duration-200',
            isFocused
              ? 'border-blue/50 shadow-[0_0_0_3px_rgba(59,130,246,0.08)] ring-1 ring-blue/20'
              : 'border-border/60 hover:border-border',
          ].join(' ')}
        >
          {/* 附件按钮 */}
          <button
            type="button"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-secondary"
            aria-label="附件"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* 文本输入 */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled || isStreaming}
            placeholder="输入你的问题...  @ 可提及更多"
            rows={1}
            className={[
              'max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-text-primary',
              'placeholder:text-text-tertiary/70',
              'focus:outline-none',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          />

          {/* 右侧操作区 */}
          <div className="mb-0.5 flex shrink-0 items-center gap-1">
            {/* 语音按钮 */}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-secondary"
              aria-label="语音输入"
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* 发送按钮 */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={[
                'flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200',
                canSend
                  ? 'bg-blue text-white shadow-sm hover:bg-blue/90 hover:shadow-md active:scale-95'
                  : 'bg-surface-elevated text-text-tertiary/50 cursor-not-allowed',
              ].join(' ')}
              aria-label={isStreaming ? '正在生成...' : '发送'}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>

        {/* 底部提示 + 模式切换 */}
        <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <button
              onClick={cycleMode}
              title={MODE_CONFIG[mode].description}
              className="flex items-center gap-1 rounded-md border border-border/40 px-2 py-0.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-blue/30 hover:bg-blue/[0.04] hover:text-blue"
            >
              {(() => {
                const Icon = MODE_CONFIG[mode].icon;
                return <Icon className="h-3 w-3" />;
              })()}
              {MODE_CONFIG[mode].label}
            </button>
            <p className="text-[11px] text-text-tertiary/60">
              Enter 发送 · Shift+Enter 换行 · AI 回答仅供参考
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
            <span className="text-[11px] text-text-tertiary/60">知识库已连接</span>
          </div>
        </div>
      </div>
    </div>
  );
}
