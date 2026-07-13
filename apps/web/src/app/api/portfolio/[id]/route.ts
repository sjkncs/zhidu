// API: 单个投资组合
// GET    /api/portfolio/[id] — 获取单个投资组合详情(含持仓)
// PATCH  /api/portfolio/[id] — 更新投资组合信息
// DELETE /api/portfolio/[id] — 删除投资组合

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth-utils';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const auth = await requireUser();
    const { id } = await context.params;
    const supabase = await createClient();

    const { data: portfolio, error } = await supabase
      .from('portfolios')
      .select('*, positions(*), trades(*)')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '投资组合不存在' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, portfolio });
  } catch (err) {
    console.error('[portfolio/[id] GET]', err);
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询投资组合失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const auth = await requireUser();
    const { id } = await context.params;
    const supabase = await createClient();
    const body = await request.json();

    // Build allowed update fields
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.marketType !== undefined) updates.market_type = body.marketType;
    if (body.currency !== undefined) updates.currency = body.currency;
    if (body.riskLevel !== undefined) updates.risk_level = body.riskLevel;
    if (body.benchmark !== undefined) updates.benchmark = body.benchmark;
    if (body.rebalance_frequency !== undefined) updates.rebalance_frequency = body.rebalance_frequency;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: '未提供有效的更新字段' },
        { status: 400 },
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('portfolios')
      .update(updates)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '投资组合不存在' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, portfolio: data });
  } catch (err) {
    console.error('[portfolio/[id] PATCH]', err);
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '更新投资组合失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const auth = await requireUser();
    const { id } = await context.params;
    const supabase = await createClient();

    // Delete positions and trades first (if no CASCADE)
    await Promise.allSettled([
      supabase.from('positions').delete().eq('portfolio_id', id),
      supabase.from('trades').delete().eq('portfolio_id', id),
    ]);

    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: '投资组合已删除' });
  } catch (err) {
    console.error('[portfolio/[id] DELETE]', err);
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '删除投资组合失败' }, { status: 500 });
  }
}
