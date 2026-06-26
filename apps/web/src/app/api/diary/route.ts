// API: 日记 / 创建
// GET  /api/diary  — 获取用户日记
// POST /api/diary  — 创建日记

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserDiaryEntries, createDiaryEntry } from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const minMood = searchParams.get('minMood');
    const maxMood = searchParams.get('maxMood');
    const limit = searchParams.get('limit');

    const entries = await getUserDiaryEntries(user.id, {
      startDate,
      endDate,
      minMood: minMood ? parseInt(minMood) : undefined,
      maxMood: maxMood ? parseInt(maxMood) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json({ success: true, data: entries, count: entries.length });
  } catch (err) {
    console.error('[diary GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, mood, moodTags, entryDate } = body;

    if (!content || !entryDate) {
      return NextResponse.json({ error: '缺少必填参数: content, entryDate' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const entry = await createDiaryEntry({
      userId: user.id, title, content, mood, moodTags, entryDate,
    });

    if (!entry) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: entry });
  } catch (err) {
    console.error('[diary POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
