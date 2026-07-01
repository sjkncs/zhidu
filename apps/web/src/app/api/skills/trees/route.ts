// API: 技能树列表 / 创建
// GET  /api/skills/trees  — 获取用户所有技能树
// POST /api/skills/trees  — 创建技能树

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 使用认证客户端查询（RLS 需要 auth.uid()）
    const { data: trees, error } = await supabase
      .from('skill_trees')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[skills/trees GET]', error.message);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: trees ?? [],
      count: (trees ?? []).length,
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

    // 使用认证客户端写入（RLS 需要 auth.uid()）
    const { data: tree, error } = await supabase
      .from('skill_trees')
      .insert({
        user_id: user.id,
        name,
        description: description ?? null,
        category: category ?? 'CUSTOM',
        source_major: sourceMajor ?? null,
        source_career: sourceCareer ?? null,
        ai_generated: aiGenerated ?? false,
      })
      .select()
      .single();

    if (error || !tree) {
      console.error('[skills/trees POST]', error?.message);
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: tree });
  } catch (err) {
    console.error('[skills/trees POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
