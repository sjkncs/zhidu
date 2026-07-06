// API: 单个订单详情
// GET /api/billing/orders/[id] — 获取订单详情（验证归属）

import { NextRequest, NextResponse } from 'next/server';
import { getOrderById } from '@zhidu/db/repository';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    let auth;
    try {
      auth = await requireUser();
    } catch (err) {
      return authErrorResponse(err);
    }

    const { id } = await params;

    const order = await getOrderById(id, auth.user.id);
    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    console.error('[billing/orders/[id] GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
