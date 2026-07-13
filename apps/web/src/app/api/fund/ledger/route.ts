// API: 资金流水台账
// GET /api/fund/ledger — 获取资金流水记录

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();

    const url = request.nextUrl;
    const accountId = url.searchParams.get('accountId');
    const type = url.searchParams.get('type');
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('fund_ledger')
      .select('*', { count: 'exact' })
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (accountId) {
      query = query.eq('account_id', accountId);
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      ledger: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (err) {
    console.error('[fund/ledger GET]', err);
    if (err instanceof AuthError) return authErrorResponse(err);
    return NextResponse.json({ error: '查询资金流水失败' }, { status: 500 });
  }
}
