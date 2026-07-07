// API: 数据平台
// GET  /api/data-platform — 获取模型列表、数据管道、质量指标
// POST /api/data-platform — 创建或更新模型/管道条目

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;

    const [modelsResult, pipelinesResult, qualityResult] = await Promise.allSettled([
      // Data models
      supabase
        .from('dp_model_registry')
        .select('id, name, version, model_type, provider, status, description, metrics, created_at, updated_at')
        .order('updated_at', { ascending: false }),

      // Data pipelines
      supabase
        .from('dp_data_pipeline')
        .select('id, name, pipeline_type, schedule, status, last_run_at, last_run_status, records_processed, created_at, updated_at')
        .order('created_at', { ascending: false }),

      // Data quality metrics
      supabase
        .from('dp_quality_metrics')
        .select('id, metric_date, module, total_records, valid_records, completeness, accuracy, freshness_hours, anomalies_detected, created_at')
        .order('metric_date', { ascending: false })
        .limit(20),
    ]);

    const models =
      modelsResult.status === 'fulfilled' ? modelsResult.value.data ?? [] : [];
    const pipelines =
      pipelinesResult.status === 'fulfilled' ? pipelinesResult.value.data ?? [] : [];
    const qualityMetrics =
      qualityResult.status === 'fulfilled' ? qualityResult.value.data ?? [] : [];

    return NextResponse.json({
      success: true,
      data: { models, pipelines, qualityMetrics },
    });
  } catch (err) {
    console.error('[data-platform GET]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询数据平台失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;
    const body = await request.json();

    const { entity_type } = body;

    if (!entity_type || !['model', 'pipeline'].includes(entity_type)) {
      return NextResponse.json(
        { error: 'entity_type 必须为 model 或 pipeline' },
        { status: 400 },
      );
    }

    if (entity_type === 'model') {
      const { name, description, status, version } = body;
      if (!name) {
        return NextResponse.json(
          { error: '缺少必填参数: name' },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from('dp_model_registry')
        .upsert({
          name,
          description: description ?? null,
          status: status ?? 'active',
          version: version ?? '1.0',
          model_type: body.model_type ?? 'rule_engine',
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // entity_type === 'pipeline'
    const { name, type, schedule } = body;
    if (!name) {
      return NextResponse.json(
        { error: '缺少必填参数: name' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('dp_data_pipeline')
      .upsert({
        name,
        pipeline_type: type ?? 'batch',
        schedule: schedule ?? null,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[data-platform POST]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
