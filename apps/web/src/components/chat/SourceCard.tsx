'use client';

import { useState } from 'react';
import type { Source } from '@/lib/sse-parser';
import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface SourcePanelProps {
  sources: Source[];
}

function relevanceLabel(score: number): { text: string; cls: string } {
  if (score >= 0.6) return { text: '高度相关', cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
  if (score >= 0.3) return { text: '相关', cls: 'bg-blue-500/10 text-blue border-blue/20' };
  if (score >= 0.1) return { text: '参考', cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
  return { text: '扩展', cls: 'bg-text-tertiary/10 text-text-tertiary border-border' };
}

export function SourcePanel({ sources }: SourcePanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources.length) return null;

  return (
    <div data-source-panel className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-surface/50">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated/50 hover:text-text-primary"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded bg-blue/10">
          <BookOpen className="h-3 w-3 text-blue" />
        </div>
        <span>参考了 {sources.length} 篇资料</span>
        <span className="flex-1" />
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-border/40 px-3 pb-3 pt-2">
          <div className="flex flex-col gap-1.5">
            {sources.map((source, i) => {
              const rel = relevanceLabel(source.score);
              const hasUrl = !!source.url;
              const handleClick = () => {
                if (hasUrl) window.open(source.url, '_blank', 'noopener,noreferrer');
              };
              return (
                <div
                  key={i}
                  id={`source-ref-${i + 1}`}
                  onClick={handleClick}
                  className={`group flex gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-elevated/50 ${hasUrl ? 'cursor-pointer' : ''}`}
                >
                  {/* Number badge */}
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-navy/8 text-[10px] font-bold text-navy">
                    {i + 1}
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-medium text-text-primary">
                        {source.title || '未命名来源'}
                      </p>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-px text-[10px] font-medium ${rel.cls}`}
                      >
                        {rel.text}
                      </span>
                      {hasUrl && (
                        <ExternalLink className="h-3 w-3 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </div>
                    {source.snippet && (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-text-tertiary">
                        {source.snippet}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
