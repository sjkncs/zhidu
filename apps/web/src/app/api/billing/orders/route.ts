// API: 订单管理
// GET  /api/billing/orders — 获取用户订单列表（分页）
// POST /api/billing/orders — 创建新订单

import { NextRequest, NextResponse } from 'next/server';
import { getUserOrders, createOrder } from '@zhidu/db/repository';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireUser();
    } catch (err) {
      return authErrorResponse(err);
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const status = searchParams.get('status') ?? undefined;
    const offset = (page - 1) * limit;

    const orders = await getUserOrders(auth.user.id, { status, limit, offset });

    // 适配前端 OrderCard 期望的数据格式
    const formattedOrders = orders.map((o) => ({
      orderNo: o.orderNo,
      productName: o.productName,
      amount: o.finalAmount,
      status: o.status,
      createdAt: o.createdAt,
      paidAt: o.paidAt ?? null,
      description: o.orderType === 'SUBSCRIPTION'
        ? '订阅套餐'
        : o.orderType === 'CREDITS'
          ? 'AI 额度充值'
          : o.productName,
    }));

    // 估算总数（当前无 COUNT 查询，使用返回条数推算）
    const hasMore = orders.length === limit;
    const total = hasMore ? (page * limit) + 1 : (page - 1) * limit + orders.length;

    return NextResponse.json({
      success: true,
      data: formattedOrders,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error('[billing/orders GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireUser();
    } catch (err) {
      return authErrorResponse(err);
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: '请求体不能为空' }, { status: 400 });
    }

    const { orderType, productName, quantity, unitPrice, planId, paymentMethod } = body;

    if (!orderType || !productName || !quantity || unitPrice === undefined) {
      return NextResponse.json(
        { error: '缺少必填字段: orderType, productName, quantity, unitPrice' },
        { status: 400 },
      );
    }

    if (!['SUBSCRIPTION', 'CREDITS', 'ONE_TIME'].includes(orderType)) {
      return NextResponse.json(
        { error: '无效的订单类型' },
        { status: 400 },
      );
    }

    if (typeof quantity !== 'number' || quantity < 1) {
      return NextResponse.json(
        { error: '数量必须为正整数' },
        { status: 400 },
      );
    }

    if (typeof unitPrice !== 'number' || unitPrice < 0) {
      return NextResponse.json(
        { error: '单价不能为负数' },
        { status: 400 },
      );
    }

    const order = await createOrder(auth.user.id, {
      orderType,
      productName,
      quantity,
      unitPrice,
      planId,
      paymentMethod,
    });

    if (!order) {
      return NextResponse.json({ error: '订单创建失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (err) {
    console.error('[billing/orders POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
