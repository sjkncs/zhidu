// API: 技能树详情 / 更新 / 删除
// GET    /api/skills/trees/[id]  — 获取技能树详情
// PATCH  /api/skills/trees/[id]  — 更新技能树
// DELETE /api/skills/trees/[id]  — 删除技能树

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // 获取技能树
    const { data: tree, error: treeError } = await supabase
      .from('skill_trees')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (treeError || !tree) {
      return NextResponse.json({ error: '技能树不存在' }, { status: 404 });
    }

    // 获取技能树的所有节点
    const { data: rawNodes } = await supabase
      .from('skill_nodes')
      .select('*')
      .eq('skill_tree_id', id)
      .order('sort_order');

    // 映射为前端期望的 camelCase 格式
    const nodes = (rawNodes ?? []).map(mapNodeToCamelCase);

    return NextResponse.json({
      success: true,
      data: tree,
      nodes,
    });
  } catch (err) {
    console.error('[skills/trees/[id] GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

/** 将 Supabase snake_case 节点映射为前端 camelCase SkillNodeRow */
function mapNodeToCamelCase(n: Record<string, any>) {
  return {
    id: n.id,
    skillTreeId: n.skill_tree_id,
    parentNodeId: n.parent_node_id ?? null,
    title: n.title,
    description: n.description ?? null,
    difficulty: n.difficulty ?? 3,
    progress: n.progress ?? 0,
    prerequisites: n.prerequisites ?? [],
    resources: n.resources ?? [],
    estimatedHours: n.estimated_hours ?? null,
    completed: n.completed ?? false,
    completedAt: n.completed_at ?? null,
    depth: n.depth ?? 1,
    sortOrder: n.sort_order ?? 0,
  };
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

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;

    const { data: tree, error } = await supabase
      .from('skill_trees')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !tree) {
      console.error('[skills/trees/[id] PATCH]', error?.message);
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

    const { error } = await supabase
      .from('skill_trees')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[skills/trees/[id] DELETE]', error.message);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[skills/trees/[id] DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
