// POST /api/ai/chat/messages/[id]/feedback
// Body: { feedback: 'up' | 'down' | null }
// Updates feedback for a specific chat message

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function POST(
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
    const { feedback } = body;

    if (feedback !== null && feedback !== 'up' && feedback !== 'down') {
      return NextResponse.json(
        { error: 'feedback 必须为 "up"、"down" 或 null' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Verify the message belongs to user's session
    const { data: message, error: msgError } = await supabase
      .from('chat_messages')
      .select('id, session_id')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return NextResponse.json({ error: '消息不存在' }, { status: 404 });
    }

    // Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', message.session_id)
      .eq('user_id', auth.user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: '无权操作此消息' }, { status: 403 });
    }

    // Update feedback
    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({
        feedback,
        feedback_at: feedback ? new Date().toISOString() : null,
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('[Feedback] Update failed:', updateError);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { feedback } });
  } catch (err) {
    console.error('[Feedback] Error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
