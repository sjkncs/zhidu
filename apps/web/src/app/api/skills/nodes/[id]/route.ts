// API: 技能节点更新 / 删除
// PATCH  /api/skills/nodes/[id]  — 更新技能节点
// DELETE /api/skills/nodes/[id]  — 删除技能节点

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // 验证节点归属当前用户
    const { data: node } = await supabase
      .from('skill_nodes')
      .select('id, skill_tree_id')
      .eq('id', id)
      .single();

    if (!node) {
      return NextResponse.json({ error: '节点不存在' }, { status: 404 });
    }

    const { data: tree } = await supabase
      .from('skill_trees')
      .select('id')
      .eq('id', node.skill_tree_id)
      .eq('user_id', user.id)
      .single();

    if (!tree) {
      return NextResponse.json({ error: '无权操作' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (progress !== undefined) updates.progress = progress;
    if (difficulty !== undefined) updates.difficulty = difficulty;
    if (prerequisites !== undefined) updates.prerequisites = prerequisites;
    if (resources !== undefined) updates.resources = resources;
    if (estimatedHours !== undefined) updates.estimated_hours = estimatedHours;

    const { data: updated, error } = await supabase
      .from('skill_nodes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      console.error('[skills/nodes/[id] PATCH]', error?.message);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updated });
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

    // 验证节点归属当前用户
    const { data: node } = await supabase
      .from('skill_nodes')
      .select('id, skill_tree_id')
      .eq('id', id)
      .single();

    if (!node) {
      return NextResponse.json({ error: '节点不存在' }, { status: 404 });
    }

    const { data: tree } = await supabase
      .from('skill_trees')
      .select('id')
      .eq('id', node.skill_tree_id)
      .eq('user_id', user.id)
      .single();

    if (!tree) {
      return NextResponse.json({ error: '无权操作' }, { status: 403 });
    }

    const { error } = await supabase
      .from('skill_nodes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[skills/nodes/[id] DELETE]', error.message);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[skills/nodes/[id] DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
