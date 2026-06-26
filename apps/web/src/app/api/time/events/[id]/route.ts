// API: 单个日程事件
// PATCH  /api/time/events/[id]  — 更新事件
// DELETE /api/time/events/[id]  — 删除事件

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateScheduleEvent, deleteScheduleEvent } from '@zhidu/db/repository';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json();
    const event = await updateScheduleEvent(id, body);

    if (!event) return NextResponse.json({ error: '更新失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: event });
  } catch (err) {
    console.error('[time/events PATCH]', err);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const ok = await deleteScheduleEvent(id);
    if (!ok) return NextResponse.json({ error: '删除失败' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[time/events DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
