// API: 战略管理
// GET  /api/strategy — 获取目标（含关键成果）、里程碑列表
// POST /api/strategy — 创建目标或关键成果

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;

    const [objectivesResult, milestonesResult] = await Promise.allSettled([
      // Objectives with key results (nested)
      supabase
        .from('strat_objectives')
        .select(`
          id,
          title,
          description,
          status,
          progress,
          objective_type,
          quarter,
          created_at,
          strat_key_results (
            id,
            title,
            metric_type,
            current_value,
            target_value,
            unit,
            status
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Milestones
      supabase
        .from('strat_milestones')
        .select('id, objective_id, title, due_date, status, priority, completed_at, created_at')
        .eq('user_id', userId)
        .order('due_date', { ascending: true }),
    ]);

    const objectives =
      objectivesResult.status === 'fulfilled' ? objectivesResult.value.data ?? [] : [];
    const milestones =
      milestonesResult.status === 'fulfilled' ? milestonesResult.value.data ?? [] : [];

    return NextResponse.json({
      success: true,
      data: { objectives, milestones },
    });
  } catch (err) {
    console.error('[strategy GET]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询战略数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;
    const body = await request.json();

    const { entity_type } = body;

    if (!entity_type || !['objective', 'key_result'].includes(entity_type)) {
      return NextResponse.json(
        { error: 'entity_type 必须为 objective 或 key_result' },
        { status: 400 },
      );
    }

    if (entity_type === 'objective') {
      const { title, description, start_date, end_date } = body;
      if (!title) {
        return NextResponse.json(
          { error: '缺少必填参数: title' },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from('strat_objectives')
        .insert({
          user_id: userId,
          title,
          description: description ?? null,
          status: 'active',
          progress: 0,
          objective_type: body.objective_type ?? 'personal',
          quarter: body.quarter ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // entity_type === 'key_result'
    const { objective_id, title, metric, target_value, unit } = body;
    if (!objective_id || !title) {
      return NextResponse.json(
        { error: '缺少必填参数: objective_id, title' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('strat_key_results')
      .insert({
        objective_id,
        title,
        metric_type: metric ?? 'number',
        current_value: 0,
        target_value: target_value != null ? Number(target_value) : 100,
        unit: unit ?? null,
        status: 'on_track',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[strategy POST]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
