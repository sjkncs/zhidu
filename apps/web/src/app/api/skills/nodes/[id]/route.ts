// API: 技能节点更新 / 删除
// PATCH  /api/skills/nodes/[id]  — 更新技能节点
// DELETE /api/skills/nodes/[id]  — 删除技能节点

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateSkillNode, deleteSkillNode } from '@zhidu/db/repository';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, progress, difficulty, prerequisites, resources, estimatedHours } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const node = await updateSkillNode(id, {
      title,
      description,
      progress,
      difficulty,
      prerequisites,
      resources,
      estimatedHours,
    });

    if (!node) {
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: node });
  } catch (err) {
    console.error('[skills/nodes/[id] PATCH]', err);
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

    const ok = await deleteSkillNode(id);

    if (!ok) {
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[skills/nodes/[id] DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
