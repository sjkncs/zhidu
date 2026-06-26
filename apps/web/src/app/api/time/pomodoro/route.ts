// API: 番茄钟
// GET  /api/time/pomodoro  — 获取番茄钟记录
// POST /api/time/pomodoro  — 创建番茄钟记录

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserPomodoroSessions, createPomodoroSession } from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const completedParam = searchParams.get('completed');

    const sessions = await getUserPomodoroSessions(user.id, {
      startDate,
      endDate,
      completed: completedParam !== null ? completedParam === 'true' : undefined,
    });

    // 统计摘要
    const totalMinutes = sessions.filter(s => s.completed).reduce((sum, s) => sum + s.durationMinutes, 0);
    const completedCount = sessions.filter(s => s.completed).length;

    return NextResponse.json({
      success: true,
      data: sessions,
      count: sessions.length,
      stats: { completedCount, totalMinutes },
    });
  } catch (err) {
    console.error('[time/pomodoro GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { todoId, durationMinutes, completed, startedAt, completedAt, notes } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const session = await createPomodoroSession({
      userId: user.id, todoId, durationMinutes, completed, startedAt, completedAt, notes,
    });

    if (!session) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: session });
  } catch (err) {
    console.error('[time/pomodoro POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
