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
        .from('funnel_events')
        .select('id, event_type, stage, count, conversion_rate, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),

      // Cohorts
      supabase
        .from('cohorts')
        .select('id, name, description, user_count, created_at, start_date, end_date')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Segments
      supabase
        .from('segments')
        .select('id, name, criteria, user_count, is_active, created_at')
        .eq('user_id', userId)
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

    const { event_type, stage, count, conversion_rate } = body;

    if (!event_type || !stage) {
      return NextResponse.json(
        { error: '缺少必填参数: event_type, stage' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('funnel_events')
      .insert({
        user_id: userId,
        event_type,
        stage,
        count: count != null ? Number(count) : 1,
        conversion_rate: conversion_rate != null ? Number(conversion_rate) : null,
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
