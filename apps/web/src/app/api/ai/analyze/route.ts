// API: AI 深度分析 — 志愿方案解读 / 专业对比 / 职业路径
// POST /api/ai/analyze
// Body: { type: 'volunteer' | 'major_compare' | 'career', ... }

import { NextRequest, NextResponse } from 'next/server';
import {
  createLLMService,
  buildVolunteerAnalysisPrompt,
  buildMajorComparisonPrompt,
  buildCareerPathPrompt,
} from '@zhidu/ai/llm-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    const llm = createLLMService();
    let messages;

    switch (type) {
      case 'volunteer': {
        const { score, province, items = [], interests } = body;
        if (!score || !province) {
          return NextResponse.json(
            { error: '缺少必填参数: score, province' },
            { status: 400 },
          );
        }

        // 按风险等级分组
        const rushItems = items
          .filter((i: any) => i.riskLevel === 'RUSH')
          .map((i: any) => ({
            universityName: extractUniName(i.remark),
            majorName: extractMajorName(i.remark),
            probability: i.estimatedProbability,
          }));
        const stableItems = items
          .filter((i: any) => i.riskLevel === 'STABLE')
          .map((i: any) => ({
            universityName: extractUniName(i.remark),
            majorName: extractMajorName(i.remark),
            probability: i.estimatedProbability,
          }));
        const safeItems = items
          .filter((i: any) => i.riskLevel === 'SAFE')
          .map((i: any) => ({
            universityName: extractUniName(i.remark),
            majorName: extractMajorName(i.remark),
            probability: i.estimatedProbability,
          }));

        messages = buildVolunteerAnalysisPrompt({
          score, province, rushItems, stableItems, safeItems, interests,
        });
        break;
      }

      case 'major_compare': {
        const { majors = [], context } = body;
        if (!majors.length) {
          return NextResponse.json(
            { error: '请提供至少一个专业名称' },
            { status: 400 },
          );
        }
        messages = buildMajorComparisonPrompt(majors, context);
        break;
      }

      case 'career': {
        const { major, mbtiType, hollandCode } = body;
        if (!major) {
          return NextResponse.json(
            { error: '请提供专业方向' },
            { status: 400 },
          );
        }
        messages = buildCareerPathPrompt({ major, mbtiType, hollandCode });
        break;
      }

      default:
        return NextResponse.json(
          { error: `不支持的分析类型: ${type}` },
          { status: 400 },
        );
    }

    const result = await llm.chat({ messages });

    return NextResponse.json({
      success: true,
      data: {
        type,
        content: result,
      },
    });
  } catch (err: any) {
    console.error('[API] AI analyze error:', err);
    return NextResponse.json(
      { error: err.message || 'AI 分析服务暂时不可用' },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────────────────────────────────────

function extractUniName(remark: string): string {
  const match = remark.match(/^(.+?)\s*-/);
  return match ? match[1].trim() : remark.split('|')[0]?.trim() ?? '未知';
}

function extractMajorName(remark: string): string {
  const match = remark.match(/-\s*(.+?)\s*\|/);
  return match ? match[1].trim() : '未知';
}
