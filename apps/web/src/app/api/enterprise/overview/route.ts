// API: 企业运营总览
// GET /api/enterprise/overview — 获取企业运营总览数据 + 近期活动

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;

    // Fetch overview metrics, recent funnel events, and model metrics in parallel
    const [overviewResult, funnelResult, metricsResult] = await Promise.allSettled([
      // Enterprise overview aggregated view
      supabase
        .from('enterprise_overview')
        .select('*')
        .single(),

      // Recent funnel events (last 7 days)
      supabase
        .from('uo_funnel_events')
        .select('id, event_type, event_data, session_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),

      // Model performance metrics
      supabase
        .from('dp_model_registry')
        .select('id, name, version, model_type, provider, status, metrics, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(5),
    ]);

    const overview =
      overviewResult.status === 'fulfilled' ? overviewResult.value.data : null;
    const funnelEvents =
      funnelResult.status === 'fulfilled' ? funnelResult.value.data ?? [] : [];
    const modelMetrics =
      metricsResult.status === 'fulfilled' ? metricsResult.value.data ?? [] : [];

    return NextResponse.json({
      success: true,
      data: {
        overview,
        recentFunnelEvents: funnelEvents,
        modelMetrics,
      },
    });
  } catch (err) {
    console.error('[enterprise/overview GET]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询企业运营总览失败' }, { status: 500 });
  }
}
