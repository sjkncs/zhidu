// API: 分数转位次估算
// GET /api/assessments/rank-to-score?score=620&province=广东&year=2024
//
// 根据 admission_scores 表中的历年数据，找到与输入分数最接近的记录，
// 返回该记录对应的最低录取位次（minRank）作为估算位次，并附带置信度。

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdmissionScores } from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const score = parseFloat(searchParams.get('score') ?? '');
    const province = searchParams.get('province') ?? '';
    const year = parseInt(
      searchParams.get('year') ?? new Date().getFullYear().toString(),
    );

    // ── 参数校验 ──
    if (!score || isNaN(score)) {
      return NextResponse.json(
        { error: '缺少必填参数: score（须为有效数字）' },
        { status: 400 },
      );
    }

    if (!province) {
      return NextResponse.json(
        { error: '缺少必填参数: province' },
        { status: 400 },
      );
    }

    // ── 查询录取数据 ──
    const records = await getAdmissionScores({ province, year });

    if (records.length === 0) {
      return NextResponse.json(
        { error: '未找到该省份/年份的录取数据，请尝试其他年份' },
        { status: 404 },
      );
    }

    // ── 找到 minScore 最接近输入分数的记录 ──
    let bestMatch = records[0];
    let bestDiff = Math.abs(records[0].minScore - score);

    for (let i = 1; i < records.length; i++) {
      const diff = Math.abs(records[i].minScore - score);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMatch = records[i];
      }
    }

    // ── 计算置信度 ──
    // 分差越小置信度越高；分差为 0 时置信度为 1，分差 >= 50 时置信度趋近 0
    // 使用指数衰减函数: confidence = e^(-diff/20)
    const confidence = Math.round(Math.exp(-bestDiff / 20) * 1000) / 1000;

    // ── 如果没有 minRank 数据，返回提示 ──
    if (bestMatch.minRank == null) {
      return NextResponse.json({
        success: true,
        data: {
          estimatedRank: null,
          confidence,
          referenceScore: bestMatch.minScore,
          province,
          year,
          message: '该记录暂无位次数据，仅可作为分数参考',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        estimatedRank: bestMatch.minRank,
        confidence,
        referenceScore: bestMatch.minScore,
        province,
        year,
      },
    });
  } catch (err) {
    console.error('[API] assessments/rank-to-score GET error:', err);
    return NextResponse.json(
      { error: '位次估算服务暂时不可用，请稍后重试' },
      { status: 500 },
    );
  }
}
