'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Bookmark, BookOpen, ExternalLink,
  FileText, Brain, ChevronDown, ChevronRight, Tag, Star,
  Satellite, TrendingUp, FlaskConical, Briefcase, X, Loader2,
} from 'lucide-react';

// ─── 类型 ───────────────────────────────────────────────────────────────

interface Paper {
  id: string;
  arxivId: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  primaryCategory: string;
  publishedAt: string;
  aiSummary: string | null;
  aiTags: string[];
  relevanceScores: Record<string, number>;
  pdfUrl: string;
  absUrl: string;
  userInteraction: {
    bookmarked: boolean;
    read: boolean;
    note: string | null;
    rating: number | null;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── 分类配置 ───────────────────────────────────────────────────────────

const CATEGORY_GROUPS = [
  { label: '全部', value: '', icon: Satellite },
  { label: 'AI/ML', value: 'cs.AI,cs.LG,cs.CL,stat.ML', icon: Brain },
  { label: '量化金融', value: 'q-fin.ST,q-fin.CP,q-fin.PM,q-fin.TR', icon: TrendingUp },
  { label: '数学/统计', value: 'math.OC,math.PR,stat.ML', icon: FileText },
  { label: '交叉科学', value: 'physics.soc-ph,physics.data-an', icon: FlaskConical },
  { label: '经济学', value: 'econ.EM,econ.GN', icon: Briefcase },
];

// ─── 主组件 ─────────────────────────────────────────────────────────────

export default function PapersRadar() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [page, setPage] = useState(1);

  // 加载论文列表
  const fetchPapers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (activeCategory) params.set('category', activeCategory);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/papers?${params}`);
      const json = await res.json();
      if (json.success) {
        setPapers(json.data);
        setPagination(json.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch papers:', err);
    } finally {
      setLoading(false);
    }
  }, [query, activeCategory, page]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // 同步 arXiv
  const handleSync = async () => {
    setSyncing(true);
    try {
      const categories = activeCategory ? activeCategory.split(',') : undefined;
      const keywords = query ? [query] : undefined;
      const res = await fetch('/api/papers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories, keywords, maxResults: 50 }),
      });
      const json = await res.json();
      if (json.success) {
        const { inserted, updated } = json.data;
        // 刷新列表
        await fetchPapers();
        // 简单提示
        console.log(`Sync complete: ${inserted} new, ${updated} updated`);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  // AI 摘要生成
  const handleAiSummary = async (paper: Paper) => {
    if (paper.aiSummary && !confirm('已有 AI 摘要，是否重新生成？')) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/papers/${paper.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (json.success) {
        setSelectedPaper(prev => prev ? { ...prev, ...json.data } : prev);
        // 更新列表中的论文
        setPapers(prev => prev.map(p =>
          p.id === paper.id
            ? { ...p, aiSummary: json.data.aiSummary, aiTags: json.data.aiTags, relevanceScores: json.data.relevanceScores }
            : p,
        ));
      }
    } catch (err) {
      console.error('AI summary failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // 收藏/已读切换
  const handleInteraction = async (paperId: string, action: string) => {
    try {
      await fetch(`/api/papers/${paperId}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await fetchPapers();
    } catch (err) {
      console.error('Interaction failed:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* 搜索栏 + 同步按钮 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="搜索论文标题、摘要、标签..."
            className="w-full rounded-lg border border-border bg-surface py-2 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-violet focus:outline-none focus:ring-1 focus:ring-violet/30"
          />
          {query && (
            <button onClick={() => { setQuery(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-text-tertiary hover:text-text-primary" />
            </button>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '同步中...' : '同步 arXiv'}
        </button>
      </div>

      {/* 分类标签 */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_GROUPS.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.value;
          return (
            <button
              key={cat.label}
              onClick={() => { setActiveCategory(cat.value); setPage(1); }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-violet/15 text-violet border border-violet/30'
                  : 'bg-surface-elevated/50 text-text-secondary border border-transparent hover:border-border'
              }`}
            >
              <Icon className="h-3 w-3" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* 统计信息 */}
      {pagination && (
        <p className="text-xs text-text-tertiary">
          共 {pagination.total} 篇论文 · 第 {pagination.page}/{pagination.totalPages} 页
        </p>
      )}

      {/* 主体：论文列表 + 详情面板 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* 论文列表 */}
        <div className="space-y-2 lg:col-span-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-violet" />
              <span className="ml-2 text-sm text-text-secondary">加载中...</span>
            </div>
          ) : papers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <Satellite className="mx-auto h-8 w-8 text-text-tertiary" />
              <p className="mt-2 text-sm text-text-secondary">
                {query || activeCategory ? '未找到匹配的论文' : '暂无论文数据'}
              </p>
              <button onClick={handleSync} className="mt-3 text-sm text-violet hover:underline">
                从 arXiv 同步最新论文
              </button>
            </div>
          ) : (
            papers.map(paper => (
              <PaperCard
                key={paper.id}
                paper={paper}
                isSelected={selectedPaper?.id === paper.id}
                onSelect={() => setSelectedPaper(paper)}
                onBookmark={() => handleInteraction(paper.id, 'bookmark')}
                onRead={() => handleInteraction(paper.id, 'read')}
              />
            ))
          )}

          {/* 分页 */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-border px-3 py-1 text-xs text-text-secondary disabled:opacity-40"
              >
                上一页
              </button>
              <span className="text-xs text-text-tertiary">{page} / {pagination.totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="rounded border border-border px-3 py-1 text-xs text-text-secondary disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          )}
        </div>

        {/* 详情面板 */}
        <div className="lg:col-span-2">
          {selectedPaper ? (
            <PaperDetail
              paper={selectedPaper}
              aiLoading={aiLoading}
              onAiSummary={() => handleAiSummary(selectedPaper)}
              onClose={() => setSelectedPaper(null)}
              onBookmark={() => handleInteraction(selectedPaper.id, 'bookmark')}
            />
          ) : (
            <div className="sticky top-20 rounded-xl border border-dashed border-border p-6 text-center">
              <BookOpen className="mx-auto h-6 w-6 text-text-tertiary" />
              <p className="mt-2 text-sm text-text-tertiary">点击论文查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 论文卡片 ───────────────────────────────────────────────────────────

function PaperCard({
  paper, isSelected, onSelect, onBookmark, onRead,
}: {
  paper: Paper;
  isSelected: boolean;
  onSelect: () => void;
  onBookmark: () => void;
  onRead: () => void;
}) {
  const date = paper.publishedAt ? new Date(paper.publishedAt).toLocaleDateString('zh-CN') : '';
  const hasSummary = !!paper.aiSummary;

  return (
    <div
      onClick={onSelect}
      className={`group cursor-pointer rounded-lg border p-3 transition-colors ${
        isSelected
          ? 'border-violet/40 bg-violet/5'
          : 'border-border/60 bg-surface hover:border-border hover:bg-surface-elevated/30'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {/* 标题 */}
          <h3 className="text-sm font-medium leading-snug text-text-primary line-clamp-2">
            {paper.title}
          </h3>
          {/* 元信息 */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
            <span>{paper.authors?.slice(0, 3).join(', ')}{paper.authors?.length > 3 ? ` +${paper.authors.length - 3}` : ''}</span>
            <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
              {paper.primaryCategory}
            </span>
            <span>{date}</span>
            {hasSummary && (
              <span className="flex items-center gap-0.5 text-violet">
                <Brain className="h-3 w-3" /> AI 摘要
              </span>
            )}
          </div>
          {/* AI 标签 */}
          {paper.aiTags && paper.aiTags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {paper.aiTags.slice(0, 4).map(tag => (
                <span key={tag} className="rounded-full bg-violet/8 px-2 py-0.5 text-[10px] text-violet">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* 操作按钮 */}
        <div className="flex shrink-0 flex-col gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={onBookmark}
            className={`rounded p-1 transition-colors ${
              paper.userInteraction?.bookmarked
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
            title={paper.userInteraction?.bookmarked ? '取消收藏' : '收藏'}
          >
            <Bookmark className={`h-4 w-4 ${paper.userInteraction?.bookmarked ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={onRead}
            className={`rounded p-1 transition-colors ${
              paper.userInteraction?.read
                ? 'text-emerald-500'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
            title="标记已读"
          >
            <BookOpen className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 论文详情面板 ───────────────────────────────────────────────────────

function PaperDetail({
  paper, aiLoading, onAiSummary, onClose, onBookmark,
}: {
  paper: Paper;
  aiLoading: boolean;
  onAiSummary: () => void;
  onClose: () => void;
  onBookmark: () => void;
}) {
  return (
    <div className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-4 overflow-y-auto rounded-xl border border-border/60 bg-surface p-4">
      {/* 标题栏 */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-snug text-text-primary">{paper.title}</h2>
        <button onClick={onClose} className="shrink-0 rounded p-1 text-text-tertiary hover:text-text-primary">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 元信息 */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
        <span className="rounded bg-surface-elevated px-2 py-0.5 font-medium text-text-secondary">
          {paper.primaryCategory}
        </span>
        <span>{paper.publishedAt ? new Date(paper.publishedAt).toLocaleDateString('zh-CN') : ''}</span>
        <span>arXiv: {paper.arxivId}</span>
      </div>

      {/* 作者 */}
      <p className="text-xs text-text-secondary">
        {paper.authors?.join(', ')}
      </p>

      {/* 外部链接 */}
      <div className="flex gap-2">
        <a href={paper.absUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated">
          <ExternalLink className="h-3 w-3" /> arXiv
        </a>
        <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated">
          <FileText className="h-3 w-3" /> PDF
        </a>
        <button onClick={onBookmark}
          className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            paper.userInteraction?.bookmarked
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-600'
              : 'border-border text-text-secondary hover:bg-surface-elevated'
          }`}>
          <Bookmark className={`h-3 w-3 ${paper.userInteraction?.bookmarked ? 'fill-current' : ''}`} />
          {paper.userInteraction?.bookmarked ? '已收藏' : '收藏'}
        </button>
      </div>

      {/* 摘要 */}
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary">摘要</h3>
        <p className="text-sm leading-relaxed text-text-secondary">{paper.abstract}</p>
      </div>

      {/* AI 增强摘要 */}
      <div className="rounded-lg border border-violet/20 bg-violet/5 p-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet">
            <Brain className="h-3.5 w-3.5" /> AI 增强摘要
          </h3>
          <button
            onClick={onAiSummary}
            disabled={aiLoading}
            className="flex items-center gap-1 rounded-md border border-violet/20 px-2 py-1 text-[10px] font-medium text-violet transition-colors hover:bg-violet/10 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
            {paper.aiSummary ? '重新生成' : '生成摘要'}
          </button>
        </div>
        {paper.aiSummary ? (
          <div className="mt-2 space-y-3">
            <p className="text-sm leading-relaxed text-text-primary">{paper.aiSummary}</p>

            {/* 相关度评分 */}
            {paper.relevanceScores && Object.keys(paper.relevanceScores).length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">交叉相关度</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(paper.relevanceScores).map(([key, score]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-12 text-[10px] text-text-tertiary">{scoreLabel(key)}</span>
                      <div className="flex-1 rounded-full bg-border/40 h-1.5">
                        <div
                          className="h-full rounded-full bg-violet transition-all"
                          style={{ width: `${(score as number) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[10px] font-medium text-text-secondary">
                        {((score as number) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-text-tertiary">
            点击"生成摘要"获取 AI 中文摘要和投资/科研交叉洞察
          </p>
        )}
      </div>

      {/* AI 标签 */}
      {paper.aiTags && paper.aiTags.length > 0 && (
        <div>
          <h3 className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            <Tag className="h-3 w-3" /> 关键词标签
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {paper.aiTags.map(tag => (
              <span key={tag} className="rounded-full bg-violet/8 px-2.5 py-0.5 text-[11px] font-medium text-violet">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 分类 */}
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary">arXiv 分类</h3>
        <div className="flex flex-wrap gap-1.5">
          {paper.categories?.map(cat => (
            <span key={cat} className="rounded bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary">
              {cat}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 辅助函数 ───────────────────────────────────────────────────────────

function scoreLabel(key: string): string {
  const labels: Record<string, string> = {
    investment: '投资',
    quant: '量化',
    research: '科研',
    career: '职业',
  };
  return labels[key] || key;
}
