'use client';

import { useState } from 'react';
import type { Source } from '@/lib/sse-parser';
import { FileText, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface SourcePanelProps {
  sources: Source[];
}

function scoreColor(score: number): string {
  if (score >= 0.5) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 0.2) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-gray-500 bg-gray-50 border-gray-200';
}

export function SourcePanel({ sources }: SourcePanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources.length) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-background">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
      >
        <FileText className="h-3.5 w-3.5" />
        <span>参考了 {sources.length} 篇资料</span>
        <span className="flex-1" />
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2">
          <div className="flex flex-col gap-2">
            {sources.map((source, i) => (
              <div
                key={i}
                className="flex gap-2 rounded-md border border-border bg-surface p-2.5"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-navy/10 text-[10px] font-bold text-navy">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-text-primary">
                    {source.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-text-tertiary">
                    {source.snippet}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${scoreColor(source.score)}`}
                >
                  {(source.score * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
