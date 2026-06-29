// API: 对话会话管理
// GET  /api/ai/chat/sessions  — 获取用户的对话历史列表
// POST /api/ai/chat/sessions  — 创建新对话会话

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserChatSessions, createChatSession } from '@zhidu/db/repository';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const sessions = await getUserChatSessions(user.id, 50);
    return NextResponse.json({ success: true, data: sessions });
  } catch (err) {
    console.error('[chat/sessions GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const session = await createChatSession(user.id, body.title);
    if (!session) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: session });
  } catch (err) {
    console.error('[chat/sessions POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
