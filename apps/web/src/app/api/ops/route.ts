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
        .from('sops')
        .select('id, name, description, status, version, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),

      // Recent SOP runs
      supabase
        .from('sop_runs')
        .select('id, sop_id, status, started_at, completed_at, result_summary')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(10),

      // KPIs
      supabase
        .from('kpis')
        .select('id, name, category, value, target, unit, recorded_at')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
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
        .from('sops')
        .insert({
          user_id: userId,
          name,
          description: description ?? null,
          status: 'draft',
          version: '1.0.0',
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
      .from('kpis')
      .insert({
        user_id: userId,
        name,
        category: category ?? null,
        value: Number(value),
        target: target != null ? Number(target) : null,
        unit: unit ?? null,
        recorded_at: new Date().toISOString(),
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
