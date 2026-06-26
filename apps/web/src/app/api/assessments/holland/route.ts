// API: 霍兰德职业兴趣测评 — 获取题目 / 提交答案并计算结果
// GET  /api/assessments/holland       → 返回全部题目
// POST /api/assessments/holland       → 接收答案，返回测评结果（已登录用户同时存入数据库）

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getHollandQuestions, calculateHolland } from '@zhidu/ai/assessments';

/**
 * GET — 返回霍兰德全部 36 道题目
 */
export async function GET() {
  try {
    const questions = getHollandQuestions();
    return NextResponse.json({
      success: true,
      data: {
        type: 'holland',
        totalQuestions: questions.length,
        ratingScale: [
          { value: 1, label: '非常不喜欢' },
          { value: 2, label: '不喜欢' },
          { value: 3, label: '一般' },
          { value: 4, label: '喜欢' },
          { value: 5, label: '非常喜欢' },
        ],
        questions,
      },
    });
  } catch (err) {
    console.error('[API] assessments/holland GET error:', err);
    return NextResponse.json(
      { error: '获取测评题目失败，请稍后重试' },
      { status: 500 },
    );
  }
}

/**
 * POST — 接收用户答案并计算霍兰德结果
 * Body: { answers: Array<{ questionId: number; rating: number }> }
 *   rating 取值范围：1（非常不喜欢）~ 5（非常喜欢）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { answers } = body;

    // ── 参数校验 ──
    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: '请提供有效的答案数据（answers 数组不能为空）' },
        { status: 400 },
      );
    }

    for (const ans of answers) {
      if (typeof ans.questionId !== 'number' || typeof ans.rating !== 'number' || ans.rating < 1 || ans.rating > 5) {
        return NextResponse.json(
          { error: '答案格式错误：questionId 须为数字，rating 须为 1-5 的整数' },
          { status: 400 },
        );
      }
    }

    // ── 计算结果 ──
    const result = calculateHolland(answers);

    // ── 尝试保存结果（已登录用户） ──
    let savedId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('assessments')
          .insert({
            user_id: user.id,
            type: 'holland',
            result: result as unknown as Record<string, unknown>,
            answers: answers as unknown as Record<string, unknown>[],
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (error) {
          console.warn('[API] assessments/holland save warning:', error.message);
        } else {
          savedId = data?.id ?? null;
        }
      }
    } catch (dbErr) {
      // 保存失败不影响结果返回，仅记录警告
      console.warn('[API] assessments/holland save error:', dbErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        savedId,
      },
    });
  } catch (err) {
    console.error('[API] assessments/holland POST error:', err);
    return NextResponse.json(
      { error: '计算测评结果失败，请稍后重试' },
      { status: 500 },
    );
  }
}
