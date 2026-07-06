'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  Loader2,
  AlertCircle,
  RefreshCw,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Crown,
  CreditCard,
  PartyPopper,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  aiCreditsMonthly: number;
  maxChatsPerDay: number;
  maxVolunteerPlans: number;
  maxResearchProjects: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

interface CreditPack {
  id: string;
  label: string;
  credits: number;
  priceFen: number;
  badge?: string;
  badgeColor?: string;
}

interface CreatedOrder {
  id: string;
  orderNo: string;
  finalAmount: number;
  amount: number;
  productName: string;
  status: string;
}

type BillingCycle = 'monthly' | 'yearly';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack-100',
    label: '100 次额度',
    credits: 100,
    priceFen: 990,
  },
  {
    id: 'pack-500',
    label: '500 次额度',
    credits: 500,
    priceFen: 3990,
    badge: '热门',
    badgeColor: 'bg-amber-500 text-white',
  },
  {
    id: 'pack-2000',
    label: '2000 次额度',
    credits: 2000,
    priceFen: 12900,
    badge: '超值',
    badgeColor: 'bg-red-500 text-white',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(fen: number): string {
  return (fen / 100).toFixed(2);
}

function getPlanFeatures(plan: Plan): string[] {
  if (plan.features && Array.isArray(plan.features) && plan.features.length > 0) {
    return plan.features as string[];
  }
  // Fallback: derive features from numeric fields
  const derived: string[] = [];
  if (plan.aiCreditsMonthly > 0) derived.push(`每月 ${plan.aiCreditsMonthly.toLocaleString()} 次 AI 额度`);
  if (plan.maxChatsPerDay > 0) derived.push(`每日 ${plan.maxChatsPerDay} 次 AI 对话`);
  if (plan.maxVolunteerPlans > 0) derived.push(`最多 ${plan.maxVolunteerPlans} 个志愿方案`);
  if (plan.maxResearchProjects > 0) derived.push(`最多 ${plan.maxResearchProjects} 个科研项目`);
  return derived;
}

// ---------------------------------------------------------------------------
// Section: Plan Card
// ---------------------------------------------------------------------------

function PlanCard({
  plan,
  cycle,
  currentPlanSlug,
  onSelect,
  loading,
}: {
  plan: Plan;
  cycle: BillingCycle;
  currentPlanSlug: string | null;
  onSelect: (plan: Plan, cycle: BillingCycle) => void;
  loading: boolean;
}) {
  const isCurrent = currentPlanSlug === plan.slug;
  const price = cycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
  const features = getPlanFeatures(plan);

  return (
    <div
      className={`rounded-xl border bg-surface p-6 flex flex-col relative ${
        isCurrent
          ? 'border-blue bg-blue/[0.03]'
          : 'border-border hover:border-blue/30'
      } transition-colors`}
    >
      {isCurrent && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium bg-blue text-white">
          当前套餐
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold text-text-primary mb-1">{plan.name}</h3>
        {plan.description && (
          <p className="text-sm text-text-tertiary">{plan.description}</p>
        )}
      </div>

      {/* Price */}
      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-text-primary">
            &yen;{formatAmount(price)}
          </span>
          <span className="text-sm text-text-tertiary">
            /{cycle === 'monthly' ? '月' : '年'}
          </span>
        </div>
        {cycle === 'yearly' && plan.priceMonthly > 0 && (
          <p className="text-xs text-green-600 mt-1">
            相当于 &yen;{formatAmount(Math.round(plan.priceYearly / 12))}/月，
            省 &yen;{formatAmount(plan.priceMonthly * 12 - plan.priceYearly)}
          </p>
        )}
      </div>

      {/* Features */}
      {features.length > 0 && (
        <ul className="space-y-2 mb-6 flex-1">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-sm text-text-secondary"
            >
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Select button */}
      <button
        type="button"
        onClick={() => onSelect(plan, cycle)}
        disabled={isCurrent || loading}
        className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-opacity ${
          isCurrent
            ? 'bg-surface-elevated text-text-tertiary border border-border cursor-default'
            : 'bg-blue text-white hover:opacity-90'
        } disabled:opacity-50`}
      >
        {isCurrent ? '当前套餐' : '选择'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Credit Pack Card
// ---------------------------------------------------------------------------

function CreditPackCard({
  pack,
  onBuy,
  loading,
}: {
  pack: CreditPack;
  onBuy: (pack: CreditPack) => void;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 flex flex-col relative hover:border-blue/30 transition-colors">
      {pack.badge && (
        <span
          className={`absolute -top-3 right-4 inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${
            pack.badgeColor || 'bg-blue text-white'
          }`}
        >
          {pack.badge}
        </span>
      )}

      <div className="mb-4">
        <p className="text-2xl font-bold text-text-primary">{pack.label}</p>
        <p className="text-sm text-text-tertiary mt-1">
          单次充值，即时到账
        </p>
      </div>

      <div className="mb-5 flex-1">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-text-primary">
            &yen;{formatAmount(pack.priceFen)}
          </span>
        </div>
        <p className="text-xs text-text-tertiary mt-1">
          约 &yen;{(pack.priceFen / pack.credits / 100).toFixed(3)}/次
        </p>
      </div>

      <button
        type="button"
        onClick={() => onBuy(pack)}
        disabled={loading}
        className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Zap className="w-4 h-4" />
        立即购买
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Order Confirmation (inline)
// ---------------------------------------------------------------------------

function OrderConfirmation({
  order,
  onPay,
  paying,
  paid,
  error,
}: {
  order: CreatedOrder;
  onPay: () => void;
  paying: boolean;
  paid: boolean;
  error: string | null;
}) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-blue/30 bg-blue/[0.04] p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue/10">
          <CreditCard className="h-4.5 w-4.5 text-blue" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">订单确认</h2>
      </div>

      {paid ? (
        <div className="text-center py-6">
          <div className="flex justify-center mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
              <PartyPopper className="h-7 w-7 text-green-500" />
            </div>
          </div>
          <p className="text-lg font-bold text-text-primary mb-1">支付成功！</p>
          <p className="text-sm text-text-tertiary mb-5">
            您的额度已更新，感谢您的购买。
          </p>
          <a
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            返回账单中心
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-elevated border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-tertiary">订单号</span>
              <span className="text-sm font-mono text-text-primary">{order.orderNo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-tertiary">商品</span>
              <span className="text-sm font-medium text-text-primary">{order.productName}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-medium text-text-secondary">应付金额</span>
              <span className="text-lg font-bold text-blue">
                &yen;{formatAmount(order.finalAmount || order.amount)}
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.04] px-4 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span className="text-sm text-red-500">{error}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onPay}
              disabled={paying}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  模拟支付
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/billing')}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-surface-elevated text-text-secondary text-sm font-medium hover:border-blue/30 hover:text-blue transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PayPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // Plans
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  // Cycle toggle
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  // Current subscription (to highlight current plan)
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string | null>(null);

  // Order flow
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [orderCreating, setOrderCreating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // ---- Fetch plans ----
  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const res = await fetch('/api/billing/plans');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `获取套餐列表失败 (${res.status})`);
      }
      const json = await res.json();
      const fetchedPlans: Plan[] = json.data ?? json;
      setPlans(fetchedPlans);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载套餐数据失败';
      setPlansError(msg);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  // Fetch current subscription to highlight active plan
  const fetchCurrentSubscription = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/overview');
      if (res.ok) {
        const json = await res.json();
        const overview = json.data ?? json;
        // The overview subscription has planName; we match by name
        if (overview?.subscription?.planName) {
          // We'll store the plan name and match in render
          setCurrentPlanSlug(overview.subscription.planName);
        }
      }
    } catch {
      // Non-critical: ignore
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchCurrentSubscription();
  }, [fetchPlans, fetchCurrentSubscription]);

  // ---- Create subscription order ----
  const handleSelectPlan = useCallback(
    async (plan: Plan, selectedCycle: BillingCycle) => {
      setOrderCreating(true);
      setOrderError(null);
      setCreatedOrder(null);
      setPaid(false);
      try {
        const price = selectedCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
        const res = await fetch('/api/billing/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderType: 'SUBSCRIPTION',
            planId: plan.id,
            productName: plan.name,
            quantity: 1,
            unitPrice: price,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `创建订单失败 (${res.status})`);
        }
        const json = await res.json();
        const order: CreatedOrder = json.data;
        setCreatedOrder(order);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '创建订单失败';
        setOrderError(msg);
      } finally {
        setOrderCreating(false);
      }
    },
    [],
  );

  // ---- Create credit pack order ----
  const handleBuyCredits = useCallback(
    async (pack: CreditPack) => {
      setOrderCreating(true);
      setOrderError(null);
      setCreatedOrder(null);
      setPaid(false);
      try {
        const res = await fetch('/api/billing/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderType: 'CREDITS',
            productName: pack.label,
            quantity: 1,
            unitPrice: pack.priceFen,
            paymentMethod: 'wechat',
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `创建订单失败 (${res.status})`);
        }
        const json = await res.json();
        const order: CreatedOrder = json.data;
        setCreatedOrder(order);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '创建订单失败';
        setOrderError(msg);
      } finally {
        setOrderCreating(false);
      }
    },
    [],
  );

  // ---- Simulate payment ----
  const handlePay = useCallback(async () => {
    if (!createdOrder) return;
    setPaying(true);
    setOrderError(null);
    try {
      const res = await fetch(`/api/billing/orders/${createdOrder.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'wechat' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `支付失败 (${res.status})`);
      }
      setPaid(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '支付处理失败';
      setOrderError(msg);
    } finally {
      setPaying(false);
    }
  }, [createdOrder]);

  const handleRetry = useCallback(() => {
    fetchPlans();
  }, [fetchPlans]);

  // ---- Sort plans by sortOrder ----
  const sortedPlans = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <a
          href="/dashboard/billing"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10 hover:bg-blue/20 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-blue" />
        </a>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
          <Wallet className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">充值中心</h1>
          <p className="text-sm text-text-secondary">选择套餐或购买额度包</p>
        </div>
      </div>

      {/* Not logged in */}
      {!user && (
        <div className="flex flex-col items-center py-12 text-text-tertiary">
          <AlertCircle className="w-10 h-10 mb-3 text-red-500 opacity-60" />
          <p className="text-sm text-text-secondary mb-1">请先登录后再进行购买</p>
          <a
            href="/login"
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-blue/10 px-4 py-2 text-sm font-medium text-blue transition hover:bg-blue/20"
          >
            前往登录
          </a>
        </div>
      )}

      {user && (
        <>
          {/* ====== Subscription Plans ====== */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-blue" />
                <h2 className="text-lg font-semibold text-text-primary">订阅套餐</h2>
              </div>

              {/* Monthly/Yearly toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-elevated p-1">
                <button
                  type="button"
                  onClick={() => setCycle('monthly')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    cycle === 'monthly'
                      ? 'bg-blue text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  月付
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('yearly')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    cycle === 'yearly'
                      ? 'bg-blue text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  年付
                </button>
              </div>
            </div>

            {/* Plans loading */}
            {plansLoading && (
              <div className="flex flex-col items-center py-12 text-text-tertiary">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <p className="text-sm">加载套餐中...</p>
              </div>
            )}

            {/* Plans error */}
            {plansError && !plansLoading && (
              <div className="flex flex-col items-center py-12 text-text-tertiary">
                <AlertCircle className="w-10 h-10 mb-3 text-red-500 opacity-60" />
                <p className="text-sm text-text-secondary mb-1">{plansError}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重试
                </button>
              </div>
            )}

            {/* Plans grid */}
            {!plansLoading && !plansError && sortedPlans.length > 0 && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sortedPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    cycle={cycle}
                    currentPlanSlug={currentPlanSlug}
                    onSelect={handleSelectPlan}
                    loading={orderCreating}
                  />
                ))}
              </div>
            )}

            {!plansLoading && !plansError && sortedPlans.length === 0 && (
              <div className="flex flex-col items-center py-12 text-text-tertiary">
                <Sparkles className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">暂无可用套餐</p>
              </div>
            )}
          </section>

          {/* ====== Order Confirmation (appears after creating an order) ====== */}
          {createdOrder && (
            <OrderConfirmation
              order={createdOrder}
              onPay={handlePay}
              paying={paying}
              paid={paid}
              error={orderError}
            />
          )}

          {/* Show order creation error when no order panel is visible */}
          {orderError && !createdOrder && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.04] px-5 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span className="text-sm text-text-secondary">{orderError}</span>
            </div>
          )}

          {/* ====== Credit Packs ====== */}
          {!paid && (
            <section>
              <div className="flex items-center gap-2 mb-5">
                <Zap className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-text-primary">购买额度包</h2>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {CREDIT_PACKS.map((pack) => (
                  <CreditPackCard
                    key={pack.id}
                    pack={pack}
                    onBuy={handleBuyCredits}
                    loading={orderCreating}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Success state: link back to billing */}
          {paid && (
            <div className="text-center py-4">
              <a
                href="/dashboard/billing"
                className="inline-flex items-center gap-2 text-sm text-blue hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                返回账单中心
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
