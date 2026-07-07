'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  TrendingUp,
  FileText,
  Target,
  Globe,
  MessageCircle,
  Video,
  Image,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Channel {
  platform: string;
  followers: number;
  engagementRate: number;
}

interface Campaign {
  name: string;
  type: string;
  status: string;
  budget: number;
  progress: number;
}

interface ContentItem {
  title: string;
  type: string;
  status: string;
  publishedAt: string | null;
}

interface BrandOpsData {
  channels: Channel[];
  campaigns: Campaign[];
  content: ContentItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_ICON: Record<string, typeof Globe> = {
  wechat: MessageCircle,
  weibo: Globe,
  douyin: Video,
  xiaohongshu: Image,
  bilibili: Video,
  zhihu: FileText,
};

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 border-green-500/30',
  running: 'bg-green-500/10 text-green-600 border-green-500/30',
  completed: 'bg-blue/10 text-blue border-blue/30',
  paused: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  draft: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
  published: 'bg-green-500/10 text-green-600 border-green-500/30',
  scheduled: 'bg-blue/10 text-blue border-blue/30',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const STATUS_LABEL: Record<string, string> = {
  active: '进行中',
  running: '运行中',
  completed: '已完成',
  paused: '已暂停',
  draft: '草稿',
  published: '已发布',
  scheduled: '已排期',
  cancelled: '已取消',
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  article: '文章',
  video: '视频',
  image: '图文',
  post: '帖子',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(fen: number): string {
  return (fen / 100).toFixed(2);
}

function formatNumber(num: number): string {
  if (num >= 10_000) return `${(num / 10_000).toFixed(1)}万`;
  return num.toLocaleString();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] || status;
  const style = STATUS_STYLE[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section: Channel Cards
// ---------------------------------------------------------------------------

function ChannelCards({ channels }: { channels: Channel[] }) {
  if (channels.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Users className="w-5 h-5 text-blue" />
          渠道概览
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Users className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Users className="w-5 h-5 text-blue" />
        渠道概览
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {channels.map((ch) => {
          const IconComponent = PLATFORM_ICON[ch.platform] || Globe;
          return (
            <div key={ch.platform} className="rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue/10">
                  <IconComponent className="h-4 w-4 text-blue" />
                </div>
                <span className="text-sm font-medium text-text-primary capitalize">{ch.platform}</span>
              </div>
              <p className="text-xl font-bold text-text-primary mb-1">
                {formatNumber(ch.followers)}
              </p>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <span className="text-xs text-text-tertiary">
                  互动率 {ch.engagementRate.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Active Campaigns
// ---------------------------------------------------------------------------

function CampaignsSection({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Target className="w-5 h-5 text-blue" />
          活动管理
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Target className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Target className="w-5 h-5 text-blue" />
        活动管理
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">名称</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">类型</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">状态</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">预算</th>
              <th className="text-right font-medium text-text-tertiary pb-3 min-w-[120px]">进度</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {campaigns.map((c) => (
              <tr key={c.name} className="hover:bg-surface-elevated transition-colors">
                <td className="py-3 pr-4 font-medium text-text-primary">{c.name}</td>
                <td className="py-3 pr-4 text-text-secondary">{c.type}</td>
                <td className="py-3 pr-4 text-center"><StatusBadge status={c.status} /></td>
                <td className="py-3 pr-4 text-right font-semibold text-text-primary">
                  &yen;{formatAmount(c.budget)}
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-border/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue transition-all"
                        style={{ width: `${Math.min(c.progress, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-text-secondary w-10 text-right">
                      {c.progress.toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Content Pipeline
// ---------------------------------------------------------------------------

function ContentPipelineSection({ items }: { items: ContentItem[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <FileText className="w-5 h-5 text-blue" />
          内容管道
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <FileText className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <FileText className="w-5 h-5 text-blue" />
        内容管道
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.title} className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue/10">
                <FileText className="h-4 w-4 text-blue" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{item.title}</p>
                <p className="text-xs text-text-tertiary">
                  {CONTENT_TYPE_LABEL[item.type] || item.type}
                  {item.publishedAt && ` · ${formatDate(item.publishedAt)}`}
                </p>
              </div>
            </div>
            <StatusBadge status={item.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function BrandOpsPage() {
  const [data, setData] = useState<BrandOpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/brand');
      if (!res.ok) throw new Error('获取品牌运营信息失败');
      const json = await res.json();
      setData(json.data ?? json);
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
            <Megaphone className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">品牌运营</h1>
            <p className="text-sm text-text-secondary">渠道、活动与内容管理</p>
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
            <Megaphone className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">品牌运营</h1>
            <p className="text-sm text-text-secondary">渠道、活动与内容管理</p>
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
          <Megaphone className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">品牌运营</h1>
          <p className="text-sm text-text-secondary">渠道、活动与内容管理</p>
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

      <ChannelCards channels={data?.channels ?? []} />
      <CampaignsSection campaigns={data?.campaigns ?? []} />
      <ContentPipelineSection items={data?.content ?? []} />
    </div>
  );
}
