'use client';

import { useMemo } from 'react';
import type { ChatMessage } from '@/stores/chat-store';
import { SourcePanel } from './SourceCard';

interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * 将 assistant 消息内容中的 [1], [2] 等引用标记解析为可渲染节点
 */
function renderContentWithCitations(content: string) {
  // 分割文本：普通文本段和引用标记交替
  const parts = content.split(/(\[\d+\])/g);

  return parts.map((part, i) => {
    const citationMatch = part.match(/^\[(\d+)\]$/);
    if (citationMatch) {
      const num = citationMatch[1];
      return (
        <sup
          key={i}
          className="inline-flex h-4 min-w-[16px] cursor-pointer items-center justify-center rounded bg-blue/10 px-1 text-[10px] font-bold text-blue"
          title={`参考资料 ${num}`}
        >
          {num}
        </sup>
      );
    }
    // 处理基础 markdown: **bold**, `code`
    return renderInlineMarkdown(part, i);
  });
}

function renderInlineMarkdown(text: string, key: number) {
  // 处理 **bold** 和 `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return (
    <span key={key}>
      {parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={j} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={j}
              className="rounded bg-surface-elevated px-1 py-0.5 text-xs font-mono"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={j}>{part}</span>;
      })}
    </span>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-blue px-4 py-2.5 text-sm text-white">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy text-xs font-bold text-white">
        知
      </div>

      <div className="min-w-0 max-w-[80%] flex-1">
        <div className="rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3 text-sm text-text-primary">
          <div className="whitespace-pre-wrap leading-relaxed">
            {message.content
              ? renderContentWithCitations(message.content)
              : message.isStreaming
                ? null
                : '...'}
          </div>

          {/* Streaming cursor */}
          {message.isStreaming && (
            <span className="inline-block h-4 w-0.5 animate-pulse bg-blue" />
          )}
        </div>

        {/* Source panel */}
        {message.sources && message.sources.length > 0 && (
          <SourcePanel sources={message.sources} />
        )}
      </div>
    </div>
  );
}
