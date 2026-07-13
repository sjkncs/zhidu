'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Coins,
  BarChart3,
  ShoppingBag,
  Loader2,
  AlertCircle,
  RefreshCw,
  Crown,
  Zap,
  ArrowRight,
  Check,
  Cpu,
  Wallet,
  TrendingUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Subscription {
  planName: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'free';
  expiresAt: string | null;
  features: string[];
}

interface Credits {
  monthlyUsed: number;
  monthlyQuota: number;
  available: number;
  breakdown: {
    free: number;
    purchased: number;
    bonus: number;
  };
}

interface ModuleUsage {
  module: string;
  usageCount: number;
  percentage: number;
}

interface Order {
  orderNo: string;
  productName: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface BillingOverview {
  subscription: Subscription;
  credits: Credits;
  moduleUsage: ModuleUsage[];
  recentOrders: Order[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const SUB_STATUS_TEXT: Record<string, string> = {
  trial: '试用中',
  active: '已激活',
  expired: '已过期',
  cancelled: '已取消',
  free: '免费版',
};

const SUB_STATUS_STYLE: Record<string, string> = {
  trial: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  active: 'bg-green-500/10 text-green-600 border-green-500/30',
  expired: 'bg-red-500/10 text-red-500 border-red-500/30',
  cancelled: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
  free: 'bg-blue/10 text-blue border-blue/30',
};

const ORDER_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  PAID: 'bg-green-500/10 text-green-600 border-green-500/30',
  CANCELLED: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
  REFUNDED: 'bg-red-500/10 text-red-500 border-red-500/30',
  FAILED: 'bg-red-500/10 text-red-500 border-red-500/30',
  PROCESSING: 'bg-blue/10 text-blue border-blue/30',
  COMPLETED: 'bg-green-500/10 text-green-600 border-green-500/30',
  REFUNDING: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
};

const MODULE_NAMES: Record<string, string> = {
  chat: 'AI 对话',
  volunteer: '志愿服务',
  career: '职业规划',
  knowledge: '知识库',
  resume: '简历助手',
};

const MODULE_BAR_COLORS: Record<string, string> = {
  chat: 'bg-blue',
  volunteer: 'bg-green-500',
  career: 'bg-purple-500',
  knowledge: 'bg-amber-500',
  resume: 'bg-pink-500',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(fen: number): string {
  return (fen / 100).toFixed(2);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

// ---------------------------------------------------------------------------
// Section: Subscription Card
// ---------------------------------------------------------------------------

function SubscriptionCard({ subscription }: { subscription: Subscription }) {
  const statusLabel = SUB_STATUS_TEXT[subscription.status] || subscription.status;
  const statusStyle = SUB_STATUS_STYLE[subscription.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
  const isExpired = subscription.status === 'expired';
  const isTrial = subscription.status === 'trial';

  return (
    <div className="rounded-xl border border-border bg-surface p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue/10">
            <Crown className="h-4.5 w-4.5 text-blue" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">我的订阅</h2>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mb-4">
        <p className="text-xl font-bold text-text-primary mb-1">{subscription.planName}</p>
        {subscription.expiresAt && (
          <p className="text-sm text-text-tertiary">
            {isExpired ? '已于' : '到期时间'}：{formatDate(subscription.expiresAt)}
          </p>
        )}
      </div>

      {subscription.features.length > 0 && (
        <ul className="space-y-2 mb-5 flex-1">
          {subscription.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 mt-auto">
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue text-white font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Zap className="w-4 h-4" />
          {isExpired ? '续费' : '升级套餐'}
        </button>
        {(isTrial || isExpired) && (
          <button
            type="button"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-surface-elevated text-text-secondary text-sm font-medium hover:border-blue/30 hover:text-blue transition-colors"
          >
            续费
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Credits Card
// ---------------------------------------------------------------------------

function CreditsCard({ credits }: { credits: Credits }) {
  const usedPercent = credits.monthlyQuota > 0
    ? Math.min((credits.monthlyUsed / credits.monthlyQuota) * 100, 100)
    : 0;
  const barColor = usedPercent > 90 ? 'bg-red-500' : usedPercent > 70 ? 'bg-amber-500' : 'bg-blue';

  return (
    <div className="rounded-xl border border-border bg-surface p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
            <Coins className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">AI 额度</h2>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <Coins className="w-3.5 h-3.5" />
          购买额度
        </button>
      </div>

      {/* Monthly usage progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">本月用量</span>
          <span className="text-sm font-semibold text-text-primary">
            {credits.monthlyUsed.toLocaleString()} / {credits.monthlyQuota.toLocaleString()}
          </span>
        </div>
        <div
          className="h-3 w-full rounded-full bg-border/50 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(usedPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`本月已使用 ${usedPercent.toFixed(1)}%`}
        >
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <p className="text-xs text-text-tertiary mt-1.5">
          已使用 {usedPercent.toFixed(1)}%
        </p>
      </div>

      {/* Available credits breakdown */}
      <div className="rounded-lg bg-surface-elevated border border-border p-4 flex-1">
        <p className="text-sm font-medium text-text-secondary mb-3">可用额度</p>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-tertiary">免费额度</span>
            <span className="text-sm font-medium text-text-primary">
              {credits.breakdown.free.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-tertiary">购买额度</span>
            <span className="text-sm font-medium text-text-primary">
              {credits.breakdown.purchased.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-tertiary">赠送额度</span>
            <span className="text-sm font-medium text-text-primary">
              {credits.breakdown.bonus.toLocaleString()}
            </span>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary">合计可用</span>
            <span className="text-base font-bold text-blue">
              {credits.available.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Module Usage
// ---------------------------------------------------------------------------

function ModuleUsageSection({ modules }: { modules: ModuleUsage[] }) {
  if (modules.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-blue" />
          使用统计
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <BarChart3 className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无使用记录</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-blue" />
        使用统计
      </h2>

      <div className="space-y-4">
        {modules.map((mod) => {
          const label = MODULE_NAMES[mod.module] || mod.module;
          const barColor = MODULE_BAR_COLORS[mod.module] || 'bg-gray-400';

          return (
            <div key={mod.module}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-text-primary">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    {mod.usageCount.toLocaleString()} 次
                  </span>
                  <span className="text-xs text-text-tertiary min-w-[40px] text-right">
                    {mod.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div
                className="h-2.5 w-full rounded-full bg-border/50 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(mod.percentage)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${label} 使用占比 ${mod.percentage.toFixed(1)}%`}
              >
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(mod.percentage, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Recent Orders
// ---------------------------------------------------------------------------

function RecentOrdersSection({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue" />
            最近订单
          </h2>
        </div>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <ShoppingBag className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无订单记录</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-blue" />
          最近订单
        </h2>
        <a
          href="/dashboard/orders"
          className="flex items-center gap-1 text-sm text-blue hover:underline"
        >
          查看全部订单
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">订单号</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">商品</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">金额</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">状态</th>
              <th className="text-right font-medium text-text-tertiary pb-3">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {orders.map((order) => {
              const statusLabel = STATUS_TEXT[order.status] || order.status;
              const statusStyle = ORDER_STATUS_STYLE[order.status]
                || 'bg-gray-500/10 text-gray-500 border-gray-500/30';

              return (
                <tr key={order.orderNo} className="group hover:bg-surface-elevated transition-colors">
                  <td className="py-3 pr-4 font-mono text-xs text-text-tertiary">
                    {order.orderNo}
                  </td>
                  <td className="py-3 pr-4 text-text-primary font-medium">
                    {order.productName}
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-text-primary">
                    &yen;{formatAmount(order.amount)}
                  </td>
                  <td className="py-3 pr-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="py-3 text-right text-text-tertiary text-xs">
                    {formatDate(order.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {orders.map((order) => {
          const statusLabel = STATUS_TEXT[order.status] || order.status;
          const statusStyle = ORDER_STATUS_STYLE[order.status]
            || 'bg-gray-500/10 text-gray-500 border-gray-500/30';

          return (
            <div key={order.orderNo} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-text-tertiary">{order.orderNo}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
                  {statusLabel}
                </span>
              </div>
              <p className="text-sm font-medium text-text-primary">{order.productName}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-primary">
                  &yen;{formatAmount(order.amount)}
                </span>
                <span className="text-xs text-text-tertiary">{formatDate(order.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fund Quick Link (跨模块联动: 账单 ↔ 资管)
// ---------------------------------------------------------------------------

function FundQuickLink() {
  const [summary, setSummary] = useState<{ totalBalance: number; accountCount: number } | null>(null);

  useEffect(() => {
    fetch('/api/fund/account')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.summary) setSummary(data.summary);
      })
      .catch(() => {});
  }, []);

  return (
    <a
      href="/dashboard/portfolio"
      className="flex items-center justify-between rounded-xl border border-border bg-gradient-to-r from-blue/[0.04] to-purple-500/[0.04] p-5 transition hover:border-blue/30"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
          <Wallet className="h-5 w-5 text-blue" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">投资资金管理</p>
          <p className="text-xs text-text-secondary">
            {summary && summary.accountCount > 0
              ? `${summary.accountCount} 个账户 · 总余额 ¥${(summary.totalBalance / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
              : '管理资金账户、入金出金、投资流水'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-text-tertiary" />
        <ArrowRight className="h-4 w-4 text-text-tertiary" />
      </div>
    </a>
  );
}

export default function BillingPage() {
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/overview');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `获取账单概览失败 (${res.status})`);
      }
      const json = await res.json();
      setData(json.data ?? json);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载账单数据失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleRetry = useCallback(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <CreditCard className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">账单中心</h1>
            <p className="text-sm text-text-secondary">管理订阅、额度与订单</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // Error state with no data
  if (error && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <CreditCard className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">账单中心</h1>
            <p className="text-sm text-text-secondary">管理订阅、额度与订单</p>
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

  // Data available
  const { subscription, credits, moduleUsage, recentOrders } = data!;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <CreditCard className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">账单中心</h1>
            <p className="text-sm text-text-secondary">管理订阅、额度与订单</p>
          </div>
        </div>
        <a
          href="/dashboard/billing/llm"
          className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-blue/30 hover:text-blue"
        >
          <Cpu className="h-4 w-4" />
          AI 服务管理
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Error banner (when data is also available) */}
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

      {/* Subscription + Credits grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SubscriptionCard subscription={subscription} />
        <CreditsCard credits={credits} />
      </div>

      {/* Fund Account Quick Link */}
      <FundQuickLink />

      {/* Module usage */}
      <ModuleUsageSection modules={moduleUsage} />

      {/* Recent orders */}
      <RecentOrdersSection orders={recentOrders} />
    </div>
  );
}
