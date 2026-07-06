// PATCH /api/ai/chat/messages/[id]
// Body: { content: string }
// Updates the content of a specific chat message (user edit persistence)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    let auth;
    try {
      auth = await requireUser();
    } catch (err) {
      return authErrorResponse(err);
    }

    const { id: messageId } = await params;
    const body = await request.json();
    const { content } = body;

    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'content 不能为空' },
        { status: 400 },
      );
    }

    // 内容长度限制（防止超大 payload）
    if (content.length > 50000) {
      return NextResponse.json(
        { error: '内容超出长度限制（50000 字符）' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // 验证消息存在且属于当前用户的会话
    const { data: message, error: msgError } = await supabase
      .from('chat_messages')
      .select('id, session_id')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return NextResponse.json({ error: '消息不存在' }, { status: 404 });
    }

    // 验证会话归属权
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', message.session_id)
      .eq('user_id', auth.user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: '无权操作此消息' }, { status: 403 });
    }

    // 更新消息内容
    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({ content })
      .eq('id', messageId);

    if (updateError) {
      console.error('[MessageEdit] Update failed:', updateError);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { id: messageId, content } });
  } catch (err) {
    console.error('[MessageEdit] Error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
