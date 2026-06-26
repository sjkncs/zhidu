// API: 单个待办事项
// PATCH  /api/time/todos/[id]  — 更新待办
// DELETE /api/time/todos/[id]  — 删除待办

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateTodo, deleteTodo } from '@zhidu/db/repository';

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
    const todo = await updateTodo(id, body);

    if (!todo) return NextResponse.json({ error: '更新失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: todo });
  } catch (err) {
    console.error('[time/todos PATCH]', err);
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

    const ok = await deleteTodo(id);
    if (!ok) return NextResponse.json({ error: '删除失败' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[time/todos DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
