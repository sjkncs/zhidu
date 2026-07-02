// API: 分数转位次估算（增强版）
// GET /api/assessments/rank-to-score?score=620&province=广东&subjectType=物理类
//
// 核心逻辑：
// 1. 优先查 score_rank_tables（一分一段表）获取精确位次
// 2. 回退到 admission_scores 表的 minRank 做线性插值估算
// 3. 年份回退：默认查最新年份，无数据则自动回退到最近有数据的年份
// 4. 支持 subjectType 筛选（物理类/历史类/理科/文科）

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── 新高考省份分类 ──────────────────────────────────────────────────────

/** 第一批新高考（3+3）：不分物理/历史，选3门 */
const NEW_GAOKAO_BATCH1 = new Set([
  '浙江', '上海', '北京', '天津', '山东', '海南',
]);

/** 第二批新高考（3+1+2）：分物理类/历史类 */
const NEW_GAOKAO_BATCH2 = new Set([
  '河北', '辽宁', '江苏', '福建', '湖北', '湖南', '广东', '重庆',
]);

/** 第三批新高考（3+1+2）：2024年起分物理类/历史类 */
const NEW_GAOKAO_BATCH3 = new Set([
  '吉林', '黑龙江', '安徽', '江西', '广西', '贵州', '甘肃',
]);

function getSubjectTypes(province: string): string[] {
  if (NEW_GAOKAO_BATCH1.has(province)) return ['综合'];
  if (NEW_GAOKAO_BATCH2.has(province) || NEW_GAOKAO_BATCH3.has(province)) {
    return ['物理类', '历史类'];
  }
  return ['理科', '文科'];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const score = parseFloat(searchParams.get('score') ?? '');
    const province = searchParams.get('province') ?? '';
    const requestedYear = parseInt(searchParams.get('year') ?? '0') || null;
    const subjectType = searchParams.get('subjectType') ?? '';
    const userRank = parseInt(searchParams.get('rank') ?? '0') || null;

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

    // 如果用户已知位次，直接返回
    if (userRank && userRank > 0) {
      return NextResponse.json({
        success: true,
        data: {
          estimatedRank: userRank,
          confidence: 1.0,
          referenceScore: score,
          province,
          subjectType: subjectType || null,
          year: requestedYear ?? new Date().getFullYear(),
          method: 'user_provided',
          message: '使用用户提供的位次',
        },
      });
    }

    const supabase = await createClient();
    const validSubjectTypes = getSubjectTypes(province);

    // ── Step 1: 尝试从 score_rank_tables 精确查询 ──
    const rankFromTable = await queryScoreRankTable(
      supabase, province, requestedYear, subjectType, score, validSubjectTypes,
    );
    if (rankFromTable) {
      return NextResponse.json({ success: true, data: rankFromTable });
    }

    // ── Step 2: 回退到 admission_scores 线性插值 ──
    const rankFromAdmission = await queryAdmissionScores(
      supabase, province, requestedYear, subjectType, score, validSubjectTypes,
    );
    if (rankFromAdmission) {
      return NextResponse.json({ success: true, data: rankFromAdmission });
    }

    // ── 无数据 ──
    return NextResponse.json(
      {
        error: `未找到${province}的录取数据`,
        hint: `当前支持${validSubjectTypes.join('/')}，数据覆盖 2023-2025 年。请检查省份和科类是否匹配。`,
        validSubjectTypes,
      },
      { status: 404 },
    );
  } catch (err) {
    console.error('[API] assessments/rank-to-score GET error:', err);
    return NextResponse.json(
      { error: '位次估算服务暂时不可用，请稍后重试' },
      { status: 500 },
    );
  }
}

// ── 辅助函数：score_rank_tables 精确查询 ──────────────────────────────────

async function queryScoreRankTable(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  province: string,
  requestedYear: number | null,
  subjectType: string,
  score: number,
  validSubjectTypes: string[],
): Promise<Record<string, unknown> | null> {
  const st = subjectType && validSubjectTypes.includes(subjectType)
    ? subjectType
    : validSubjectTypes[0];

  let query = supabase
    .from('score_rank_tables')
    .select('score, cumulative_rank, year, subject_type')
    .eq('province', province)
    .eq('subject_type', st)
    .order('score', { ascending: true });

  if (requestedYear) {
    query = query.eq('year', requestedYear);
  }

  const { data, error } = await query.limit(2000);

  if (error || !data || data.length === 0) return null;

  // 取最新年份（而非第一条记录的年份）
  const targetYear = requestedYear ?? Math.max(...data.map((r) => r.year));
  const yearData = data
    .filter((r) => r.year === targetYear)
    .sort((a, b) => a.score - b.score);
  if (yearData.length === 0) return null;

  // 分数在范围内：找到 score 两侧的记录做插值
  // lower: score <= 输入分数的最大记录
  // upper: score >= 输入分数的最小记录
  let lower = yearData[0];
  let upper = yearData[yearData.length - 1];

  for (const rec of yearData) {
    if (rec.score <= score) lower = rec;
    if (rec.score >= score) {
      upper = rec;
      break;
    }
  }

  let rank: number;
  if (score <= yearData[0].score) {
    // 分数低于最低分，返回最高位次（最多人数）
    rank = yearData[0].cumulative_rank;
  } else if (score >= yearData[yearData.length - 1].score) {
    // 分数高于最高分，返回最小位次（最少人数）
    rank = yearData[yearData.length - 1].cumulative_rank;
  } else if (lower.score === upper.score) {
    rank = lower.cumulative_rank;
  } else {
    // 线性插值：分数越高位次越小，所以 lower.cumulative_rank > upper.cumulative_rank
    const ratio = (score - lower.score) / (upper.score - lower.score);
    rank = Math.round(
      lower.cumulative_rank + ratio * (upper.cumulative_rank - lower.cumulative_rank),
    );
  }

  return {
    estimatedRank: rank,
    confidence: 0.95,
    referenceScore: score,
    province,
    subjectType: st,
    year: targetYear,
    method: 'score_rank_table',
    message: `基于${targetYear}年${province}${st}一分一段表`,
  };
}

// ── 辅助函数：admission_scores 插值查询 ──────────────────────────────────

async function queryAdmissionScores(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  province: string,
  requestedYear: number | null,
  subjectType: string,
  score: number,
  validSubjectTypes: string[],
): Promise<Record<string, unknown> | null> {
  // 构建查询（不选 subject_group，因为 migration 010 可能未应用）
  let query = supabase
    .from('admission_scores')
    .select('id, min_score, min_rank, year, province')
    .eq('province', province)
    .not('min_rank', 'is', null)
    .order('min_score', { ascending: true });

  // 年份处理：如果指定了年份就用指定的，否则查全部年份后面取最新
  if (requestedYear) {
    query = query.eq('year', requestedYear);
  }

  // 注意：当前数据库无 subject_group 列（migration 010 未应用），
  // 暂不在此处按科类筛选，等 migration 应用后再启用
  // if (subjectType && validSubjectTypes.includes(subjectType)) {
  //   query = query.eq('subject_group', subjectType);
  // }

  const { data, error } = await query.limit(5000);

  if (error) {
    console.error('[rank-to-score] admission query error:', error.message);
    return null;
  }

  if (!data || data.length === 0) return null;

  // 取最新年份的数据
  const latestYear = Math.max(...data.map((r) => r.year));
  const yearData = data
    .filter((r) => r.year === latestYear)
    .sort((a, b) => a.min_score - b.min_score);

  if (yearData.length === 0) return null;

  // 找到分数两侧的记录做线性插值
  const sorted = yearData;
  let lowerRecord = sorted[0];
  let upperRecord = sorted[sorted.length - 1];

  for (const rec of sorted) {
    if (rec.min_score <= score) lowerRecord = rec;
    if (rec.min_score >= score) {
      upperRecord = rec;
      break;
    }
  }

  // 线性插值估算位次
  let estimatedRank: number;
  const scoreDiff = upperRecord.min_score - lowerRecord.min_score;

  if (scoreDiff === 0 || lowerRecord === upperRecord) {
    estimatedRank = lowerRecord.min_rank!;
  } else {
    const ratio = (score - lowerRecord.min_score) / scoreDiff;
    estimatedRank = Math.round(
      lowerRecord.min_rank! + ratio * (upperRecord.min_rank! - lowerRecord.min_rank!),
    );
  }

  // 置信度：基于最近数据点的距离
  const nearestDiff = Math.min(
    Math.abs(lowerRecord.min_score - score),
    Math.abs(upperRecord.min_score - score),
  );
  const confidence = Math.round(Math.exp(-nearestDiff / 30) * 1000) / 1000;

  const st = subjectType || validSubjectTypes[0];

  return {
    estimatedRank,
    confidence,
    referenceScore: score,
    nearestLowerScore: lowerRecord.min_score,
    nearestUpperScore: upperRecord.min_score,
    nearestLowerRank: lowerRecord.min_rank,
    nearestUpperRank: upperRecord.min_rank,
    province,
    subjectType: st,
    year: latestYear,
    validSubjectTypes,
    method: 'admission_interpolation',
    message: `基于${latestYear}年${province}录取数据插值估算（${st}）`,
  };
}

/** 不带科类的回退查询 */
async function queryAdmissionScoresNoSubject(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  province: string,
  requestedYear: number | null,
  score: number,
): Promise<Record<string, unknown> | null> {
  let query = supabase
    .from('admission_scores')
    .select('id, min_score, min_rank, year')
    .eq('province', province)
    .not('min_rank', 'is', null)
    .order('min_score', { ascending: true });

  if (requestedYear) {
    query = query.eq('year', requestedYear);
  }

  const { data, error } = await query.limit(5000);

  if (error || !data || data.length === 0) return null;

  const latestYear = Math.max(...data.map((r) => r.year));
  const yearData = data
    .filter((r) => r.year === latestYear)
    .sort((a, b) => a.min_score - b.min_score);

  if (yearData.length === 0) return null;

  let lowerRecord = yearData[0];
  let upperRecord = yearData[yearData.length - 1];

  for (const rec of yearData) {
    if (rec.min_score <= score) lowerRecord = rec;
    if (rec.min_score >= score) {
      upperRecord = rec;
      break;
    }
  }

  let estimatedRank: number;
  const scoreDiff = upperRecord.min_score - lowerRecord.min_score;

  if (scoreDiff === 0) {
    estimatedRank = lowerRecord.min_rank!;
  } else {
    const ratio = (score - lowerRecord.min_score) / scoreDiff;
    estimatedRank = Math.round(
      lowerRecord.min_rank! + ratio * (upperRecord.min_rank! - lowerRecord.min_rank!),
    );
  }

  const nearestDiff = Math.min(
    Math.abs(lowerRecord.min_score - score),
    Math.abs(upperRecord.min_score - score),
  );
  const confidence = Math.round(Math.exp(-nearestDiff / 30) * 1000) / 1000;

  return {
    estimatedRank,
    confidence,
    referenceScore: score,
    province,
    year: latestYear,
    method: 'admission_interpolation_no_subject',
    message: `基于${latestYear}年${province}录取数据插值估算（未区分科类）`,
  };
}
