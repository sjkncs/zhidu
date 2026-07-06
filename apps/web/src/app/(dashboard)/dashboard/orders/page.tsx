'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  CreditCard,
  ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Order {
  orderNo: string;
  productName: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt?: string | null;
  description?: string;
}

interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIMIT = 10;

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
  FAILED: '失败',
  PROCESSING: '处理中',
  COMPLETED: '已完成',
  REFUNDING: '退款中',
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  PAID: 'bg-green-500/10 text-green-600 border-green-500/30',
  CANCELLED: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
  REFUNDED: 'bg-red-500/10 text-red-500 border-red-500/30',
  FAILED: 'bg-red-500/10 text-red-500 border-red-500/30',
  PROCESSING: 'bg-blue/10 text-blue border-blue/30',
  COMPLETED: 'bg-green-500/10 text-green-600 border-green-500/30',
  REFUNDING: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
};

interface FilterTab {
  key: string;
  label: string;
  apiValue: string;
}

const FILTER_TABS: FilterTab[] = [
  { key: 'ALL', label: '全部', apiValue: '' },
  { key: 'PENDING', label: '待支付', apiValue: 'PENDING' },
  { key: 'PAID', label: '已支付', apiValue: 'PAID' },
  { key: 'CANCELLED', label: '已取消', apiValue: 'CANCELLED' },
  { key: 'REFUNDED', label: '已退款', apiValue: 'REFUNDED' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(fen: number): string {
  return (fen / 100).toFixed(2);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Section: Order Card
// ---------------------------------------------------------------------------

function OrderCard({ order }: { order: Order }) {
  const statusLabel = STATUS_TEXT[order.status] || order.status;
  const statusStyle = STATUS_STYLE[order.status]
    || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
  const isPending = order.status === 'PENDING';

  return (
    <div className="rounded-xl border border-border bg-surface p-5 hover:border-blue/20 transition-colors">
      {/* Top row: order number + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          <span className="font-mono text-xs text-text-tertiary truncate">{order.orderNo}</span>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ml-2 ${statusStyle}`}>
          {statusLabel}
        </span>
      </div>

      {/* Middle: product name + amount */}
      <div className="mb-4">
        <p className="text-base font-semibold text-text-primary mb-1">{order.productName}</p>
        {order.description && (
          <p className="text-sm text-text-tertiary line-clamp-2">{order.description}</p>
        )}
      </div>

      {/* Bottom: time + amount + actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDateTime(order.createdAt)}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-text-primary">
            &yen;{formatAmount(order.amount)}
          </span>

          {isPending ? (
            <button
              type="button"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <CreditCard className="w-3.5 h-3.5" />
              去支付
            </button>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface-elevated text-text-secondary text-sm font-medium hover:border-blue/30 hover:text-blue transition-colors"
            >
              查看详情
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Pagination
// ---------------------------------------------------------------------------

function Pagination({
  page,
  total,
  limit,
  onPageChange,
}: {
  page: number;
  total: number;
  limit: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-sm text-text-tertiary">
        共 {total} 条记录，第 {page} / {totalPages} 页
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-surface-elevated text-sm font-medium text-text-secondary transition-colors hover:border-blue/30 hover:text-blue disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-text-secondary"
        >
          <ChevronLeft className="w-4 h-4" />
          上一页
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-surface-elevated text-sm font-medium text-text-secondary transition-colors hover:border-blue/30 hover:text-blue disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-text-secondary"
        >
          下一页
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentFilter = FILTER_TABS.find((t) => t.key === activeTab);
  const statusParam = currentFilter?.apiValue || '';

  const fetchOrders = useCallback(
    async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(LIMIT));
        if (statusParam) {
          params.set('status', statusParam);
        }

        const res = await fetch(`/api/billing/orders?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `获取订单列表失败 (${res.status})`);
        }
        const json: OrdersResponse = await res.json();
        setOrders(json.data ?? []);
        setTotal(json.total ?? 0);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '加载订单数据失败';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [page, statusParam],
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleTabChange = useCallback((tabKey: string) => {
    setActiveTab(tabKey);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleRetry = useCallback(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
          <ShoppingBag className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">订单记录</h1>
          <p className="text-sm text-text-secondary">查看所有交易与支付记录</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue/10 text-blue'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
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

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-sm">加载中...</p>
        </div>
      ) : orders.length === 0 ? (
        /* Empty state */
        <div className="rounded-xl border border-border bg-surface p-12 flex flex-col items-center text-text-tertiary">
          <ShoppingBag className="w-14 h-14 mb-4 opacity-30" />
          <p className="text-base font-medium text-text-secondary mb-1">暂无订单</p>
          <p className="text-sm">
            {activeTab === 'ALL'
              ? '您还没有任何订单记录'
              : `没有${FILTER_TABS.find((t) => t.key === activeTab)?.label || ''}状态的订单`}
          </p>
          {activeTab !== 'ALL' && (
            <button
              type="button"
              onClick={() => handleTabChange('ALL')}
              className="mt-4 px-4 py-2 rounded-lg bg-blue/10 text-blue text-sm font-medium hover:bg-blue/20 transition-colors"
            >
              查看全部订单
            </button>
          )}
        </div>
      ) : (
        /* Order list */
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.orderNo} order={order} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && orders.length > 0 && (
        <Pagination
          page={page}
          total={total}
          limit={LIMIT}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
