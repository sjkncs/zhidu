// API: 财务 / 收支记录
// GET  /api/finance  — 获取用户交易记录（含汇总）
// POST /api/finance  — 创建交易记录

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserTransactions, createTransaction } from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'EXPENSE' | 'INCOME' | null;
    const category = searchParams.get('category') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const limit = searchParams.get('limit');

    const transactions = await getUserTransactions(user.id, {
      type: type || undefined,
      category,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : undefined,
    });

    // Compute summary from returned transactions
    let totalIncome = 0;
    let totalExpense = 0;
    for (const t of transactions) {
      if (t.type === 'INCOME') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
      }
    }
    const balance = totalIncome - totalExpense;

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
      summary: { totalIncome, totalExpense, balance },
    });
  } catch (err) {
    console.error('[finance GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, category, description, type, date } = body;

    if (!amount || !category || !type) {
      return NextResponse.json(
        { error: '缺少必填参数: amount, category, type' },
        { status: 400 },
      );
    }

    if (type !== 'EXPENSE' && type !== 'INCOME') {
      return NextResponse.json(
        { error: 'type 必须为 EXPENSE 或 INCOME' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const transaction = await createTransaction({
      userId: user.id,
      amount: Number(amount),
      category,
      description,
      type,
      date,
    });

    if (!transaction) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: transaction });
  } catch (err) {
    console.error('[finance POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
