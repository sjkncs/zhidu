// API: 资金账户管理
// GET  /api/fund/account — 获取用户所有资金账户
// POST /api/fund/account — 创建资金账户

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();

    const { data: accounts, error } = await supabase
      .from('fund_accounts')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 计算汇总
    const totalBalance = (accounts ?? []).reduce(
      (sum, a) => sum + (a.status === 'active' ? a.balance : 0),
      0,
    );
    const totalDeposited = (accounts ?? []).reduce(
      (sum, a) => sum + a.total_deposited,
      0,
    );
    const totalWithdrawn = (accounts ?? []).reduce(
      (sum, a) => sum + a.total_withdrawn,
      0,
    );

    return NextResponse.json({
      success: true,
      accounts: accounts ?? [],
      summary: {
        totalBalance,
        totalDeposited,
        totalWithdrawn,
        accountCount: accounts?.length ?? 0,
      },
    });
  } catch (err) {
    console.error('[fund/account GET]', err);
    if (err instanceof AuthError) return authErrorResponse(err);
    return NextResponse.json({ error: '查询资金账户失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const body = await request.json();

    const { name, accountType, channel, balance, isDefault, metadata } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: '账户名称不能为空' },
        { status: 400 },
      );
    }

    // 如果设为默认，先取消其他默认
    if (isDefault) {
      await supabase
        .from('fund_accounts')
        .update({ is_default: false })
        .eq('user_id', auth.user.id)
        .eq('is_default', true);
    }

    const insertData: Record<string, unknown> = {
      user_id: auth.user.id,
      name: name.trim(),
      account_type: accountType ?? 'investment',
      channel: channel ?? null,
      balance: balance ?? 0,
      total_deposited: balance ?? 0, // 初始余额视为入金
      is_default: isDefault ?? false,
      metadata: metadata ?? {},
    };

    const { data, error } = await supabase
      .from('fund_accounts')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // 如果有初始余额，记录入金流水
    if (balance && balance > 0) {
      await supabase.from('fund_ledger').insert({
        user_id: auth.user.id,
        account_id: data.id,
        type: 'deposit',
        amount: balance,
        balance_before: 0,
        balance_after: balance,
        title: '初始入金',
        description: `账户「${name.trim()}」初始资金注入`,
        channel: channel ?? 'manual',
        ref_type: 'manual',
      });
    }

    return NextResponse.json(
      { success: true, account: data },
      { status: 201 },
    );
  } catch (err) {
    console.error('[fund/account POST]', err);
    if (err instanceof AuthError) return authErrorResponse(err);
    return NextResponse.json({ error: '创建资金账户失败' }, { status: 500 });
  }
}
