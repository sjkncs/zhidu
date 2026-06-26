// API: 备忘录 / 创建
// GET  /api/memo  — 获取用户备忘录
// POST /api/memo  — 创建备忘

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserMemos, createMemo } from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const isPinnedParam = searchParams.get('isPinned');
    const isArchivedParam = searchParams.get('isArchived');
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit');

    const memos = await getUserMemos(user.id, {
      isPinned: isPinnedParam !== null ? isPinnedParam === 'true' : undefined,
      isArchived: isArchivedParam !== null ? isArchivedParam === 'true' : undefined,
      search,
      limit: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json({ success: true, data: memos, count: memos.length });
  } catch (err) {
    console.error('[memo GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, tags, isPinned, remindAt } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: '缺少必填参数: content' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const memo = await createMemo({
      userId: user.id, title, content, tags, isPinned, remindAt,
    });

    if (!memo) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: memo });
  } catch (err) {
    console.error('[memo POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
