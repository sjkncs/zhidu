// API: 计费总览
// GET /api/billing/overview — 获取用户完整的计费信息

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

    return NextResponse.json({
      success: true,
      data: {
        subscription,
        credits,
        usageSummary,
        recentOrders,
      },
    });
  } catch (err) {
    console.error('[billing/overview GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
