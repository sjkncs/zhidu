'use client';

import { useState } from 'react';
import { Brain, ListChecks, CheckCircle, Wrench, PlayCircle, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type BlockType = 'thinking' | 'steps' | 'todo' | 'tool-call' | 'action-item';

interface CollapsibleBlockProps {
  type: BlockType;
  title?: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const TYPE_CONFIG: Record<BlockType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  border: string;
  bg: string;
  text: string;
  hover: string;
  badge: string;
  iconBg: string;
  iconColor?: string;
}> = {
  thinking: {
    icon: Brain,
    label: '深度思考',
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/[0.03]',
    text: 'text-purple-400',
    hover: 'hover:bg-purple-500/[0.06]',
    badge: 'bg-purple-500/10 text-purple-400',
    iconBg: 'bg-purple-500/10',
    iconColor: '#a855f7',
  },
  steps: {
    icon: ListChecks,
    label: '执行步骤',
    border: 'border-blue/20',
    bg: 'bg-blue/[0.03]',
    text: 'text-blue',
    hover: 'hover:bg-blue/[0.06]',
    badge: 'bg-blue/10 text-blue',
    iconBg: 'bg-blue/10',
    iconColor: undefined,
  },
  todo: {
    icon: CheckCircle,
    label: '已更新待办',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/[0.03]',
    text: 'text-emerald-400',
    hover: 'hover:bg-emerald-500/[0.06]',
    badge: 'bg-emerald-500/10 text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    iconColor: '#10b981',
  },
  'tool-call': {
    icon: Wrench,
    label: '工具调用',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/[0.03]',
    text: 'text-amber-400',
    hover: 'hover:bg-amber-500/[0.06]',
    badge: 'bg-amber-500/10 text-amber-400',
    iconBg: 'bg-amber-500/10',
    iconColor: '#f59e0b',
  },
  'action-item': {
    icon: PlayCircle,
    label: '推荐操作',
    border: 'border-blue/20',
    bg: 'bg-blue/[0.03]',
    text: 'text-blue',
    hover: 'hover:bg-blue/[0.06]',
    badge: 'bg-blue/10 text-blue',
    iconBg: 'bg-blue/10',
    iconColor: undefined,
  },
};

export function CollapsibleBlock({ type, title, count, defaultOpen = false, children }: CollapsibleBlockProps) {
  const [open, setOpen] = useState(defaultOpen);
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className={`mb-3 overflow-hidden rounded-xl border ${config.border} ${config.bg}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium ${config.text} transition-colors ${config.hover}`}
      >
        <div className={`flex h-5 w-5 items-center justify-center rounded-md ${config.iconBg}`}>
          <Icon className="h-3.5 w-3.5" style={config.iconColor ? { color: config.iconColor } : undefined} />
        </div>
        <span>{title || config.label}</span>
        {count !== undefined && count > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${config.badge}`}>
            {count}
          </span>
        )}
        <span className="flex-1" />
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-current/5 px-4 py-3">
            <div className="text-[13px] leading-relaxed text-text-secondary">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Parse structured blocks from markdown content.
 * Supports:
 *   <!-- type:thinking -->...<!-- /thinking -->
 *   <!-- type:steps count:3 -->...<!-- /steps -->
 *   <!-- type:todo count:2 -->...<!-- /todo -->
 *   <!-- type:tool-call -->...<!-- /tool-call -->
 *   <!-- type:action-item -->...<!-- /action-item -->
 *
 * Also supports legacy format:
 *   <!-- thinking -->...<!-- /thinking -->
 */
export interface ParsedBlock {
  type: 'text' | BlockType;
  content: string;
  count?: number;
}

const BLOCK_REGEX = /<!--\s*type:(\w[\w-]*)(?:\s+count:(\d+))?\s*-->([\s\S]*?)<!--\s*\/\1\s*-->/g;
const LEGACY_THINKING_REGEX = /<!--\s*thinking\s*-->([\s\S]*?)<!--\s*\/thinking\s*-->/g;

export function parseStructuredBlocks(content: string): ParsedBlock[] {
  // Pre-process: fix common LLM typos in HTML comment markers
  let sanitized = content
    // First: handle orphaned closing tags (</--, </ --) that appear WITHOUT a matching block type
    // These should be removed entirely, not converted
    .replace(/<\/\s*--\s*$/gm, '')                 // </-- at end of line → remove
    .replace(/<\/\s*--\s*(?=\n|$)/gm, '')          // </-- followed by newline/end → remove
    // Opening tags: <! --, <1--, < !-- , <!- -, etc → <!--
    .replace(/<\s*!\s*--\s*/g, '<!-- ')
    .replace(/<1\s*--\s*/g, '<!-- ')
    .replace(/<!-\s*-\s*/g, '<!-- ')
    // Closing tag remnants
    .replace(/--\s*1>/g, '-->')
    .replace(/--\s*!>/g, '-->')
    .replace(/-\s*-!>/g, '-->')
    // Fix closing tags that use </type> instead of <!-- /type -->
    .replace(/<\/\s*(thinking|steps|todo|tool-call|action-item)\s*>/g, '<!-- /$1 -->');

  const parts: ParsedBlock[] = [];
  const allMatches: Array<{ start: number; end: number; type: BlockType; content: string; count?: number }> = [];

  // Collect all block matches (new format)
  let match;
  const blockRegex = new RegExp(BLOCK_REGEX.source, 'g');
  while ((match = blockRegex.exec(sanitized)) !== null) {
    allMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      type: match[1] as BlockType,
      count: match[2] ? parseInt(match[2]) : undefined,
      content: match[3].trim(),
    });
  }

  // Collect legacy thinking blocks
  const legacyRegex = new RegExp(LEGACY_THINKING_REGEX.source, 'g');
  while ((match = legacyRegex.exec(sanitized)) !== null) {
    // Skip if already captured by new format
    const alreadyCovered = allMatches.some(
      (m) => match!.index >= m.start && match!.index < m.end,
    );
    if (!alreadyCovered) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'thinking',
        content: match[1].trim(),
      });
    }
  }

  // Fallback: catch orphaned opening tags with malformed/missing closers
  // Pattern: <!-- type:X --> ... followed by </--, end of string, or next block
  const orphanRegex = /<!--\s*type:(\w[\w-]*)(?:\s+count:(\d+))?\s*-->([\s\S]*?)(?:<!--\s*\/[^>]*-->|<\/\s*--\s*|<\/\w+\s*>|$)/g;
  while ((match = orphanRegex.exec(sanitized)) !== null) {
    const alreadyCovered = allMatches.some(
      (m) => match!.index >= m.start && match!.index < m.end,
    );
    if (!alreadyCovered) {
      const blockType = match[1] as BlockType;
      const validTypes: BlockType[] = ['thinking', 'steps', 'todo', 'tool-call', 'action-item'];
      if (validTypes.includes(blockType)) {
        allMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          type: blockType,
          count: match[2] ? parseInt(match[2]) : undefined,
          content: match[3].trim(),
        });
      }
    }
  }

  // Sort by position
  allMatches.sort((a, b) => a.start - b.start);

  // Build parts array with text segments between blocks
  let lastIndex = 0;
  for (const m of allMatches) {
    if (m.start > lastIndex) {
      const text = sanitized.slice(lastIndex, m.start).trim();
      if (text) parts.push({ type: 'text', content: text });
    }
    parts.push({ type: m.type, content: m.content, count: m.count });
    lastIndex = m.end;
  }

  // Remaining text after last block
  if (lastIndex < sanitized.length) {
    const text = sanitized.slice(lastIndex).trim();
    if (text) parts.push({ type: 'text', content: text });
  }

  // If no blocks found, return the whole content as text
  if (parts.length === 0) {
    parts.push({ type: 'text', content: sanitized });
  }

  return parts;
}
