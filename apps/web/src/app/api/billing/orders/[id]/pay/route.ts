// API: 订单支付（模拟）
// POST /api/billing/orders/[id]/pay — 完成支付

import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, completeOrder } from '@zhidu/db/repository';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function POST(
  request: NextRequest,
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

    // Verify order ownership
    const order = await getOrderById(id, auth.user.id);
    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { error: `订单状态为 ${order.status}，无法支付` },
        { status: 400 },
      );
    }

    // Check if order has expired
    if (order.expiresAt && new Date(order.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: '订单已过期，请重新创建' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { paymentMethod, paymentNo: inputPaymentNo } = body;

    if (!paymentMethod) {
      return NextResponse.json(
        { error: '缺少支付方式' },
        { status: 400 },
      );
    }

    // Auto-generate payment_no if not provided
    const paymentNo = inputPaymentNo ?? `PAY${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

    const result = await completeOrder(id, { paymentNo, paymentMethod });
    if (!result) {
      return NextResponse.json({ error: '支付处理失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[billing/orders/[id]/pay POST]', err);
    return NextResponse.json({ error: '支付失败' }, { status: 500 });
  }
}
