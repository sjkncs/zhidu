// API: 投资组合
// GET  /api/portfolio — 获取用户的所有投资组合(含持仓)
// POST /api/portfolio — 创建新的投资组合

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();

    const { data: portfolios, error } = await supabase
      .from('portfolios')
      .select('*, positions(*)')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      portfolios: portfolios ?? [],
    });
  } catch (err) {
    console.error('[portfolio GET]', err);
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询投资组合失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const body = await request.json();

    const { name, description, marketType, currency, riskLevel } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: '组合名称不能为空' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('portfolios')
      .insert({
        user_id: auth.user.id,
        name: name.trim(),
        description: description ?? null,
        market_type: marketType ?? 'mixed',
        currency: currency ?? 'CNY',
        risk_level: riskLevel ?? 'balanced',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, portfolio: data },
      { status: 201 },
    );
  } catch (err) {
    console.error('[portfolio POST]', err);
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '创建投资组合失败' }, { status: 500 });
  }
}
