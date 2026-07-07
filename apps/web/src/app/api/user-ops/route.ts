// API: 用户运营
// GET  /api/user-ops — 获取漏斗事件、用户群体、细分列表
// POST /api/user-ops — 记录漏斗事件

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;

    const [funnelResult, cohortsResult, segmentsResult] = await Promise.allSettled([
      // Funnel events
      supabase
        .from('uo_funnel_events')
        .select('id, event_type, event_data, session_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),

      // Cohorts
      supabase
        .from('uo_cohorts')
        .select('id, cohort_name, cohort_date, user_count, retention_d1, retention_d7, retention_d30, conversion_rate, avg_sessions, notes, created_at')
        .order('created_at', { ascending: false }),

      // Segments
      supabase
        .from('uo_user_segments')
        .select('id, name, description, criteria, user_count, last_computed_at, created_at')
        .order('created_at', { ascending: false }),
    ]);

    const funnelEvents =
      funnelResult.status === 'fulfilled' ? funnelResult.value.data ?? [] : [];
    const cohorts =
      cohortsResult.status === 'fulfilled' ? cohortsResult.value.data ?? [] : [];
    const segments =
      segmentsResult.status === 'fulfilled' ? segmentsResult.value.data ?? [] : [];

    return NextResponse.json({
      success: true,
      data: { funnelEvents, cohorts, segments },
    });
  } catch (err) {
    console.error('[user-ops GET]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询用户运营数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;
    const body = await request.json();

    const { event_type } = body;

    if (!event_type) {
      return NextResponse.json(
        { error: '缺少必填参数: event_type' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('uo_funnel_events')
      .insert({
        user_id: userId,
        event_type,
        event_data: body.event_data ?? {},
        session_id: body.session_id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[user-ops POST]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '记录漏斗事件失败' }, { status: 500 });
  }
}
