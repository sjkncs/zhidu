'use client';

import { Children, isValidElement, cloneElement, type ReactNode, type ReactElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/stores/chat-store';
import { SourcePanel } from './SourceCard';
import { MessageActions } from './MessageActions';
import { CollapsibleBlock, parseStructuredBlocks } from './CollapsibleBlock';

interface MessageBubbleProps {
  message: ChatMessage;
  onEdit?: (message: ChatMessage) => void;
}

// ── Citation marker component ──

const CITATION_REGEX = /\[(\d+)\]/g;

function CitationMarker({ ref: refNum }: { ref: string }) {
  return (
    <sup
      className="inline-flex h-4 min-w-[16px] cursor-pointer items-center justify-center rounded bg-blue/10 px-1 text-[10px] font-bold text-blue transition-colors hover:bg-blue/20"
      title={`参考资料 ${refNum}`}
    >
      [{refNum}]
    </sup>
  );
}

/** Process React children to replace [N] text patterns with CitationMarker components */
function processCitations(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      const parts = child.split(CITATION_REGEX);
      if (parts.length === 1) return child;
      return parts.map((part, i) =>
        i % 2 === 0 ? part : <CitationMarker key={`cite-${i}`} ref={part} />,
      );
    }
    if (isValidElement(child) && (child.props as any)?.children) {
      return cloneElement(child as ReactElement<any>, {
        ...(child.props as any),
        children: processCitations((child.props as any).children),
      });
    }
    return child;
  });
}

// ── Markdown renderer with citation support ──

function MarkdownText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-2 mt-4 text-lg font-bold text-text-primary first:mt-0">{processCitations(children)}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-3 text-base font-bold text-text-primary first:mt-0">{processCitations(children)}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1.5 mt-2.5 text-sm font-bold text-text-primary first:mt-0">{processCitations(children)}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-2.5 last:mb-0 leading-relaxed">{processCitations(children)}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-2.5 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2.5 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="pl-1">{processCitations(children)}</li>
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <pre className="mb-2.5 overflow-x-auto rounded-lg bg-[#1a1b26] p-3.5 text-[13px] leading-relaxed last:mb-0">
                <code className="font-mono text-[#c0caf5]" {...props}>{children}</code>
              </pre>
            );
          }
          return (
            <code className="rounded bg-surface-elevated px-1.5 py-0.5 text-[12px] font-mono text-text-primary" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className="mb-2.5 border-l-2 border-blue/30 pl-3 text-text-secondary italic last:mb-0">
            {processCitations(children)}
          </blockquote>
        ),
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
          <td className="border-b border-border/50 px-3 py-1.5 text-text-secondary">{processCitations(children)}</td>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-blue underline decoration-blue/30 underline-offset-2 transition-colors hover:decoration-blue">
            {children}
          </a>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-text-primary">{processCitations(children)}</strong>
        ),
        hr: () => <hr className="my-3 border-border/50" />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

// ── Content renderer with structured block parsing ──

function MarkdownContent({ content }: { content: string }) {
  const blocks = parseStructuredBlocks(content);

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          return <MarkdownText key={`m-${i}`} text={block.content} />;
        }
        return (
          <CollapsibleBlock
            key={`b-${i}`}
            type={block.type}
            count={block.count}
            defaultOpen={block.type === 'todo'}
          >
            <MarkdownText text={block.content} />
          </CollapsibleBlock>
        );
      })}
    </>
  );
}

// ── Main Component ──

export function MessageBubble({ message, onEdit }: MessageBubbleProps) {
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

          {message.isStreaming && (
            <span className="mt-1 inline-block h-4 w-0.5 animate-pulse rounded-full bg-blue" />
          )}
        </div>

        {message.sources && message.sources.length > 0 && (
          <SourcePanel sources={message.sources} />
        )}

        {message.content && !message.isStreaming && (
          <MessageActions
            message={message}
            onEdit={onEdit ? () => onEdit(message) : undefined}
          />
        )}
      </div>
    </div>
  );
}
