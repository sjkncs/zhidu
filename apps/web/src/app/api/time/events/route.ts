// API: 日程事件 / 创建
// GET  /api/time/events  — 获取用户日程事件
// POST /api/time/events  — 创建日程事件

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserScheduleEvents, createScheduleEvent } from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get('startTime') || undefined;
    const endTime = searchParams.get('endTime') || undefined;
    const eventType = searchParams.get('eventType') || undefined;

    const events = await getUserScheduleEvents(user.id, { startTime, endTime, eventType });

    return NextResponse.json({ success: true, data: events, count: events.length });
  } catch (err) {
    console.error('[time/events GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, startTime, endTime, allDay, eventType, recurrence, location } = body;

    if (!title || !startTime) {
      return NextResponse.json({ error: '缺少必填参数: title, startTime' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const event = await createScheduleEvent({
      userId: user.id, title, description, startTime, endTime, allDay, eventType, recurrence, location,
    });

    if (!event) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: event });
  } catch (err) {
    console.error('[time/events POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
