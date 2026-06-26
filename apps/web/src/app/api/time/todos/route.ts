// API: 待办事项 / 创建
// GET  /api/time/todos  — 获取用户待办
// POST /api/time/todos  — 创建待办

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserTodos, createTodo } from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const completedParam = searchParams.get('completed');
    const category = searchParams.get('category') || undefined;
    const parentId = searchParams.get('parentId');
    const priority = searchParams.get('priority');

    const todos = await getUserTodos(user.id, {
      completed: completedParam !== null ? completedParam === 'true' : undefined,
      category,
      parentId: parentId !== null ? parentId : undefined,
      priority: priority ? parseInt(priority) : undefined,
    });

    return NextResponse.json({ success: true, data: todos, count: todos.length });
  } catch (err) {
    console.error('[time/todos GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, priority, dueDate, parentId, tags, category, sortOrder } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: '缺少必填参数: title' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const todo = await createTodo({
      userId: user.id, title, description, priority, dueDate, parentId, tags, category, sortOrder,
    });

    if (!todo) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: todo });
  } catch (err) {
    console.error('[time/todos POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
