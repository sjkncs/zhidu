// API: 客服支持
// GET  /api/support — 获取用户工单列表、FAQ 条目
// POST /api/support — 创建工单

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;

    const [ticketsResult, faqResult] = await Promise.allSettled([
      // User's support tickets
      supabase
        .from('cs_tickets')
        .select('id, title, description, status, priority, category, satisfaction, opened_at, resolved_at, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // FAQ items
      supabase
        .from('cs_faq')
        .select('id, question, answer, category, tags, view_count, helpful_count')
        .eq('is_active', true)
        .order('view_count', { ascending: true }),
    ]);

    const tickets =
      ticketsResult.status === 'fulfilled' ? ticketsResult.value.data ?? [] : [];
    const faqItems =
      faqResult.status === 'fulfilled' ? faqResult.value.data ?? [] : [];

    return NextResponse.json({
      success: true,
      data: { tickets, faqItems },
    });
  } catch (err) {
    console.error('[support GET]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询支持数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;
    const body = await request.json();

    const { subject, description, priority, category } = body;

    if (!subject) {
      return NextResponse.json(
        { error: '缺少必填参数: subject' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('cs_tickets')
      .insert({
        user_id: userId,
        title: subject,
        description: description ?? null,
        priority: priority != null ? Number(priority) : 3,
        category: category ?? 'general',
        status: 'open',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[support POST]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '创建工单失败' }, { status: 500 });
  }
}
