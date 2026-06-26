'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Plus,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  X,
  Check,
  StickyNote,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MemoItem {
  id: string;
  title: string | null;
  content: string;
  tags: string[];
  isPinned: boolean;
  remindAt: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MemoBoardProps {
  onMemoCreated?: () => void;
}

type FilterTab = 'all' | 'pinned' | 'archived';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TAG_COLORS = [
  'bg-blue/10 text-blue',
  'bg-emerald-500/10 text-emerald-600',
  'bg-amber-500/10 text-amber-600',
  'bg-rose-500/10 text-rose-600',
  'bg-violet-500/10 text-violet-600',
];

const MAX_CONTENT_LENGTH = 500;
const TRUNCATE_LENGTH = 150;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pinned', label: '置顶' },
  { key: 'archived', label: '已归档' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay === 1) return '昨天';
  if (diffDay < 30) return `${diffDay}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function tagColorClass(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MemoBoard({ onMemoCreated }: MemoBoardProps) {
  /* ---- state ---- */
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Compose area
  const [showCompose, setShowCompose] = useState(false);
  const [composeTitle, setComposeTitle] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [composeTags, setComposeTags] = useState<string[]>([]);
  const [composeTagInput, setComposeTagInput] = useState('');
  const [composePinned, setComposePinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit state — keyed by memo id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');

  // Expanded cards
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const composeRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- debounced search ---- */
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  /* ---- fetch memos ---- */
  const fetchMemos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (activeTab === 'pinned') params.set('isPinned', 'true');
      if (activeTab === 'archived') params.set('isArchived', 'true');
      if (activeTab === 'all') params.set('isArchived', 'false');
      if (debouncedQuery.trim()) params.set('search', debouncedQuery.trim());

      const res = await fetch(`/api/memo?${params.toString()}`);
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      const data = await res.json();
      const items: MemoItem[] = Array.isArray(data) ? data : data.data ?? data.memos ?? [];
      // Sort: pinned first, then by createdAt desc
      items.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setMemos(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载备忘录失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedQuery]);

  useEffect(() => {
    fetchMemos();
  }, [fetchMemos]);

  /* ---- create memo ---- */
  const handleCreate = useCallback(async () => {
    if (!composeContent.trim() && !composeTitle.trim()) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { content: composeContent.trim() };
      if (composeTitle.trim()) body.title = composeTitle.trim();
      if (composeTags.length > 0) body.tags = composeTags;
      if (composePinned) body.isPinned = true;

      const res = await fetch('/api/memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`创建失败 (${res.status})`);

      // Reset compose
      setComposeTitle('');
      setComposeContent('');
      setComposeTags([]);
      setComposeTagInput('');
      setComposePinned(false);
      setShowCompose(false);
      onMemoCreated?.();
      fetchMemos();
    } catch {
      setError('创建备忘录失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [composeContent, composeTitle, composeTags, composePinned, fetchMemos, onMemoCreated]);

  /* ---- update memo ---- */
  const handleUpdate = useCallback(
    async (id: string, updates: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/memo/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error(`更新失败 (${res.status})`);
        fetchMemos();
      } catch {
        setError('更新备忘录失败');
      }
    },
    [fetchMemos],
  );

  /* ---- delete memo ---- */
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/memo/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`删除失败 (${res.status})`);
        fetchMemos();
      } catch {
        setError('删除备忘录失败');
      }
    },
    [fetchMemos],
  );

  /* ---- tag helpers ---- */
  const addComposeTag = useCallback(() => {
    const tag = composeTagInput.trim();
    if (tag && !composeTags.includes(tag)) {
      setComposeTags((prev) => [...prev, tag]);
    }
    setComposeTagInput('');
  }, [composeTagInput, composeTags]);

  const addEditTag = useCallback(() => {
    const tag = editTagInput.trim();
    if (tag && !editTags.includes(tag)) {
      setEditTags((prev) => [...prev, tag]);
    }
    setEditTagInput('');
  }, [editTagInput, editTags]);

  /* ---- edit helpers ---- */
  const startEdit = useCallback((memo: MemoItem) => {
    setEditingId(memo.id);
    setEditTitle(memo.title ?? '');
    setEditContent(memo.content);
    setEditTags([...memo.tags]);
    setEditTagInput('');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditTags([]);
    setEditTagInput('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const updates: Record<string, unknown> = {
      content: editContent.trim(),
      title: editTitle.trim() || null,
      tags: editTags,
    };
    await handleUpdate(editingId, updates);
    cancelEdit();
  }, [editingId, editContent, editTitle, editTags, handleUpdate, cancelEdit]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ---- display title ---- */
  const displayTitle = (memo: MemoItem): string => {
    if (memo.title) return memo.title;
    const firstLine = memo.content.split('\n')[0];
    return truncate(firstLine, 50);
  };

  /* ---- pinned / archive actions ---- */
  const togglePin = useCallback(
    (memo: MemoItem) => handleUpdate(memo.id, { isPinned: !memo.isPinned }),
    [handleUpdate],
  );

  const toggleArchive = useCallback(
    (memo: MemoItem) => handleUpdate(memo.id, { isArchived: !memo.isArchived }),
    [handleUpdate],
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-full w-full">
      {/* ====== Header Bar ====== */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-2 sm:px-6">
        {/* Search + Quick Add */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="搜索备忘录..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue/30 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-text-tertiary hover:text-text-secondary transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowCompose((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue/90 transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">新建</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-blue/10 text-blue'
                  : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ====== Error Banner ====== */}
      {error && (
        <div className="mx-4 sm:mx-6 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 text-rose-600 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="p-0.5 hover:text-rose-800 transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ====== Quick Capture / Compose Area ====== */}
      {showCompose && (
        <div
          ref={composeRef}
          className="mx-4 sm:mx-6 mb-3 rounded-xl border border-border bg-surface overflow-hidden transition"
        >
          {/* Optional title */}
          <div className="px-3 pt-3">
            <input
              type="text"
              placeholder="标题（可选）"
              value={composeTitle}
              onChange={(e) => setComposeTitle(e.target.value)}
              className="w-full text-sm font-semibold text-text-primary bg-transparent border-none outline-none placeholder:text-text-tertiary"
            />
          </div>

          {/* Content textarea */}
          <div className="px-3 pt-1">
            <textarea
              placeholder="写点什么..."
              value={composeContent}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CONTENT_LENGTH) {
                  setComposeContent(e.target.value);
                }
              }}
              onFocus={() => {}}
              rows={3}
              className="w-full text-sm text-text-primary bg-transparent border-none outline-none resize-none placeholder:text-text-tertiary min-h-[80px] focus:min-h-[120px] transition-all"
            />
          </div>

          {/* Tag chips */}
          {composeTags.length > 0 && (
            <div className="px-3 pb-1 flex flex-wrap gap-1.5">
              {composeTags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tagColorClass(tag)}`}
                >
                  {tag}
                  <button
                    onClick={() => setComposeTags((prev) => prev.filter((t) => t !== tag))}
                    className="hover:opacity-70 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Tag input */}
          <div className="px-3 pb-2">
            <input
              type="text"
              placeholder="添加标签，按回车确认..."
              value={composeTagInput}
              onChange={(e) => setComposeTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addComposeTag();
                }
              }}
              className="w-full text-xs text-text-secondary bg-transparent border-none outline-none placeholder:text-text-tertiary"
            />
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-border">
            <div className="flex items-center gap-3">
              {/* Pin toggle */}
              <button
                onClick={() => setComposePinned((v) => !v)}
                className={`p-1.5 rounded-md transition ${
                  composePinned ? 'text-blue bg-blue/10' : 'text-text-tertiary hover:text-text-secondary'
                }`}
                title={composePinned ? '取消置顶' : '置顶'}
              >
                <Pin className="w-4 h-4" />
              </button>
              {/* Character count */}
              <span
                className={`text-xs ${
                  composeContent.length > MAX_CONTENT_LENGTH * 0.9
                    ? 'text-rose-500'
                    : 'text-text-tertiary'
                }`}
              >
                {composeContent.length}/{MAX_CONTENT_LENGTH}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowCompose(false);
                  setComposeTitle('');
                  setComposeContent('');
                  setComposeTags([]);
                  setComposeTagInput('');
                  setComposePinned(false);
                }}
                className="px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary transition"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || (!composeContent.trim() && !composeTitle.trim())}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue text-white text-sm font-medium hover:bg-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                发布
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Memo Grid ====== */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && memos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4">
              <StickyNote className="w-8 h-8 text-text-tertiary" />
            </div>
            <p className="text-text-secondary text-sm font-medium mb-1">
              {debouncedQuery ? '没有找到匹配的备忘录' : '还没有备忘录'}
            </p>
            <p className="text-text-tertiary text-xs">
              {debouncedQuery ? '试试其他关键词' : '点击上方按钮创建第一条备忘录'}
            </p>
          </div>
        )}

        {/* Grid */}
        {!loading && memos.length > 0 && (
          <div className="columns-1 sm:columns-2 gap-3 space-y-3">
            {memos.map((memo) => {
              const isEditing = editingId === memo.id;
              const isExpanded = expandedIds.has(memo.id);
              const shouldTruncate = memo.content.length > TRUNCATE_LENGTH && !isExpanded;

              return (
                <div
                  key={memo.id}
                  className={`break-inside-avoid rounded-xl border bg-surface transition ${
                    memo.isPinned
                      ? 'border-blue/30 ring-1 ring-blue/10'
                      : 'border-border'
                  }`}
                >
                  {/* Card body */}
                  <div className="p-3">
                    {isEditing ? (
                      /* ---- Edit Mode ---- */
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="标题（可选）"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full text-sm font-semibold text-text-primary bg-transparent border border-border rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue/30 transition"
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={4}
                          className="w-full text-sm text-text-primary bg-transparent border border-border rounded-md px-2 py-1.5 outline-none resize-none focus:ring-2 focus:ring-blue/30 transition"
                        />
                        {/* Edit tag chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {editTags.map((tag) => (
                            <span
                              key={tag}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tagColorClass(tag)}`}
                            >
                              {tag}
                              <button
                                onClick={() => setEditTags((prev) => prev.filter((t) => t !== tag))}
                                className="hover:opacity-70 transition"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="添加标签..."
                            value={editTagInput}
                            onChange={(e) => setEditTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addEditTag();
                              }
                            }}
                            className="flex-1 text-xs text-text-secondary bg-transparent border border-border rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue/30 transition"
                          />
                        </div>
                      </div>
                    ) : (
                      /* ---- Display Mode ---- */
                      <div>
                        {/* Title row */}
                        <div className="flex items-start gap-1.5 mb-1">
                          {memo.isPinned && (
                            <Pin className="w-3.5 h-3.5 text-blue shrink-0 mt-0.5" />
                          )}
                          <h3 className="text-sm font-semibold text-text-primary leading-snug flex-1">
                            {displayTitle(memo)}
                          </h3>
                        </div>

                        {/* Content */}
                        <div
                          className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap cursor-pointer"
                          onClick={() => toggleExpand(memo.id)}
                        >
                          {shouldTruncate
                            ? truncate(memo.content, TRUNCATE_LENGTH)
                            : memo.content}
                          {memo.content.length > TRUNCATE_LENGTH && (
                            <span className="text-text-tertiary text-xs ml-1">
                              {isExpanded ? '收起' : '展开'}
                            </span>
                          )}
                        </div>

                        {/* Tags */}
                        {memo.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {memo.tags.map((tag) => (
                              <span
                                key={tag}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${tagColorClass(tag)}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Reminder badge */}
                        {memo.remindAt && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(memo.remindAt).toLocaleString('zh-CN')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="flex items-center justify-between px-3 py-2 border-t border-border">
                    {/* Timestamp */}
                    <span className="text-xs text-text-tertiary flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {relativeTime(memo.createdAt)}
                    </span>

                    {/* Action buttons */}
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={cancelEdit}
                          className="px-2 py-1 rounded-md text-xs text-text-secondary hover:text-text-primary transition"
                        >
                          取消
                        </button>
                        <button
                          onClick={saveEdit}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-blue text-white hover:bg-blue/90 transition"
                        >
                          <Check className="w-3 h-3" />
                          保存
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5 group/card">
                        <button
                          onClick={() => startEdit(memo)}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface transition opacity-0 group-hover/card:opacity-100 focus:opacity-100"
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => togglePin(memo)}
                          className={`p-1.5 rounded-md transition opacity-0 group-hover/card:opacity-100 focus:opacity-100 ${
                            memo.isPinned
                              ? 'text-blue hover:text-blue/80'
                              : 'text-text-tertiary hover:text-text-primary'
                          }`}
                          title={memo.isPinned ? '取消置顶' : '置顶'}
                        >
                          {memo.isPinned ? (
                            <PinOff className="w-3.5 h-3.5" />
                          ) : (
                            <Pin className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => toggleArchive(memo)}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface transition opacity-0 group-hover/card:opacity-100 focus:opacity-100"
                          title={memo.isArchived ? '取消归档' : '归档'}
                        >
                          {memo.isArchived ? (
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(memo.id)}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-rose-500 hover:bg-rose-500/10 transition opacity-0 group-hover/card:opacity-100 focus:opacity-100"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
