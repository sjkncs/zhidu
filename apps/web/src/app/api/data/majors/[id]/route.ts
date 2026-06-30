// API: 专业详情查询
// GET /api/data/majors/[id]
// 返回单个专业完整信息 + 薪酬数据 + 开设院校

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 并行查询专业信息 + 薪酬数据
    const [majorResult, salaryResult] = await Promise.all([
      supabase.from('majors').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('major_salary_data')
        .select('*')
        .eq('major_id', id)
        .order('year', { ascending: false })
        .limit(5),
    ]);

    if (majorResult.error) {
      console.error('[Major Detail] query error:', majorResult.error.message);
      return NextResponse.json(
        { error: '专业信息查询失败' },
        { status: 500 },
      );
    }

    if (!majorResult.data) {
      return NextResponse.json(
        { error: '专业不存在' },
        { status: 404 },
      );
    }

    // 如果专业有 offering_schools，查询开设院校详情
    const major = majorResult.data;
    let offeringUniversities: unknown[] = [];
    const offeringSchools = (major as any).offering_schools;
    if (Array.isArray(offeringSchools) && offeringSchools.length > 0) {
      const names = offeringSchools
        .filter((s: any) => s?.name)
        .map((s: any) => s.name);
      if (names.length > 0) {
        const uniRes = await supabase
          .from('universities')
          .select('id, name, province, tier, is_985, is_211, school_type')
          .in('name', names.slice(0, 20));
        offeringUniversities = uniRes.data ?? [];
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        major,
        salaryData: salaryResult.data ?? [],
        offeringUniversities,
      },
    });
  } catch (err: any) {
    console.error('[API] major detail error:', err);
    return NextResponse.json(
      { error: err.message || '专业详情服务暂时不可用' },
      { status: 500 },
    );
  }
}
