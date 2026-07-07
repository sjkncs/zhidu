'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Newspaper,
  Loader2,
  AlertCircle,
  RefreshCw,
  Bell,
  Bookmark,
  Rss,
  Tag,
  Calendar,
  ExternalLink,
  Globe,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Announcement {
  title: string;
  category: string;
  publishedAt: string;
  summary: string;
}

interface BookmarkItem {
  title: string;
  url: string;
  tags: string[];
  savedAt: string;
}

interface FeedSource {
  name: string;
  type: string;
  status: string;
  lastFetchedAt: string | null;
  itemCount: number;
}

interface InfoCenterData {
  announcements: Announcement[];
  bookmarks: BookmarkItem[];
  feeds: FeedSource[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_STYLE: Record<string, string> = {
  update: 'bg-blue/10 text-blue border-blue/30',
  notice: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  feature: 'bg-green-500/10 text-green-600 border-green-500/30',
  maintenance: 'bg-red-500/10 text-red-500 border-red-500/30',
  news: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
};

const CATEGORY_LABEL: Record<string, string> = {
  update: '更新',
  notice: '通知',
  feature: '新功能',
  maintenance: '维护',
  news: '资讯',
};

const FEED_STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 border-green-500/30',
  inactive: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
  error: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const FEED_STATUS_LABEL: Record<string, string> = {
  active: '活跃',
  inactive: '未激活',
  error: '异常',
};

const FEED_TYPE_LABEL: Record<string, string> = {
  rss: 'RSS',
  api: 'API',
  webhook: 'Webhook',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Section: Announcements Feed
// ---------------------------------------------------------------------------

function AnnouncementsSection({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Bell className="w-5 h-5 text-blue" />
          公告动态
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Bell className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Bell className="w-5 h-5 text-blue" />
        公告动态
      </h2>
      <div className="space-y-4">
        {announcements.map((ann, idx) => {
          const catStyle = CATEGORY_STYLE[ann.category] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
          const catLabel = CATEGORY_LABEL[ann.category] || ann.category;

          return (
            <div key={idx} className="rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${catStyle}`}>
                    {catLabel}
                  </span>
                  <h3 className="text-sm font-medium text-text-primary truncate">{ann.title}</h3>
                </div>
              </div>
              <p className="text-sm text-text-secondary mb-2 line-clamp-2">{ann.summary}</p>
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(ann.publishedAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Bookmarks Grid
// ---------------------------------------------------------------------------

function BookmarksSection({ bookmarks }: { bookmarks: BookmarkItem[] }) {
  if (bookmarks.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Bookmark className="w-5 h-5 text-blue" />
          收藏夹
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Bookmark className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Bookmark className="w-5 h-5 text-blue" />
        收藏夹
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bookmarks.map((bm, idx) => (
          <div key={idx} className="rounded-lg border border-border bg-surface-elevated p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-medium text-text-primary line-clamp-1 flex-1 mr-2">
                {bm.title}
              </h3>
              <a
                href={bm.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-text-tertiary hover:text-blue transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            {bm.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {bm.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue/10 text-blue border border-blue/30">
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-text-tertiary">
              收藏于 {formatDate(bm.savedAt)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Feed Sources
// ---------------------------------------------------------------------------

function FeedSourcesSection({ feeds }: { feeds: FeedSource[] }) {
  if (feeds.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Rss className="w-5 h-5 text-blue" />
          订阅源
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Rss className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Rss className="w-5 h-5 text-blue" />
        订阅源
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">名称</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">类型</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">状态</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">条目数</th>
              <th className="text-right font-medium text-text-tertiary pb-3">最后抓取</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {feeds.map((feed) => {
              const statusStyle = FEED_STATUS_STYLE[feed.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
              const statusLabel = FEED_STATUS_LABEL[feed.status] || feed.status;

              return (
                <tr key={feed.name} className="hover:bg-surface-elevated transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                      <span className="font-medium text-text-primary">{feed.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-blue/10 text-blue border-blue/30">
                      {FEED_TYPE_LABEL[feed.type] || feed.type}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-text-primary">
                    {feed.itemCount}
                  </td>
                  <td className="py-3 text-right text-text-tertiary text-xs">
                    {formatDateTime(feed.lastFetchedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function InfoCenterPage() {
  const [data, setData] = useState<InfoCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/info-center');
      if (!res.ok) throw new Error('获取信息中心数据失败');
      const json = await res.json();
      const raw = json.data ?? json;
      const announcements = (raw.announcements ?? []).map((a: any) => ({
        title: a.title, category: a.category ?? 'general',
        publishedAt: a.published_at ?? '', summary: (a.content ?? '').slice(0, 120),
      }));
      const bookmarks = (raw.bookmarks ?? []).map((b: any) => ({
        title: b.title, url: b.url ?? '', tags: b.tags ?? [], savedAt: b.created_at ?? '',
      }));
      const feeds = (raw.feeds ?? []).map((f: any) => ({
        name: f.title ?? '', type: f.source ?? 'rss',
        status: f.is_active ? 'active' : 'inactive',
        lastFetchedAt: f.last_fetched_at ?? null, itemCount: 0,
      }));
      setData({ announcements, bookmarks, feeds });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <Newspaper className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">信息中心</h1>
            <p className="text-sm text-text-secondary">公告、收藏与订阅源</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <Newspaper className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">信息中心</h1>
            <p className="text-sm text-text-secondary">公告、收藏与订阅源</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <AlertCircle className="w-10 h-10 mb-3 text-red-500 opacity-60" />
          <p className="text-sm text-text-secondary mb-1">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
          <Newspaper className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">信息中心</h1>
          <p className="text-sm text-text-secondary">公告、收藏与订阅源</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.04] px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span className="text-sm text-text-secondary">{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      )}

      <AnnouncementsSection announcements={data?.announcements ?? []} />
      <BookmarksSection bookmarks={data?.bookmarks ?? []} />
      <FeedSourcesSection feeds={data?.feeds ?? []} />
    </div>
  );
}
