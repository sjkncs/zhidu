// API: 职业路径生成 — LLM 生成 + 存入数据库
// POST /api/career/generate
// Body: { major: string, mbtiType?: string, hollandCode?: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLLMService, buildCareerPathPrompt } from '@zhidu/ai/llm-service';
import type { CareerPathAIResult } from '@zhidu/ai/llm-service';
import { createCareerPath } from '@zhidu/db/repository';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { major, mbtiType, hollandCode } = body;

    if (!major || typeof major !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: major' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 调用 LLM 生成结构化职业路径
    const llm = createLLMService();
    const messages = buildCareerPathPrompt({ major, mbtiType, hollandCode });

    const result = await llm.chatJSON<CareerPathAIResult>({
      messages,
      options: { temperature: 0.7, maxTokens: 4096 },
    });

    if (!result?.paths || !Array.isArray(result.paths) || result.paths.length === 0) {
      return NextResponse.json(
        { error: 'LLM 返回数据格式异常' },
        { status: 502 },
      );
    }

    // 逐条存入数据库
    const savedPaths = [];
    for (const path of result.paths) {
      const saved = await createCareerPath({
        userId: user.id,
        targetRole: path.targetRole,
        targetIndustry: path.targetIndustry,
        salaryRange: path.salaryRange,
        requiredSkills: path.requiredSkills,
        shortTermGoals: path.shortTermGoals,
        midTermGoals: path.midTermGoals,
        longTermGoals: path.longTermGoals,
        industryTrends: path.industryTrends,
        matchScore: path.matchScore,
        sourceMajor: major,
        sourceMbti: mbtiType,
        sourceHolland: hollandCode,
      });
      if (saved) {
        savedPaths.push(saved);
      }
    }

    return NextResponse.json({
      success: true,
      data: savedPaths,
      count: savedPaths.length,
    });
  } catch (err) {
    console.error('[career/generate]', err);
    return NextResponse.json(
      { error: '生成失败，请稍后重试' },
      { status: 500 },
    );
  }
}
