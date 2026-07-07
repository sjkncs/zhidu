// API: 专业财务
// GET  /api/finance-pro — 获取账户列表、预算、周期性项目
// POST /api/finance-pro — 创建预算或周期性项目

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;

    const [accountsResult, budgetsResult, recurringResult] = await Promise.allSettled([
      // Financial accounts
      supabase
        .from('finance_accounts')
        .select('id, name, type, balance, currency, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Budgets
      supabase
        .from('budgets')
        .select('id, category, amount, spent, period, start_date, end_date, created_at')
        .eq('user_id', userId)
        .order('start_date', { ascending: false }),

      // Recurring items
      supabase
        .from('recurring_items')
        .select('id, name, amount, frequency, next_due_date, category, is_active, created_at')
        .eq('user_id', userId)
        .order('next_due_date', { ascending: true }),
    ]);

    const accounts =
      accountsResult.status === 'fulfilled' ? accountsResult.value.data ?? [] : [];
    const budgets =
      budgetsResult.status === 'fulfilled' ? budgetsResult.value.data ?? [] : [];
    const recurringItems =
      recurringResult.status === 'fulfilled' ? recurringResult.value.data ?? [] : [];

    return NextResponse.json({
      success: true,
      data: { accounts, budgets, recurringItems },
    });
  } catch (err) {
    console.error('[finance-pro GET]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询财务数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;
    const body = await request.json();

    const { entity_type } = body;

    if (!entity_type || !['budget', 'recurring_item'].includes(entity_type)) {
      return NextResponse.json(
        { error: 'entity_type 必须为 budget 或 recurring_item' },
        { status: 400 },
      );
    }

    if (entity_type === 'budget') {
      const { category, amount, period, start_date, end_date } = body;
      if (!category || amount == null || !period) {
        return NextResponse.json(
          { error: '缺少必填参数: category, amount, period' },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from('budgets')
        .insert({
          user_id: userId,
          category,
          amount: Number(amount),
          spent: 0,
          period,
          start_date: start_date ?? null,
          end_date: end_date ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // entity_type === 'recurring_item'
    const { name, amount, frequency, category, next_due_date } = body;
    if (!name || amount == null || !frequency) {
      return NextResponse.json(
        { error: '缺少必填参数: name, amount, frequency' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('recurring_items')
      .insert({
        user_id: userId,
        name,
        amount: Number(amount),
        frequency,
        category: category ?? null,
        next_due_date: next_due_date ?? null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[finance-pro POST]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
