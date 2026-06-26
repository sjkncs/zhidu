// API: 志愿推荐 — 根据分数/省份/选科获取冲稳保推荐
// GET /api/volunteer/recommend?score=620&province=广东&limit=50

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createRuleEngine } from '@zhidu/ai/rule-engine';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const score = parseInt(searchParams.get('score') ?? '0');
  const province = searchParams.get('province') ?? '';
  const limit = parseInt(searchParams.get('limit') ?? '50');
  const subjects = searchParams.get('subjects')?.split(',') ?? [];

  if (!score || !province) {
    return NextResponse.json(
      { error: '缺少必填参数: score, province' },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();

    // 检查用户是否已登录
    const { data: { user } } = await supabase.auth.getUser();

    // 创建规则引擎实例
    const engine = createRuleEngine(supabase);

    // 执行志愿推荐
    const items = await engine.matchByScore({
      score,
      province,
      subjectCombination: subjects.length > 0 ? subjects : undefined,
      limit,
    });

    // 统计各层级数量
    const stats = {
      total: items.length,
      rush: items.filter(i => i.riskLevel === 'RUSH').length,
      stable: items.filter(i => i.riskLevel === 'STABLE').length,
      safe: items.filter(i => i.riskLevel === 'SAFE').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        score,
        province,
        items,
        stats,
      },
    });
  } catch (err) {
    console.error('[API] volunteer recommend error:', err);
    return NextResponse.json(
      { error: '推荐服务暂时不可用，请稍后重试' },
      { status: 500 },
    );
  }
}
