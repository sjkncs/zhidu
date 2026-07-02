'use client';

import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/stores/chat-store';
import { SourcePanel } from './SourceCard';
import { Brain, ChevronDown } from 'lucide-react';

interface MessageBubbleProps {
  message: ChatMessage;
}

// ── Thinking Block (deep thinking / reflection) ──

function ThinkingBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-purple-500/20 bg-purple-500/[0.03]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/[0.06]"
      >
        <Brain className="h-3.5 w-3.5" />
        <span>深度思考</span>
        <span className="flex-1" />
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-purple-500/10 px-4 py-3">
          <div className="text-[13px] leading-relaxed text-text-secondary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Markdown renderer with citation support ──

function MarkdownContent({ content }: { content: string }) {
  // Extract thinking blocks: <!-- thinking -->...<!-- /thinking -->
  const thinkingRegex = /<!--\s*thinking\s*-->([\s\S]*?)<!--\s*\/thinking\s*-->/g;
  const parts: Array<{ type: 'text' | 'thinking'; content: string }> = [];

  let lastIndex = 0;
  let match;

  while ((match = thinkingRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'thinking', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  // If no thinking blocks found, treat entire content as text
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'thinking') {
          return <ThinkingBlock key={`t-${i}`} content={part.content} />;
        }
        return <MarkdownText key={`m-${i}`} text={part.content} />;
      })}
    </>
  );
}

function MarkdownText({ text }: { text: string }) {
  // Replace [N] citation markers with custom HTML
  const processedText = text.replace(
    /\[(\d+)\]/g,
    '<sup class="citation-marker" data-ref="$1">[$1]</sup>',
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headings
        h1: ({ children }) => (
          <h1 className="mb-2 mt-4 text-lg font-bold text-text-primary first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-3 text-base font-bold text-text-primary first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1.5 mt-2.5 text-sm font-bold text-text-primary first:mt-0">
            {children}
          </h3>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="mb-2.5 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2.5 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="pl-1">{children}</li>
        ),
        // Code
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <pre className="mb-2.5 overflow-x-auto rounded-lg bg-[#1a1b26] p-3.5 text-[13px] leading-relaxed last:mb-0">
                <code className="font-mono text-[#c0caf5]" {...props}>
                  {children}
                </code>
              </pre>
            );
          }
          return (
            <code
              className="rounded bg-surface-elevated px-1.5 py-0.5 text-[12px] font-mono text-text-primary"
              {...props}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="mb-2.5 border-l-2 border-blue/30 pl-3 text-text-secondary italic last:mb-0">
            {children}
          </blockquote>
        ),
        // Table
        table: ({ children }) => (
          <div className="mb-2.5 overflow-x-auto last:mb-0">
            <table className="w-full border-collapse text-[13px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-border bg-surface-elevated/50">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-1.5 text-left font-semibold text-text-primary">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border/50 px-3 py-1.5 text-text-secondary">{children}</td>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue underline decoration-blue/30 underline-offset-2 transition-colors hover:decoration-blue"
          >
            {children}
          </a>
        ),
        // Strong
        strong: ({ children }) => (
          <strong className="font-semibold text-text-primary">{children}</strong>
        ),
        // Horizontal rule
        hr: () => <hr className="my-3 border-border/50" />,
        // Custom sup for citations
        sup: ({ children, ...props }) => {
          const ref = (props as any)['data-ref'];
          return (
            <sup
              className="inline-flex h-4 min-w-[16px] cursor-pointer items-center justify-center rounded bg-blue/10 px-1 text-[10px] font-bold text-blue transition-colors hover:bg-blue/20"
              title={`参考资料 ${ref}`}
            >
              {children}
            </sup>
          );
        },
      }}
    >
      {processedText}
    </ReactMarkdown>
  );
}

// ── Main Component ──

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-blue px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-sm">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-navy to-navy-light text-xs font-bold text-white shadow-sm">
        知
      </div>

      <div className="min-w-0 max-w-[85%] flex-1">
        <div className="rounded-2xl rounded-tl-md border border-border/60 bg-surface px-5 py-4 text-[14px] text-text-primary shadow-sm">
          {message.content ? (
            <MarkdownContent content={message.content} />
          ) : message.isStreaming ? null : (
            <span className="text-text-tertiary">...</span>
          )}

          {/* Streaming cursor */}
          {message.isStreaming && (
            <span className="mt-1 inline-block h-4 w-0.5 animate-pulse rounded-full bg-blue" />
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
