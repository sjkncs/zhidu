// API: 投资组合分析历史记录
// GET /api/portfolio/history — 获取指定组合的历史 AI 分析记录

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get('portfolioId');
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);

    let query = supabase
      .from('investment_analyses')
      .select('id, created_at, analysis_type, gate_result, decision_trace, recommendation, confidence, raw_output')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, records: data ?? [] });
  } catch (err) {
    console.error('[portfolio/history GET]', err);
    if (err instanceof AuthError) return authErrorResponse(err);
    return NextResponse.json({ error: '查询历史记录失败' }, { status: 500 });
  }
}
