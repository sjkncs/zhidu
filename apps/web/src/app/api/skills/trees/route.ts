// API: 技能树列表 / 创建
// GET  /api/skills/trees  — 获取用户所有技能树
// POST /api/skills/trees  — 创建技能树

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSkillTrees, createSkillTree } from '@zhidu/db/repository';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const trees = await getUserSkillTrees(user.id);

    return NextResponse.json({
      success: true,
      data: trees,
      count: trees.length,
    });
  } catch (err) {
    console.error('[skills/trees GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, category, sourceMajor, sourceCareer, aiGenerated } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: name' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const tree = await createSkillTree({
      userId: user.id,
      name,
      description,
      category,
      sourceMajor,
      sourceCareer,
      aiGenerated,
    });

    if (!tree) {
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: tree });
  } catch (err) {
    console.error('[skills/trees POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
