// API: 学业统计
// GET /api/academic/summary  — 获取 GPA、学分统计、类别分布
// 支持 ?semester= 参数过滤特定学期

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAcademicSummary, getGpaBySemester, getCourseCategoryStats } from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const semester = searchParams.get('semester') || undefined;

    const [summary, gpaTrend, categoryStats] = await Promise.all([
      getAcademicSummary(user.id, semester),
      getGpaBySemester(user.id),
      getCourseCategoryStats(user.id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        summary: summary ?? { gpa: 0, weightedAvg: 0, totalCredits: 0, earnedCredits: 0, courseCount: 0 },
        gpaTrend,
        categoryStats,
      },
    });
  } catch (err) {
    console.error('[academic/summary GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
