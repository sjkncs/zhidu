// API: 计费总览
// GET /api/billing/overview — 获取用户完整的计费信息（适配前端数据格式）

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserSubscription,
  getUserCredits,
  getUsageSummary,
  getUserOrders,
} from '@zhidu/db/repository';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET(_request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireUser();
    } catch (err) {
      return authErrorResponse(err);
    }

    const userId = auth.user.id;

    const [subscription, credits, usageSummary, recentOrders] = await Promise.all([
      getUserSubscription(userId),
      getUserCredits(userId),
      getUsageSummary(userId, 30),
      getUserOrders(userId, { limit: 5 }),
    ]);

    // ── 适配 subscription 格式 ──
    const subData = subscription
      ? {
          planName: subscription.plan?.name ?? '未知套餐',
          status: subscription.status.toLowerCase(),
          expiresAt: subscription.expiresAt ?? null,
          features: (subscription.plan?.features ?? []) as string[],
        }
      : {
          planName: '免费版',
          status: 'free',
          expiresAt: null,
          features: ['AI 智能问答（每日20次）', '基础院校查询', 'MBTI 性格测评'],
        };

    // ── 适配 credits 格式 ──
    const creditsData = credits
      ? {
          monthlyUsed: credits.monthlyUsed,
          monthlyQuota: credits.monthlyQuota,
          available: credits.freeCredits + credits.purchasedCredits + credits.bonusCredits,
          breakdown: {
            free: credits.freeCredits,
            purchased: credits.purchasedCredits,
            bonus: credits.bonusCredits,
          },
        }
      : {
          monthlyUsed: 0,
          monthlyQuota: 50,
          available: 50,
          breakdown: { free: 50, purchased: 0, bonus: 0 },
        };

    // ── 适配 moduleUsage 格式（计算百分比）──
    const totalCalls = usageSummary.reduce((sum, m) => sum + m.totalCalls, 0);
    const moduleUsage = usageSummary.map((m) => ({
      module: m.module,
      usageCount: m.totalCalls,
      percentage: totalCalls > 0 ? (m.totalCalls / totalCalls) * 100 : 0,
    }));

    // ── 适配 recentOrders 格式 ──
    const formattedOrders = recentOrders.map((o) => ({
      orderNo: o.orderNo,
      productName: o.productName,
      amount: o.finalAmount,
      status: o.status,
      createdAt: o.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        subscription: subData,
        credits: creditsData,
        moduleUsage,
        recentOrders: formattedOrders,
      },
    });
  } catch (err) {
    console.error('[billing/overview GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
