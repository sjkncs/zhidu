// API: 批量创建目标（模板 / 职业路径转化）
// POST /api/career/goals/batch
// Body: { goals: Array<{ title, description?, category?, priority?, deadline?, parentGoalId?, careerPathId?, sortOrder? }> }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { batchCreateGoals } from '@zhidu/db/repository';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { goals } = body;

    if (!goals || !Array.isArray(goals) || goals.length === 0) {
      return NextResponse.json(
        { error: '缺少必填参数: goals (非空数组)' },
        { status: 400 },
      );
    }

    if (goals.length > 50) {
      return NextResponse.json(
        { error: '单次最多创建 50 个目标' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 为每个目标注入 userId
    const goalsWithUser = goals.map((g: any) => ({
      userId: user.id,
      title: g.title,
      description: g.description,
      category: g.category,
      priority: g.priority,
      deadline: g.deadline,
      parentGoalId: g.parentGoalId,
      careerPathId: g.careerPathId,
      sortOrder: g.sortOrder,
    }));

    const created = await batchCreateGoals(goalsWithUser);

    return NextResponse.json({
      success: true,
      data: created,
      count: created.length,
    });
  } catch (err) {
    console.error('[career/goals/batch]', err);
    return NextResponse.json({ error: '批量创建失败' }, { status: 500 });
  }
}
