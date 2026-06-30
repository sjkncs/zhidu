// API: 院校详情查询
// GET /api/data/universities/[id]
// 返回单个院校完整信息 + 排名 + 学科评估

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 并行查询院校信息、排名、学科评估
    const [uniResult, rankResult, evalResult] = await Promise.all([
      supabase.from('universities').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('university_rankings')
        .select('*')
        .eq('university_id', id)
        .order('year', { ascending: false })
        .limit(10),
      supabase
        .from('discipline_evaluations')
        .select('*')
        .eq('university_id', id)
        .order('rating', { ascending: true }),
    ]);

    if (uniResult.error) {
      console.error('[University Detail] query error:', uniResult.error.message);
      return NextResponse.json(
        { error: '院校信息查询失败' },
        { status: 500 },
      );
    }

    if (!uniResult.data) {
      return NextResponse.json(
        { error: '院校不存在' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        university: uniResult.data,
        rankings: rankResult.data ?? [],
        disciplineEvaluations: evalResult.data ?? [],
      },
    });
  } catch (err: any) {
    console.error('[API] university detail error:', err);
    return NextResponse.json(
      { error: err.message || '院校详情服务暂时不可用' },
      { status: 500 },
    );
  }
}
