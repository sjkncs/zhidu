/**
 * 志愿匹配确定性引擎 — 位次法 + 线差法双模型
 *
 * 核心原则：数据匹配用确定性算法，不用 LLM
 * AI 的角色是意图理解和结果分析，不是数据匹配
 *
 * 参考：高考数据通的架构 — 精准数据匹配 + AI 分析层
 */

import { createClient, type SupabaseClient, type Database } from '@zhidu/db';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VolunteerQuery {
  /** 考生分数 */
  score: number;
  /** 省份 */
  province: string;
  /** 科类：理科/文科/物理类/历史类 */
  subjectType: string;
  /** 年份（当前高考年份） */
  year: number;
  /** 位次（可选，没有则从一分一段表查） */
  rank?: number;
  /** 偏好专业 ID 列表 */
  preferredMajorIds?: string[];
  /** 偏好城市列表 */
  preferredCities?: string[];
  /** 院校层级筛选 */
  tierFilter?: ('985' | '211' | '双一流')[];
  /** 偏好学科评估等级（如 A+, A, A-） */
  preferredDisciplineRatings?: string[];
  /** 仅显示有排名数据的院校 */
  requireRanking?: boolean;
}

export interface MatchResult {
  universityId: string;
  universityName: string;
  majorId: string;
  majorName: string;
  /** 冲/稳/保 */
  tier: 'RUSH' | 'STABLE' | 'SAFE';
  /** 录取概率 0-100 */
  probability: number;
  /** 历年最低录取分 */
  historicalMinScore: number;
  /** 历年最低录取位次 */
  historicalMinRank?: number;
  /** 历年平均录取分 */
  historicalAvgScore?: number;
  /** 等效分（换算到当前年份的等效分数） */
  equivalentScore: number;
  /** 线差（与省控线的差值） */
  lineDiff: number;
  /** 数据置信度 high/medium/low */
  confidence: 'high' | 'medium' | 'low';
  /** 备注（基地班、中外合作等） */
  note?: string;
  /** 就业薪资参考 */
  salaryInfo?: {
    avgSalary?: number;
    medianSalary?: number;
    city?: string;
  };
  /** 院校排名信息 */
  rankingInfo?: {
    bestRank?: number;
    bestRankSource?: string;
    bestRankYear?: number;
  };
  /** 学科评估（匹配专业的学科评级） */
  disciplineRating?: string;
}

export interface VolunteerRecommendation {
  rush: MatchResult[];
  stable: MatchResult[];
  safe: MatchResult[];
  /** 考生信息 */
  query: VolunteerQuery;
  /** 考生位次 */
  rank: number;
  /** 当前年份省控线 */
  currentScoreLine: number;
  /** 数据摘要 */
  summary: {
    totalMatched: number;
    dataYears: number[];
    confidence: string;
  };
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class VolunteerMatchingEngine {
  private db: SupabaseClient<Database>;

  constructor() {
    this.db = createClient();
  }

  /**
   * 主入口：生成冲稳保推荐列表
   */
  async recommend(query: VolunteerQuery): Promise<VolunteerRecommendation> {
    // 1. 获取考生位次
    const rank = query.rank ?? await this.getRank(query);
    if (!rank) {
      throw new Error('无法确定考生位次，请提供位次数据或确保一分一段表已导入');
    }

    // 2. 获取当前年份省控线
    const currentScoreLine = await this.getScoreLine(query);

    // 3. 查询历年录取数据（近 3-5 年）
    const historicalData = await this.getHistoricalAdmissions(query);

    // 4. 对每个院校专业组合计算概率
    const results: MatchResult[] = [];

    for (const record of historicalData) {
      const result = await this.calculateMatch(record, query, rank, currentScoreLine);
      if (result) {
        results.push(result);
      }
    }

    // 5. 冲稳保分层（基于概率阈值）
    const rush = results.filter((r) => r.probability < 40 && r.probability >= 10);
    const stable = results.filter((r) => r.probability >= 40 && r.probability < 75);
    const safe = results.filter((r) => r.probability >= 75);

    // 6. 各层按概率排序（冲从高到低，稳从高到低，保从高到低）
    rush.sort((a, b) => b.probability - a.probability);
    stable.sort((a, b) => b.probability - a.probability);
    safe.sort((a, b) => b.probability - a.probability);

    // 7. 附加就业薪资数据
    await this.enrichWithSalaryData(results);

    // 8. 附加院校排名数据（Phase 16b）
    await this.enrichWithRankingData(results);

    // 9. 附加学科评估数据（Phase 16b）
    await this.enrichWithDisciplineData(results);

    const dataYears = [...new Set(historicalData.map((d) => d.year))];

    return {
      rush: rush.slice(0, 15),
      stable: stable.slice(0, 20),
      safe: safe.slice(0, 15),
      query,
      rank,
      currentScoreLine,
      summary: {
        totalMatched: results.length,
        dataYears,
        confidence: dataYears.length >= 3 ? 'high' : dataYears.length >= 2 ? 'medium' : 'low',
      },
    };
  }

  // ─── 位次法 ────────────────────────────────────────────────────────────────

  /**
   * 位次法：比较考生位次与历年录取位次
   * 核心思想：位次比分数更稳定，不受试卷难度影响
   */
  private rankMethod(
    studentRank: number,
    historicalRanks: number[],
  ): { probability: number; equivalentRank: number } {
    if (historicalRanks.length === 0) {
      return { probability: 0, equivalentRank: 0 };
    }

    // 计算历年录取位次的平均值和中位数
    const sorted = [...historicalRanks].sort((a, b) => a - b);
    const avgRank = historicalRanks.reduce((s, r) => s + r, 0) / historicalRanks.length;
    const medianRank = sorted[Math.floor(sorted.length / 2)];

    // 使用加权平均（近年权重更高）
    const weights = historicalRanks.map((_, i) => i + 1);
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const weightedAvg = historicalRanks.reduce((s, r, i) => s + r * weights[i], 0) / totalWeight;

    // 概率计算：考生位次 vs 加权平均录取位次
    // 位次数字越小越好（第 1 名 > 第 100 名）
    const ratio = studentRank / weightedAvg;

    let probability: number;
    if (ratio <= 0.7) {
      // 位次远优于录取位次 → 高概率
      probability = 90 + (0.7 - ratio) * 20;
      probability = Math.min(probability, 99);
    } else if (ratio <= 1.0) {
      // 位次在录取位次附近 → 中高概率
      probability = 60 + (1.0 - ratio) * 100;
    } else if (ratio <= 1.3) {
      // 位次略差于录取位次 → 冲一冲
      probability = 20 + (1.3 - ratio) * 133;
    } else if (ratio <= 1.8) {
      // 位次较差 → 低概率冲刺
      probability = Math.max(5, 20 - (ratio - 1.3) * 30);
    } else {
      probability = 3;
    }

    return {
      probability: Math.round(Math.max(1, Math.min(99, probability))),
      equivalentRank: Math.round(weightedAvg),
    };
  }

  // ─── 线差法 ────────────────────────────────────────────────────────────────

  /**
   * 线差法：比较考生与省控线的分差
   * 核心思想：消除不同年份试卷难度差异的影响
   */
  private lineDiffMethod(
    studentScore: number,
    currentScoreLine: number,
    historicalScores: Array<{ score: number; scoreLine: number }>,
  ): { probability: number; equivalentScore: number } {
    if (historicalScores.length === 0 || currentScoreLine === 0) {
      return { probability: 0, equivalentScore: studentScore };
    }

    // 考生线差
    const studentLineDiff = studentScore - currentScoreLine;

    // 历年录取线差
    const historicalLineDiffs = historicalScores.map(
      (h) => h.score - h.scoreLine,
    );

    // 加权平均历年线差（近年权重更高）
    const weights = historicalLineDiffs.map((_, i) => i + 1);
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    const avgHistoricalLineDiff = historicalLineDiffs.reduce(
      (s, d, i) => s + d * weights[i], 0,
    ) / totalWeight;

    // 等效分 = 当前省控线 + 历年平均线差
    const equivalentScore = currentScoreLine + avgHistoricalLineDiff;

    // 概率计算：考生线差 vs 历年平均录取线差
    const lineDiffGap = studentLineDiff - avgHistoricalLineDiff;

    let probability: number;
    if (lineDiffGap >= 20) {
      probability = 92;
    } else if (lineDiffGap >= 10) {
      probability = 75 + (lineDiffGap - 10) * 1.7;
    } else if (lineDiffGap >= 0) {
      probability = 55 + lineDiffGap * 2;
    } else if (lineDiffGap >= -10) {
      probability = 30 + (lineDiffGap + 10) * 2.5;
    } else if (lineDiffGap >= -20) {
      probability = 10 + (lineDiffGap + 20) * 2;
    } else {
      probability = 5;
    }

    return {
      probability: Math.round(Math.max(1, Math.min(99, probability))),
      equivalentScore: Math.round(equivalentScore),
    };
  }

  // ─── 综合计算 ──────────────────────────────────────────────────────────────

  /**
   * 综合位次法和线差法的结果
   */
  private async calculateMatch(
    record: HistoricalRecord,
    query: VolunteerQuery,
    studentRank: number,
    currentScoreLine: number,
  ): Promise<MatchResult | null> {
    const historicalRanks = record.ranks.filter((r) => r != null) as number[];
    const historicalScores = record.scores.map((s, i) => ({
      score: s.minScore,
      scoreLine: record.scoreLines[i] ?? currentScoreLine,
    }));

    // 位次法
    const rankResult = this.rankMethod(studentRank, historicalRanks);

    // 线差法
    const lineResult = this.lineDiffMethod(
      query.score,
      currentScoreLine,
      historicalScores,
    );

    // 综合概率（位次法权重 60%，线差法权重 40%）
    // 位次法更稳定，线差法作为辅助验证
    let combinedProbability: number;
    if (historicalRanks.length > 0) {
      combinedProbability = rankResult.probability * 0.6 + lineResult.probability * 0.4;
    } else {
      // 没有位次数据时只用线差法（降低置信度）
      combinedProbability = lineResult.probability;
    }

    combinedProbability = Math.round(Math.max(1, Math.min(99, combinedProbability)));

    // 冲稳保分层
    let tier: 'RUSH' | 'STABLE' | 'SAFE';
    if (combinedProbability >= 75) tier = 'SAFE';
    else if (combinedProbability >= 40) tier = 'STABLE';
    else tier = 'RUSH';

    // 数据置信度
    let confidence: 'high' | 'medium' | 'low';
    if (record.scores.length >= 3 && historicalRanks.length >= 2) confidence = 'high';
    else if (record.scores.length >= 2) confidence = 'medium';
    else confidence = 'low';

    const minScore = Math.min(...record.scores.map((s) => s.minScore));
    const avgScore = record.scores.reduce((s, r) => s + (r.avgScore ?? r.minScore), 0) / record.scores.length;
    const minRank = historicalRanks.length > 0 ? Math.max(...historicalRanks) : undefined;

    return {
      universityId: record.universityId,
      universityName: record.universityName,
      majorId: record.majorId,
      majorName: record.majorName,
      tier,
      probability: combinedProbability,
      historicalMinScore: minScore,
      historicalAvgScore: Math.round(avgScore),
      historicalMinRank: minRank,
      equivalentScore: lineResult.equivalentScore,
      lineDiff: query.score - currentScoreLine,
      confidence,
      note: record.note,
    };
  }

  // ─── 数据查询层 ────────────────────────────────────────────────────────────

  /** 从一分一段表获取分数对应位次 */
  private async getRank(query: VolunteerQuery): Promise<number | null> {
    const { data } = await this.db
      .from('score_rank_tables')
      .select('cumulative_rank')
      .eq('province', query.province)
      .eq('year', query.year)
      .eq('subject_type', query.subjectType)
      .eq('score', query.score)
      .single();
    return data?.cumulative_rank ?? null;
  }

  /** 获取当前年份省控线 */
  private async getScoreLine(query: VolunteerQuery): Promise<number> {
    const { data } = await this.db
      .from('province_score_lines')
      .select('score_line')
      .eq('province', query.province)
      .eq('year', query.year)
      .eq('subject_type', query.subjectType)
      .order('batch', { ascending: true })
      .limit(1)
      .single();
    return data?.score_line ?? 0;
  }

  /** 查询历年录取数据 */
  private async getHistoricalAdmissions(query: VolunteerQuery): Promise<HistoricalRecord[]> {
    const startYear = query.year - 4; // 近 5 年

    let scoreQuery = this.db
      .from('admission_scores')
      .select(`
        *,
        universities:university_id (id, name, province, city, tier),
        majors:major_id (id, name, category)
      `)
      .eq('province', query.province)
      .gte('year', startYear)
      .lt('year', query.year);

    // 专业筛选
    if (query.preferredMajorIds && query.preferredMajorIds.length > 0) {
      scoreQuery = scoreQuery.in('major_id', query.preferredMajorIds);
    }

    const { data, error } = await scoreQuery;
    if (error || !data) return [];

    // 按院校+专业聚合
    const grouped = new Map<string, HistoricalRecord>();

    for (const row of data) {
      const key = `${row.university_id}_${row.major_id ?? 'all'}`;
      const uni = (row as any).universities;
      const major = (row as any).majors;

      // 城市筛选
      if (query.preferredCities && query.preferredCities.length > 0) {
        if (!query.preferredCities.includes(uni?.city)) continue;
      }

      // 层级筛选
      if (query.tierFilter && query.tierFilter.length > 0) {
        if (!query.tierFilter.includes(uni?.tier)) continue;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          universityId: row.university_id,
          universityName: uni?.name ?? '未知',
          majorId: row.major_id ?? '',
          majorName: major?.name ?? '未分专业',
          scores: [],
          ranks: [],
          scoreLines: [],
          note: (row as any).note,
        });
      }

      const record = grouped.get(key)!;
      record.scores.push({
        year: row.year,
        minScore: row.min_score,
        avgScore: row.avg_score ?? undefined,
      });
      record.ranks.push(row.min_rank);
    }

    // 按年份排序
    for (const record of grouped.values()) {
      const sorted = record.scores
        .map((s, i) => ({ score: s, rank: record.ranks[i] }))
        .sort((a, b) => a.score.year - b.score.year);
      record.scores = sorted.map((s) => s.score);
      record.ranks = sorted.map((s) => s.rank);
    }

    // 获取省控线数据
    const { data: scoreLines } = await this.db
      .from('province_score_lines')
      .select('year, score_line')
      .eq('province', query.province)
      .eq('subject_type', query.subjectType)
      .gte('year', startYear)
      .lt('year', query.year);

    const scoreLineMap = new Map(
      (scoreLines ?? []).map((s: any) => [s.year, s.score_line]),
    );

    for (const record of grouped.values()) {
      record.scoreLines = record.scores.map(
        (s) => scoreLineMap.get(s.year) ?? 0,
      );
    }

    return [...grouped.values()];
  }

  /** 附加就业薪资数据 */
  private async enrichWithSalaryData(results: MatchResult[]): Promise<void> {
    if (results.length === 0) return;

    const majorIds = [...new Set(results.map((r) => r.majorId).filter(Boolean))];
    if (majorIds.length === 0) return;

    const { data } = await this.db
      .from('employment_salaries')
      .select('major_id, avg_salary, median_salary, city')
      .in('major_id', majorIds)
      .order('data_year', { ascending: false });

    if (!data) return;

    const salaryMap = new Map<string, { avgSalary?: number; medianSalary?: number; city?: string }>();
    for (const row of data) {
      if (!salaryMap.has(row.major_id!)) {
        salaryMap.set(row.major_id!, {
          avgSalary: row.avg_salary ?? undefined,
          medianSalary: row.median_salary ?? undefined,
          city: row.city ?? undefined,
        });
      }
    }

    for (const result of results) {
      const salary = salaryMap.get(result.majorId);
      if (salary) {
        result.salaryInfo = salary;
      }
    }
  }

  /** 附加院校排名数据 */
  private async enrichWithRankingData(results: MatchResult[]): Promise<void> {
    if (results.length === 0) return;

    const uniIds = [...new Set(results.map((r) => r.universityId).filter(Boolean))];
    if (uniIds.length === 0) return;

    const { data } = await this.db
      .from('university_rankings')
      .select('university_id, source, year, rank')
      .in('university_id', uniIds)
      .not('rank', 'is', null)
      .order('rank', { ascending: true });

    if (!data) return;

    // 按院校取最佳排名
    const rankMap = new Map<string, { bestRank: number; bestRankSource: string; bestRankYear: number }>();
    for (const row of data) {
      const key = row.university_id!;
      const existing = rankMap.get(key);
      if (!existing || (row.rank! < existing.bestRank)) {
        rankMap.set(key, {
          bestRank: row.rank!,
          bestRankSource: row.source,
          bestRankYear: row.year,
        });
      }
    }

    for (const result of results) {
      const rank = rankMap.get(result.universityId);
      if (rank) {
        result.rankingInfo = rank;
      }
    }
  }

  /** 附加学科评估数据 */
  private async enrichWithDisciplineData(results: MatchResult[]): Promise<void> {
    if (results.length === 0) return;

    const uniIds = [...new Set(results.map((r) => r.universityId).filter(Boolean))];
    if (uniIds.length === 0) return;

    const { data } = await this.db
      .from('discipline_evaluations')
      .select('university_id, discipline_name, rating')
      .in('university_id', uniIds);

    if (!data) return;

    // 按院校聚合最佳评级
    const ratingOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'];
    const evalMap = new Map<string, string>();
    for (const row of data) {
      const key = row.university_id!;
      const existing = evalMap.get(key);
      if (!existing || ratingOrder.indexOf(row.rating) < ratingOrder.indexOf(existing)) {
        evalMap.set(key, row.rating);
      }
    }

    for (const result of results) {
      const rating = evalMap.get(result.universityId);
      if (rating) {
        result.disciplineRating = rating;
      }
    }
  }
}

// ─── Internal types ─────────────────────────────────────────────────────────

interface HistoricalRecord {
  universityId: string;
  universityName: string;
  majorId: string;
  majorName: string;
  scores: Array<{ year: number; minScore: number; avgScore?: number }>;
  ranks: Array<number | null>;
  scoreLines: number[];
  note?: string;
}
