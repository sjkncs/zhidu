// API: 技能树详情 / 更新 / 删除
// GET    /api/skills/trees/[id]  — 获取技能树详情
// PATCH  /api/skills/trees/[id]  — 更新技能树
// DELETE /api/skills/trees/[id]  — 删除技能树

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSkillTreeById, updateSkillTree, deleteSkillTree } from '@zhidu/db/repository';

export async function GET(
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

    const tree = await getSkillTreeById(id);

    if (!tree) {
      return NextResponse.json({ error: '技能树不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: tree });
  } catch (err) {
    console.error('[skills/trees/[id] GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, category } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const tree = await updateSkillTree(id, {
      name,
      description,
      category,
    });

    if (!tree) {
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: tree });
  } catch (err) {
    console.error('[skills/trees/[id] PATCH]', err);
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

    const ok = await deleteSkillTree(id);

    if (!ok) {
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[skills/trees/[id] DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
