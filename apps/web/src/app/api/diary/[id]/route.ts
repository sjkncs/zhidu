// API: 单篇日记
// PATCH  /api/diary/[id]  — 更新日记
// DELETE /api/diary/[id]  — 删除日记

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateDiaryEntry, deleteDiaryEntry } from '@zhidu/db/repository';

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
    const entry = await updateDiaryEntry(id, body);

    if (!entry) return NextResponse.json({ error: '更新失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: entry });
  } catch (err) {
    console.error('[diary PATCH]', err);
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

    const ok = await deleteDiaryEntry(id);
    if (!ok) return NextResponse.json({ error: '删除失败' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[diary DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
