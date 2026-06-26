// API: 单个备忘录
// PATCH  /api/memo/[id]  — 更新备忘
// DELETE /api/memo/[id]  — 删除备忘

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateMemo, deleteMemo } from '@zhidu/db/repository';

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
    const memo = await updateMemo(id, body);

    if (!memo) return NextResponse.json({ error: '更新失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: memo });
  } catch (err) {
    console.error('[memo PATCH]', err);
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

    const ok = await deleteMemo(id);
    if (!ok) return NextResponse.json({ error: '删除失败' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[memo DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
