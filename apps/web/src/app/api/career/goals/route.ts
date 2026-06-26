// API: 目标 CRUD
// GET  /api/career/goals                    — 获取用户目标列表 (query: category?, completed?)
// POST /api/career/goals                    — 创建单个目标

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserGoals, createGoal } from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') ?? undefined;
    const completedStr = searchParams.get('completed');
    const completed = completedStr === 'true' ? true : completedStr === 'false' ? false : undefined;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const goals = await getUserGoals(user.id, { category, completed });

    return NextResponse.json({
      success: true,
      data: goals,
      count: goals.length,
    });
  } catch (err) {
    console.error('[career/goals GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, category, priority, deadline, parentGoalId, careerPathId, sortOrder } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: title' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const goal = await createGoal({
      userId: user.id,
      title,
      description,
      category,
      priority,
      deadline,
      parentGoalId,
      careerPathId,
      sortOrder,
    });

    if (!goal) {
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: goal });
  } catch (err) {
    console.error('[career/goals POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
