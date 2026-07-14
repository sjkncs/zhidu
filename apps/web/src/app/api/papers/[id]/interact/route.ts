// API: 论文用户交互 — 收藏、标记已读、笔记、评分
// POST /api/papers/[id]/interact
// Body: { action: 'bookmark' | 'read' | 'note' | 'share', note?, rating?, tags? }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_ACTIONS = ['bookmark', 'read', 'note', 'share', 'investigate'] as const;
type ActionType = typeof VALID_ACTIONS[number];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action as ActionType;

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `无效操作。可选: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 },
      );
    }

    // 检查论文是否存在
    const { data: paper } = await supabase
      .from('papers')
      .select('id')
      .eq('id', id)
      .single();

    if (!paper) {
      return NextResponse.json({ error: '论文不存在' }, { status: 404 });
    }

    // toggle 逻辑：如果已存在同类型交互，则删除（取消收藏等）
    const { data: existing } = await supabase
      .from('paper_interactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('paper_id', id)
      .eq('interaction_type', action)
      .maybeSingle();

    if (existing && (action === 'bookmark' || action === 'read' || action === 'share')) {
      // Toggle off: 删除交互记录
      await supabase
        .from('paper_interactions')
        .delete()
        .eq('id', existing.id);

      return NextResponse.json({
        success: true,
        data: { action, toggled: false, message: `已取消${actionLabel(action)}` },
      });
    }

    // Upsert 交互记录
    const { data, error } = await supabase
      .from('paper_interactions')
      .upsert(
        {
          user_id: user.id,
          paper_id: id,
          interaction_type: action,
          note: body.note || null,
          rating: body.rating || null,
          tags: body.tags || [],
        },
        { onConflict: 'user_id,paper_id,interaction_type' },
      )
      .select()
      .single();

    if (error) {
      console.error('[Paper Interact] Error:', error.message);
      return NextResponse.json({ error: '操作失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { action, toggled: true, interaction: data, message: `已${actionLabel(action)}` },
    });
  } catch (err) {
    console.error('[Paper Interact] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function actionLabel(action: ActionType): string {
  const labels: Record<ActionType, string> = {
    bookmark: '收藏',
    read: '标记已读',
    note: '添加笔记',
    share: '分享',
    investigate: '标记调研',
  };
  return labels[action] || action;
}
