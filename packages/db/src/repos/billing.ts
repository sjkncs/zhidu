// @zhidu/db — 计费/额度/订单管理

import { getDb } from '../utils';

// ---- Types ----

export interface SubscriptionPlanRow {
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
  features: unknown[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserSubscriptionRow {
  id: string;
  userId: string;
  planId: string;
  status: 'TRIAL' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED';
  billingCycle: 'monthly' | 'yearly';
  startedAt: string;
  expiresAt?: string;
  cancelledAt?: string;
  autoRenew: boolean;
  paymentMethod?: string;
  trialEndsAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiCreditsRow {
  userId: string;
  totalCredits: number;
  usedCredits: number;
  freeCredits: number;
  purchasedCredits: number;
  bonusCredits: number;
  monthlyQuota: number;
  monthlyUsed: number;
  lastResetAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiUsageLogRow {
  id: string;
  userId: string;
  module: string;
  action: string;
  creditsUsed: number;
  tokensInput: number;
  tokensOutput: number;
  model?: string;
  durationMs?: number;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'RATE_LIMITED';
  errorMessage?: string;
  requestMetadata?: Record<string, unknown>;
  createdAt: string;
}

export interface OrderRow {
  id: string;
  userId: string;
  orderNo: string;
  orderType: 'SUBSCRIPTION' | 'CREDITS' | 'ONE_TIME';
  planId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount: number;
  finalAmount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'REFUNDING' | 'REFUNDED';
  paymentMethod?: string;
  paymentNo?: string;
  paidAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  refundAmount: number;
  refundAt?: string;
  refundReason?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRow {
  id: string;
  orderId: string;
  userId: string;
  paymentNo: string;
  paymentMethod: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CLOSED';
  paidAt?: string;
  callbackData?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Mappers ----

function mapSubscriptionPlan(row: any): SubscriptionPlanRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    priceMonthly: row.price_monthly,
    priceYearly: row.price_yearly,
    aiCreditsMonthly: row.ai_credits_monthly,
    maxChatsPerDay: row.max_chats_per_day,
    maxVolunteerPlans: row.max_volunteer_plans,
    maxResearchProjects: row.max_research_projects,
    features: row.features ?? [],
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserSubscription(row: any): UserSubscriptionRow {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    status: row.status,
    billingCycle: row.billing_cycle,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    cancelledAt: row.cancelled_at,
    autoRenew: row.auto_renew,
    paymentMethod: row.payment_method,
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAiCredits(row: any): AiCreditsRow {
  return {
    userId: row.user_id,
    totalCredits: row.total_credits,
    usedCredits: row.used_credits,
    freeCredits: row.free_credits,
    purchasedCredits: row.purchased_credits,
    bonusCredits: row.bonus_credits,
    monthlyQuota: row.monthly_quota,
    monthlyUsed: row.monthly_used,
    lastResetAt: row.last_reset_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAiUsageLog(row: any): AiUsageLogRow {
  return {
    id: row.id,
    userId: row.user_id,
    module: row.module,
    action: row.action,
    creditsUsed: row.credits_used,
    tokensInput: row.tokens_input,
    tokensOutput: row.tokens_output,
    model: row.model,
    durationMs: row.duration_ms,
    status: row.status,
    errorMessage: row.error_message,
    requestMetadata: row.request_metadata,
    createdAt: row.created_at,
  };
}

function mapOrder(row: any): OrderRow {
  return {
    id: row.id,
    userId: row.user_id,
    orderNo: row.order_no,
    orderType: row.order_type,
    planId: row.plan_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    amount: row.amount,
    discount: row.discount,
    finalAmount: row.final_amount,
    currency: row.currency,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentNo: row.payment_no,
    paidAt: row.paid_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    refundAmount: row.refund_amount,
    refundAt: row.refund_at,
    refundReason: row.refund_reason,
    metadata: row.metadata,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPayment(row: any): PaymentRow {
  return {
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    paymentNo: row.payment_no,
    paymentMethod: row.payment_method,
    amount: row.amount,
    status: row.status,
    paidAt: row.paid_at,
    callbackData: row.callback_data,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription Plans
// ─────────────────────────────────────────────────────────────────────────────

export async function getActivePlans(): Promise<SubscriptionPlanRow[]> {
  try {
    const { data, error } = await getDb()
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) { console.error('[getActivePlans]', error.message); return []; }
    return (data ?? []).map(mapSubscriptionPlan);
  } catch (err) {
    console.error('[getActivePlans]', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User Subscription
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserSubscription(userId: string): Promise<(UserSubscriptionRow & { plan?: SubscriptionPlanRow }) | null> {
  try {
    const { data, error } = await getDb()
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('user_id', userId)
      .in('status', ['ACTIVE', 'TRIAL'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) { console.error('[getUserSubscription]', error.message); return null; }
    if (!data) return null;

    const planData = (data as any).subscription_plans;
    const subscription = mapUserSubscription(data);
    return {
      ...subscription,
      plan: planData ? mapSubscriptionPlan(planData) : undefined,
    };
  } catch (err) {
    console.error('[getUserSubscription]', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Credits
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserCredits(userId: string): Promise<AiCreditsRow | null> {
  try {
    const { data, error } = await getDb()
      .from('ai_credits')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) { console.error('[getUserCredits]', error.message); return null; }
    if (!data) return null;
    return mapAiCredits(data);
  } catch (err) {
    console.error('[getUserCredits]', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Usage Logs
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserUsageLogs(
  userId: string,
  options?: { module?: string; limit?: number; offset?: number },
): Promise<AiUsageLogRow[]> {
  try {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    let query = getDb()
      .from('ai_usage_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options?.module) {
      query = query.eq('module', options.module);
    }

    const { data, error } = await query;
    if (error) { console.error('[getUserUsageLogs]', error.message); return []; }
    return (data ?? []).map(mapAiUsageLog);
  } catch (err) {
    console.error('[getUserUsageLogs]', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────

function generateOrderNo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `ZD${y}${m}${d}${seq}`;
}

export async function createOrder(
  userId: string,
  data: {
    orderType: 'SUBSCRIPTION' | 'CREDITS' | 'ONE_TIME';
    productName: string;
    quantity: number;
    unitPrice: number;
    planId?: string;
    paymentMethod?: string;
  },
): Promise<OrderRow | null> {
  try {
    const amount = data.quantity * data.unitPrice;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const row: Record<string, any> = {
      user_id: userId,
      order_no: generateOrderNo(),
      order_type: data.orderType,
      product_name: data.productName,
      quantity: data.quantity,
      unit_price: data.unitPrice,
      amount,
      discount: 0,
      final_amount: amount,
      currency: 'CNY',
      status: 'PENDING',
      expires_at: expiresAt,
    };
    if (data.planId) row.plan_id = data.planId;
    if (data.paymentMethod) row.payment_method = data.paymentMethod;

    const { data: inserted, error } = await getDb()
      .from('orders')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('[createOrder]', error.message); return null; }
    return mapOrder(inserted);
  } catch (err) {
    console.error('[createOrder]', err);
    return null;
  }
}

export async function getUserOrders(
  userId: string,
  options?: { status?: string; limit?: number; offset?: number },
): Promise<OrderRow[]> {
  try {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    let query = getDb()
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) { console.error('[getUserOrders]', error.message); return []; }
    return (data ?? []).map(mapOrder);
  } catch (err) {
    console.error('[getUserOrders]', err);
    return [];
  }
}

export async function getOrderById(orderId: string, userId: string): Promise<OrderRow | null> {
  try {
    const { data, error } = await getDb()
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', userId)
      .single();
    if (error) { console.error('[getOrderById]', error.message); return null; }
    if (!data) return null;
    return mapOrder(data);
  } catch (err) {
    console.error('[getOrderById]', err);
    return null;
  }
}

export async function completeOrder(
  orderId: string,
  paymentData: { paymentNo: string; paymentMethod: string },
): Promise<{ order: OrderRow; payment: PaymentRow } | null> {
  try {
    const now = new Date().toISOString();

    // 1. Update order status to PAID
    const { data: updatedOrder, error: orderError } = await getDb()
      .from('orders')
      .update({
        status: 'PAID',
        payment_no: paymentData.paymentNo,
        payment_method: paymentData.paymentMethod,
        paid_at: now,
      })
      .eq('id', orderId)
      .select()
      .single();
    if (orderError) { console.error('[completeOrder] order update', orderError.message); return null; }

    // 2. Create payment record
    const { data: paymentRecord, error: paymentError } = await getDb()
      .from('payments')
      .insert({
        order_id: orderId,
        user_id: updatedOrder.user_id,
        payment_no: paymentData.paymentNo,
        payment_method: paymentData.paymentMethod,
        amount: updatedOrder.final_amount,
        status: 'SUCCESS',
        paid_at: now,
      })
      .select()
      .single();
    if (paymentError) { console.error('[completeOrder] payment insert', paymentError.message); return null; }

    return {
      order: mapOrder(updatedOrder),
      payment: mapPayment(paymentRecord),
    };
  } catch (err) {
    console.error('[completeOrder]', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage Analytics
// ─────────────────────────────────────────────────────────────────────────────

export async function getUsageSummary(
  userId: string,
  days: number = 7,
): Promise<Array<{ module: string; totalCredits: number; totalCalls: number }>> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await getDb()
      .from('ai_usage_logs')
      .select('module, credits_used')
      .eq('user_id', userId)
      .eq('status', 'SUCCESS')
      .gte('created_at', since);
    if (error) { console.error('[getUsageSummary]', error.message); return []; }

    // Aggregate by module
    const map = new Map<string, { totalCredits: number; totalCalls: number }>();
    for (const row of data ?? []) {
      const existing = map.get(row.module) ?? { totalCredits: 0, totalCalls: 0 };
      existing.totalCredits += row.credits_used ?? 0;
      existing.totalCalls += 1;
      map.set(row.module, existing);
    }

    return Array.from(map.entries()).map(([module, stats]) => ({
      module,
      totalCredits: stats.totalCredits,
      totalCalls: stats.totalCalls,
    }));
  } catch (err) {
    console.error('[getUsageSummary]', err);
    return [];
  }
}

export async function getMonthlyUsageStats(
  userId: string,
): Promise<Array<{ month: string; module: string; totalCredits: number; totalCalls: number }>> {
  try {
    // Get last 30 days of usage
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await getDb()
      .from('ai_usage_logs')
      .select('module, credits_used, created_at')
      .eq('user_id', userId)
      .eq('status', 'SUCCESS')
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (error) { console.error('[getMonthlyUsageStats]', error.message); return []; }

    // Group by month + module
    const map = new Map<string, { month: string; module: string; totalCredits: number; totalCalls: number }>();
    for (const row of data ?? []) {
      const date = new Date(row.created_at);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const key = `${month}:${row.module}`;
      const existing = map.get(key) ?? { month, module: row.module, totalCredits: 0, totalCalls: 0 };
      existing.totalCredits += row.credits_used ?? 0;
      existing.totalCalls += 1;
      map.set(key, existing);
    }

    return Array.from(map.values());
  } catch (err) {
    console.error('[getMonthlyUsageStats]', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Credit Deduction (calls deduct_ai_credits SQL function)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 扣减 AI 额度（调用数据库函数 deduct_ai_credits）
 * @returns true=扣减成功, false=余额不足
 */
export async function deductCredits(
  userId: string,
  credits: number,
  module: string,
  action: string,
  options?: {
    tokensIn?: number;
    tokensOut?: number;
    model?: string;
    durationMs?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<boolean> {
  try {
    const { data, error } = await getDb().rpc('deduct_ai_credits', {
      p_user_id: userId,
      p_credits: credits,
      p_module: module,
      p_action: action,
      p_tokens_in: options?.tokensIn ?? 0,
      p_tokens_out: options?.tokensOut ?? 0,
      p_model: options?.model ?? null,
      p_duration: options?.durationMs ?? null,
      p_metadata: options?.metadata ?? {},
    });
    if (error) {
      console.error('[deductCredits]', error.message);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error('[deductCredits]', err);
    return false;
  }
}

/**
 * 检查用户可用额度（不扣减）
 * 若用户无额度记录，自动创建免费套餐额度（50 free + 50 monthly）
 */
export async function getAvailableCredits(userId: string): Promise<number> {
  try {
    let credits = await getUserCredits(userId);

    // 已有用户可能没有 credits 行（注册触发器仅对新用户生效）
    if (!credits) {
      const { data: inserted, error } = await getDb()
        .from('ai_credits')
        .insert({
          user_id: userId,
          free_credits: 50,
          total_credits: 50,
          monthly_quota: 50,
          monthly_used: 0,
          purchased_credits: 0,
          bonus_credits: 0,
          used_credits: 0,
        })
        .select()
        .single();
      if (error) {
        // 并发插入冲突时重新读取
        credits = await getUserCredits(userId);
        if (!credits) return 0;
      } else {
        credits = mapAiCredits(inserted);
      }
    }

    return (
      credits.freeCredits +
      credits.purchasedCredits +
      credits.bonusCredits
    );
  } catch {
    return 0;
  }
}
