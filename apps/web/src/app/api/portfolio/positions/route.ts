// API: 持仓管理
// GET  /api/portfolio/positions — 获取指定组合的所有持仓
// POST /api/portfolio/positions — 添加新持仓

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const portfolioId = request.nextUrl.searchParams.get('portfolioId');

    if (!portfolioId) {
      return NextResponse.json(
        { error: '缺少 portfolioId 参数' },
        { status: 400 },
      );
    }

    // Verify portfolio ownership
    const { data: portfolio, error: portfolioError } = await supabase
      .from('portfolios')
      .select('id')
      .eq('id', portfolioId)
      .eq('user_id', auth.user.id)
      .single();

    if (portfolioError || !portfolio) {
      return NextResponse.json({ error: '投资组合不存在' }, { status: 404 });
    }

    const { data: positions, error } = await supabase
      .from('positions')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      positions: positions ?? [],
    });
  } catch (err) {
    console.error('[positions GET]', err);
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询持仓失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const body = await request.json();

    const {
      portfolioId,
      symbol,
      name,
      market,
      quantity,
      avgCost,
      currentPrice,
    } = body;

    // Validate required fields
    if (!portfolioId || !symbol || quantity == null || avgCost == null) {
      return NextResponse.json(
        { error: '缺少必填参数: portfolioId, symbol, quantity, avgCost' },
        { status: 400 },
      );
    }

    // Verify portfolio ownership
    const { data: portfolio, error: portfolioError } = await supabase
      .from('portfolios')
      .select('id')
      .eq('id', portfolioId)
      .eq('user_id', auth.user.id)
      .single();

    if (portfolioError || !portfolio) {
      return NextResponse.json({ error: '投资组合不存在' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('positions')
      .insert({
        portfolio_id: portfolioId,
        user_id: auth.user.id,
        symbol: symbol.trim(),
        name: name ?? symbol.trim(),
        market: market ?? 'other',
        quantity: Number(quantity),
        avg_cost: Number(avgCost),
        current_price: currentPrice != null ? Number(currentPrice) : Number(avgCost),
        market_value: 0,
        unrealized_pnl: 0,
        unrealized_pnl_pct: 0,
        weight: 0,
        ai_signal: 'hold',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, position: data },
      { status: 201 },
    );
  } catch (err) {
    console.error('[positions POST]', err);
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '添加持仓失败' }, { status: 500 });
  }
}
