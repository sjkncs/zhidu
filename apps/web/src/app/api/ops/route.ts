// API: 运营管理
// GET  /api/ops — 获取 SOP 列表、近期执行记录、KPI
// POST /api/ops — 创建 SOP 或记录 KPI

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;

    const [sopsResult, runsResult, kpisResult] = await Promise.allSettled([
      // SOPs
      supabase
        .from('ops_sop')
        .select('id, title, category, steps, frequency, is_active, completion_count, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),

      // Recent SOP runs
      supabase
        .from('ops_checklist_run')
        .select('id, sop_id, run_date, status, results, completed_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),

      // KPIs
      supabase
        .from('ops_kpi')
        .select('id, metric_name, metric_value, target_value, unit, period, record_date, created_at')
        .eq('user_id', userId)
        .order('record_date', { ascending: false })
        .limit(20),
    ]);

    const sops =
      sopsResult.status === 'fulfilled' ? sopsResult.value.data ?? [] : [];
    const recentRuns =
      runsResult.status === 'fulfilled' ? runsResult.value.data ?? [] : [];
    const kpis =
      kpisResult.status === 'fulfilled' ? kpisResult.value.data ?? [] : [];

    return NextResponse.json({
      success: true,
      data: { sops, recentRuns, kpis },
    });
  } catch (err) {
    console.error('[ops GET]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询运营数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;
    const body = await request.json();

    const { entity_type } = body;

    if (!entity_type || !['sop', 'kpi'].includes(entity_type)) {
      return NextResponse.json(
        { error: 'entity_type 必须为 sop 或 kpi' },
        { status: 400 },
      );
    }

    if (entity_type === 'sop') {
      const { name, description } = body;
      if (!name) {
        return NextResponse.json(
          { error: '缺少必填参数: name' },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from('ops_sop')
        .insert({
          user_id: userId,
          title: name,
          category: body.category ?? 'general',
          frequency: body.frequency ?? 'once',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // entity_type === 'kpi'
    const { name, category, value, target, unit } = body;
    if (!name || value == null) {
      return NextResponse.json(
        { error: '缺少必填参数: name, value' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('ops_kpi')
      .insert({
        user_id: userId,
        metric_name: name,
        metric_value: Number(value),
        target_value: target != null ? Number(target) : 0,
        unit: unit ?? null,
        record_date: new Date().toISOString().split('T')[0],
        period: body.period ?? 'daily',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[ops POST]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
