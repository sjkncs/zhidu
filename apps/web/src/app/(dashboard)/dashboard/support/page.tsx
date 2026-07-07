'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Headphones,
  Loader2,
  AlertCircle,
  RefreshCw,
  Ticket,
  Clock,
  ThumbsUp,
  BarChart3,
  MessageSquare,
  HelpCircle,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TicketItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  assignee: string;
}

interface TicketStats {
  openCount: number;
  avgResolutionTime: number;
  satisfactionScore: number;
}

interface FaqItem {
  question: string;
  viewCount: number;
}

interface SupportData {
  tickets: TicketItem[];
  stats: TicketStats;
  faqs: FaqItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  in_progress: 'bg-blue/10 text-blue border-blue/30',
  resolved: 'bg-green-500/10 text-green-600 border-green-500/30',
};

const STATUS_LABEL: Record<string, string> = {
  open: '待处理',
  in_progress: '处理中',
  resolved: '已解决',
};

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-red-500/10 text-red-500 border-red-500/30',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  low: 'bg-green-500/10 text-green-600 border-green-500/30',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} 分钟`;
  return `${hours.toFixed(1)} 小时`;
}

// ---------------------------------------------------------------------------
// Section: Ticket Stats
// ---------------------------------------------------------------------------

function TicketStatsSection({ stats }: { stats: TicketStats }) {
  const cards = [
    {
      label: '待处理工单',
      value: stats.openCount,
      icon: Ticket,
      color: 'text-yellow-600',
      bg: 'bg-yellow-500/10',
    },
    {
      label: '平均解决时间',
      value: formatHours(stats.avgResolutionTime),
      icon: Clock,
      color: 'text-blue',
      bg: 'bg-blue/10',
    },
    {
      label: '满意度评分',
      value: `${stats.satisfactionScore.toFixed(1)} / 5`,
      icon: ThumbsUp,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
              <card.icon className={`h-4.5 w-4.5 ${card.color}`} />
            </div>
            <span className="text-sm text-text-secondary">{card.label}</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Ticket Board
// ---------------------------------------------------------------------------

function TicketBoard({ tickets }: { tickets: TicketItem[] }) {
  if (tickets.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Ticket className="w-5 h-5 text-blue" />
          工单看板
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Ticket className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  const groups: Record<string, TicketItem[]> = { open: [], in_progress: [], resolved: [] };
  tickets.forEach((t) => {
    if (groups[t.status]) {
      groups[t.status].push(t);
    } else {
      groups[t.status] = [t];
    }
  });

  const groupOrder = ['open', 'in_progress', 'resolved'] as const;

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Ticket className="w-5 h-5 text-blue" />
        工单看板
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {groupOrder.map((status) => {
          const items = groups[status] || [];
          const statusLabel = STATUS_LABEL[status] || status;
          const statusStyle = STATUS_STYLE[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';

          return (
            <div key={status} className="rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
                    {statusLabel}
                  </span>
                </div>
                <span className="text-sm font-medium text-text-tertiary">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center py-4">暂无工单</p>
              ) : (
                <div className="space-y-3">
                  {items.map((ticket) => {
                    const priorityStyle = PRIORITY_STYLE[ticket.priority] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
                    const priorityLabel = PRIORITY_LABEL[ticket.priority] || ticket.priority;
                    return (
                      <div key={ticket.id} className="rounded-lg border border-border bg-surface p-3">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm font-medium text-text-primary leading-tight">
                            {ticket.title}
                          </p>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border flex-shrink-0 ml-2 ${priorityStyle}`}>
                            {priorityLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-text-tertiary">
                          <span>{ticket.assignee}</span>
                          <span>{formatDate(ticket.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: FAQ
// ---------------------------------------------------------------------------

function FaqSection({ faqs }: { faqs: FaqItem[] }) {
  if (faqs.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <HelpCircle className="w-5 h-5 text-blue" />
          常见问题
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <HelpCircle className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <HelpCircle className="w-5 h-5 text-blue" />
        常见问题
      </h2>
      <div className="space-y-3">
        {faqs.map((faq, idx) => (
          <div key={idx} className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue/10 flex-shrink-0">
                <MessageSquare className="h-4 w-4 text-blue" />
              </div>
              <p className="text-sm font-medium text-text-primary truncate">{faq.question}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
              <Eye className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="text-xs text-text-tertiary">{faq.viewCount}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SupportPage() {
  const [data, setData] = useState<SupportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/support');
      if (!res.ok) throw new Error('获取客服中心信息失败');
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
            <Headphones className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">客服中心</h1>
            <p className="text-sm text-text-secondary">工单、统计与常见问题</p>
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
            <Headphones className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">客服中心</h1>
            <p className="text-sm text-text-secondary">工单、统计与常见问题</p>
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
          <Headphones className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">客服中心</h1>
          <p className="text-sm text-text-secondary">工单、统计与常见问题</p>
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

      {data?.stats && <TicketStatsSection stats={data.stats} />}
      <TicketBoard tickets={data?.tickets ?? []} />
      <FaqSection faqs={data?.faqs ?? []} />
    </div>
  );
}
