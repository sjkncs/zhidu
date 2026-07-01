// @zhidu/db — 录取分数线查询（规则引擎核心）

import { getDb, toCamel } from '../utils';
import type { AdmissionScoreRow, UniversityRow } from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// Admission Scores 录取分数线查询
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 查询录取分数线
 * 支持按院校、专业、省份、年份（单年或多年）筛选
 */
export async function getAdmissionScores(params: {
  universityId?: string;
  majorId?: string;
  province: string;
  year?: number;
  years?: number[];
}): Promise<AdmissionScoreRow[]> {
  const { universityId, majorId, province, year, years } = params;

  try {
    let query = getDb().from('admission_scores')
      .select('*')
      .eq('province', province);

    if (universityId) {
      query = query.eq('university_id', universityId);
    }
    if (majorId) {
      query = query.eq('major_id', majorId);
    }
    if (years && years.length > 0) {
      query = query.in('year', years);
    } else if (year) {
      query = query.eq('year', year);
    }

    query = query.order('year', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[getAdmissionScores] 查询失败:', error.message);
      return [];
    }

    return toCamel<AdmissionScoreRow[]>(data) ?? [];
  } catch (err) {
    console.error('[getAdmissionScores] 异常:', err);
    return [];
  }
}

/**
 * 查询某省份多年内、分数区间内的录取记录
 * 用于筛选符合分数条件的院校
 */
export async function getAdmissionScoreRange(params: {
  province: string;
  years: number[];
  minScore?: number;
  maxScore?: number;
}): Promise<AdmissionScoreRow[]> {
  const { province, years, minScore, maxScore } = params;

  if (!years || years.length === 0) return [];

  try {
    let query = getDb().from('admission_scores')
      .select('*')
      .eq('province', province)
      .in('year', years);

    if (minScore != null) {
      query = query.gte('min_score', minScore);
    }
    if (maxScore != null) {
      query = query.lte('min_score', maxScore);
    }

    query = query.order('min_score', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[getAdmissionScoreRange] 查询失败:', error.message);
      return [];
    }

    return toCamel<AdmissionScoreRow[]>(data) ?? [];
  } catch (err) {
    console.error('[getAdmissionScoreRange] 异常:', err);
    return [];
  }
}

/**
 * 根据考生分数查找候选院校（志愿推荐核心查询）
 *
 * 查询逻辑：
 * 1. 在 admission_scores 表中找到指定省份、年份中，分数线在考生分数 ±offset 范围内的记录
 * 2. 关联 universities 表获取院校详情
 * 3. 支持按院校层次筛选
 *
 * @param params.score    - 考生分数
 * @param params.province - 生源省份
 * @param params.year     - 参考年份
 * @param params.offset   - 分数浮动范围（默认 ±30 分）
 * @param params.tier     - 院校层次筛选（可选）
 * @param params.limit    - 返回数量上限（默认 100）
 */
export async function findCandidatesByScore(params: {
  score: number;
  province: string;
  year: number;
  offset?: number;
  tier?: string;
  limit?: number;
}): Promise<any[]> {
  const {
    score,
    province,
    year,
    offset = 30,
    tier,
    limit = 100,
  } = params;

  const lowerBound = score - offset;
  const upperBound = score + offset;

  try {
    // Join admission_scores with universities via the foreign key relationship.
    // Supabase uses the `!inner` syntax for inner joins on FK columns.
    let query = getDb().from('admission_scores')
      .select(`
        *,
        universities!inner (
          id,
          name,
          province,
          city,
          tier,
          isPublic,
          website,
          logo,
          tags
        )
      `)
      .eq('province', province)
      .eq('year', year)
      .gte('min_score', lowerBound)
      .lte('min_score', upperBound);

    if (tier) {
      query = query.eq('universities.tier', tier as UniversityRow['tier']);
    }

    query = query.order('min_score', { ascending: false }).limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('[findCandidatesByScore] 查询失败:', error.message);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error('[findCandidatesByScore] 异常:', err);
    return [];
  }
}
