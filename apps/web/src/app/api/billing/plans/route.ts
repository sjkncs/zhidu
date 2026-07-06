// API: 订阅套餐
// GET /api/billing/plans — 获取所有可用的订阅套餐（公开接口，无需鉴权）

import { NextRequest, NextResponse } from 'next/server';
import { getActivePlans } from '@zhidu/db/repository';

export async function GET(_request: NextRequest) {
  try {
    const plans = await getActivePlans();

    return NextResponse.json({
      success: true,
      data: plans,
    });
  } catch (err) {
    console.error('[billing/plans GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
