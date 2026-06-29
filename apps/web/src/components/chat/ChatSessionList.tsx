'use client';

import { useChatStore, type ChatSession } from '@/stores/chat-store';
import { Plus, Trash2, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

/** 相对时间格式化 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function ChatSessionList() {
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const fetchSessions = useChatStore((s) => s.fetchSessions);
  const loadSession = useChatStore((s) => s.loadSession);
  const createNewSession = useChatStore((s) => s.createNewSession);
  const deleteSession = useChatStore((s) => s.deleteSession);

  const [collapsed, setCollapsed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteSession(sessionId);
  };

  // 按最后活跃时间分组
  const today: ChatSession[] = [];
  const thisWeek: ChatSession[] = [];
  const older: ChatSession[] = [];

  const now = Date.now();
  for (const s of sessions) {
    const diff = now - new Date(s.lastActiveAt).getTime();
    if (diff < 86400000) today.push(s);
    else if (diff < 604800000) thisWeek.push(s);
    else older.push(s);
  }

  const renderGroup = (label: string, items: ChatSession[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-3">
        <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </p>
        {items.map((s) => (
          <button
            key={s.id}
            onClick={() => loadSession(s.id)}
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={[
              'group relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
              s.id === currentSessionId
                ? 'bg-blue/10 text-blue font-medium'
                : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
            ].join(' ')}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
            <span className="flex-1 truncate">{s.title || '新对话'}</span>
            <span className="shrink-0 text-[11px] text-text-tertiary">
              {formatRelativeTime(s.lastActiveAt)}
            </span>
            {hoveredId === s.id && !isStreaming && (
              <button
                onClick={(e) => handleDelete(e, s.id)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary hover:bg-red-50 hover:text-red-500"
                aria-label="删除对话"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </button>
        ))}
      </div>
    );
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-12 shrink-0 flex-col items-center border-r border-border bg-surface py-3">
        <button
          onClick={() => setCollapsed(false)}
          className="mb-4 rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-primary"
          aria-label="展开侧栏"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={createNewSession}
          disabled={isStreaming}
          className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:opacity-50"
          aria-label="新对话"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <h3 className="text-sm font-semibold text-text-primary">对话记录</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={createNewSession}
            disabled={isStreaming}
            className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:opacity-50"
            aria-label="新对话"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-primary"
            aria-label="收起侧栏"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-1 pb-3">
        {sessions.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-text-tertiary">
            暂无对话记录
          </p>
        ) : (
          <>
            {renderGroup('今天', today)}
            {renderGroup('近 7 天', thisWeek)}
            {renderGroup('更早', older)}
          </>
        )}
      </div>
    </div>
  );
}
