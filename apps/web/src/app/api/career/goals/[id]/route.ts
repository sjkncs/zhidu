// API: 单个目标更新 / 删除
// PATCH  /api/career/goals/[id]  — 更新目标
// DELETE /api/career/goals/[id]  — 删除目标（子目标级联删除）

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateGoal, deleteGoal } from '@zhidu/db/repository';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, completed, priority, deadline } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const goal = await updateGoal(id, {
      title,
      description,
      completed,
      priority,
      deadline,
    });

    if (!goal) {
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: goal });
  } catch (err) {
    console.error('[career/goals/[id] PATCH]', err);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const ok = await deleteGoal(id);

    if (!ok) {
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[career/goals/[id] DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
