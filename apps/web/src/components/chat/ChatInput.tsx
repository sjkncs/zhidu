'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SendHorizontal, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export function ChatInput({ onSend, disabled, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // Max 6 rows (~144px)
    const maxHeight = 144;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue('');
    // Reset height after send
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
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isStreaming}
            placeholder="输入你的问题..."
            rows={1}
            className={[
              'w-full resize-none rounded-xl border bg-background px-4 py-2.5 pr-12 text-sm text-text-primary',
              'placeholder:text-text-tertiary',
              'focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors',
              'border-border',
            ].join(' ')}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
            canSend
              ? 'bg-navy text-white hover:bg-navy-light'
              : 'bg-background text-text-tertiary border border-border cursor-not-allowed',
          ].join(' ')}
          aria-label={isStreaming ? '正在生成...' : '发送'}
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </button>
      </div>

      <p className="mx-auto mt-1.5 max-w-3xl text-[11px] text-text-tertiary">
        Enter 发送，Shift+Enter 换行
      </p>
    </div>
  );
}
