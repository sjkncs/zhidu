// API: 创建技能节点
// POST /api/skills/nodes  — 创建单个技能节点

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSkillNode } from '@zhidu/db/repository';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skillTreeId, title, description, parentNodeId, difficulty, prerequisites, resources, estimatedHours, sortOrder } = body;

    if (!skillTreeId || typeof skillTreeId !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: skillTreeId' },
        { status: 400 },
      );
    }

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

    const node = await createSkillNode({
      skillTreeId,
      title,
      description,
      parentNodeId,
      difficulty,
      prerequisites,
      resources,
      estimatedHours,
      sortOrder,
    });

    if (!node) {
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: node });
  } catch (err) {
    console.error('[skills/nodes POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
