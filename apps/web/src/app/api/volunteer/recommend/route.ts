// API: 志愿智能推荐 — 确定性匹配引擎（位次法 + 线差法双模型）
// POST /api/volunteer/recommend
// Body: { score, province, subjectType, year?, rank?, preferredMajorIds?, preferredCities?, tierFilter? }
//
// 架构原则（对标高考数据通）：
//   数据匹配用确定性算法（SQL + 位次法/线差法），不用 LLM
//   AI 的角色是意图理解和结果分析，不是数据匹配

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { VolunteerMatchingEngine } from '@zhidu/ai/volunteer-engine';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json();
    const {
      score,
      province,
      subjectType,
      year,
      rank,
      preferredMajorIds,
      preferredCities,
      tierFilter,
    } = body;

    if (!score || typeof score !== 'number') {
      return NextResponse.json({ error: '缺少必填参数: score (分数)' }, { status: 400 });
    }
    if (!province || typeof province !== 'string') {
      return NextResponse.json({ error: '缺少必填参数: province (省份)' }, { status: 400 });
    }

    const st = subjectType || '物理类';
    const queryYear = year && year <= 2025 ? year : 2025;

    const engine = new VolunteerMatchingEngine();
    const recommendation = await engine.recommend({
      score,
      province,
      subjectType: st,
      year: queryYear,
      rank: rank ?? undefined,
      preferredMajorIds: preferredMajorIds ?? undefined,
      preferredCities: preferredCities ?? undefined,
      tierFilter: tierFilter ?? undefined,
    });

    return NextResponse.json({ success: true, data: recommendation });
  } catch (err: any) {
    console.error('[volunteer/recommend]', err);
    return NextResponse.json(
      { error: err.message || '志愿推荐服务暂时不可用' },
      { status: 500 },
    );
  }
}

// GET 兼容性（旧版接口 + 前端旧代码）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const score = parseInt(searchParams.get('score') ?? '0');
  const province = searchParams.get('province') ?? '';
  const subjectType = searchParams.get('subjectType') ?? '物理类';

  if (!score || !province) {
    return NextResponse.json(
      { error: '缺少必填参数: score, province' },
      { status: 400 },
    );
  }

  try {
    const engine = new VolunteerMatchingEngine();
    const recommendation = await engine.recommend({
      score,
      province,
      subjectType,
      year: 2025,
    });

    return NextResponse.json({
      success: true,
      data: { score, province, ...recommendation },
    });
  } catch (err: any) {
    console.error('[API] volunteer recommend error:', err);
    return NextResponse.json(
      { error: err.message || '推荐服务暂时不可用，请稍后重试' },
      { status: 500 },
    );
  }
}
