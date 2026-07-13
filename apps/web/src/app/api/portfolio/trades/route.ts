// API: 交易记录
// GET  /api/portfolio/trades — 获取指定组合的交易记录
// POST /api/portfolio/trades — 添加新交易记录

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const portfolioId = request.nextUrl.searchParams.get('portfolioId');
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? '50'), 200);
    const offset = Number(request.nextUrl.searchParams.get('offset') ?? '0');

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

    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('traded_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Get total count for pagination
    const { count } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('portfolio_id', portfolioId);

    return NextResponse.json({
      success: true,
      trades: trades ?? [],
      pagination: {
        total: count ?? 0,
        limit,
        offset,
      },
    });
  } catch (err) {
    console.error('[trades GET]', err);
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询交易记录失败' }, { status: 500 });
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
      side,
      quantity,
      price,
      fee,
      tradedAt,
      notes,
    } = body;

    // Validate required fields
    if (!portfolioId || !symbol || !side || quantity == null || price == null) {
      return NextResponse.json(
        { error: '缺少必填参数: portfolioId, symbol, side, quantity, price' },
        { status: 400 },
      );
    }

    if (!['buy', 'sell'].includes(side)) {
      return NextResponse.json(
        { error: 'side 必须为 buy 或 sell' },
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

    const totalAmount = Number(quantity) * Number(price);

    const { data, error } = await supabase
      .from('trades')
      .insert({
        portfolio_id: portfolioId,
        user_id: auth.user.id,
        symbol: symbol.trim(),
        name: name ?? symbol.trim(),
        market: market ?? 'other',
        side,
        quantity: Number(quantity),
        price: Number(price),
        amount: totalAmount,
        fee: fee != null ? Number(fee) : 0,
        traded_at: tradedAt ?? new Date().toISOString(),
        note: notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    // After recording trade, update the corresponding position
    try {
      const { data: existingPos } = await supabase
        .from('positions')
        .select('id, quantity, avg_cost')
        .eq('portfolio_id', portfolioId)
        .eq('symbol', symbol.trim())
        .single();

      if (side === 'buy') {
        if (existingPos) {
          // Update existing position: weighted average cost
          const newQty = existingPos.quantity + Number(quantity);
          const newAvgCost =
            (existingPos.quantity * existingPos.avg_cost + totalAmount) / newQty;
          await supabase
            .from('positions')
            .update({ quantity: newQty, avg_cost: newAvgCost })
            .eq('id', existingPos.id);
        } else {
          // Create new position
          await supabase.from('positions').insert({
            portfolio_id: portfolioId,
            user_id: auth.user.id,
            symbol: symbol.trim(),
            name: name ?? symbol.trim(),
            market: market ?? 'other',
            quantity: Number(quantity),
            avg_cost: Number(price),
            current_price: Number(price),
            market_value: 0,
            unrealized_pnl: 0,
            unrealized_pnl_pct: 0,
            weight: 0,
            ai_signal: 'hold',
          });
        }
      } else if (side === 'sell' && existingPos) {
        const newQty = existingPos.quantity - Number(quantity);
        if (newQty <= 0) {
          // Close position
          await supabase.from('positions').delete().eq('id', existingPos.id);
        } else {
          await supabase
            .from('positions')
            .update({ quantity: newQty })
            .eq('id', existingPos.id);
        }
      }
    } catch (posErr) {
      console.warn('[trades POST] position update failed:', posErr);
      // Don't fail the trade creation if position update fails
    }

    return NextResponse.json(
      { success: true, trade: data },
      { status: 201 },
    );
  } catch (err) {
    console.error('[trades POST]', err);
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '添加交易记录失败' }, { status: 500 });
  }
}
