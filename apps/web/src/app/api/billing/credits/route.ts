// API: 额度/用量
// GET /api/billing/credits — 获取额度余额和近期用量

import { NextRequest, NextResponse } from 'next/server';
import { getUserCredits, getUserUsageLogs } from '@zhidu/db/repository';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireUser();
    } catch (err) {
      return authErrorResponse(err);
    }

    const userId = auth.user.id;
    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module') ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

    const [credits, usageLogs] = await Promise.all([
      getUserCredits(userId),
      getUserUsageLogs(userId, { module, limit }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        credits,
        usageLogs,
      },
    });
  } catch (err) {
    console.error('[billing/credits GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
