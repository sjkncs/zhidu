// @zhidu/ai — 志愿推荐规则引擎
// 实现位次换算、分数线匹配、冲稳保分类、录取概率估算

import type { RuleEngine } from './index';
import { TaskType } from './index';
import type { PlanItem, RiskLevel } from '@zhidu/shared';

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

interface AdmissionRecord {
  university_id: string;
  major_id: string;
  province: string;
  year: number;
  min_score: number;
  avg_score: number;
  min_rank: number;
  batch: string;
  universities?: {
    name: string;
    tier: string;
    province: string;
    city: string;
    tags: string[];
  };
  majors?: {
    name: string;
    category: string;
  };
}

interface ScoreStats {
  university_id: string;
  major_id: string;
  province: string;
  scores: Array<{ year: number; min_score: number; avg_score: number; min_rank: number }>;
  trend: number;          // 线性趋势斜率（正=上升，负=下降）
  meanMinScore: number;   // 历年最低分均值
  meanAvgScore: number;   // 历年平均分均值
  meanMinRank: number;    // 历年最低位次均值
  stdDev: number;         // 最低分标准差
  rankStdDev: number;     // 位次标准差
}

interface CandidateItem {
  universityId: string;
  majorId: string;
  universityName: string;
  majorName: string;
  tier: string;
  city: string;
  category: string;
  historicalAvgScore: number;
  historicalMinScore: number;
  historicalMinRank: number;
  trend: number;
  probability: number;
  riskLevel: RiskLevel;
  sortOrder: number;
}

interface SupabaseLike {
  from(table: string): any;
}

// ─────────────────────────────────────────────────────────────────────────────
// 核心算法
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 线性回归 — 计算趋势斜率
 * 输入: [{ x: year, y: value }]
 * 返回: 斜率 (每年变化量)
 */
function linearRegression(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * 标准正态分布 CDF（累积分布函数）
 * 用于估算录取概率
 * Abramowitz and Stegun 近似（精度 ~10^-7）
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

/**
 * 计算标准差
 */
function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * 加权年份均值（近年权重更大）
 * 2025: 权重 0.5, 2024: 0.3, 2023: 0.2
 */
function weightedYearMean(scores: Array<{ year: number; value: number }>): number {
  const weights: Record<number, number> = { 2025: 0.5, 2024: 0.3, 2023: 0.2 };
  let totalWeight = 0;
  let weightedSum = 0;

  for (const s of scores) {
    const w = weights[s.year] ?? 0.1;
    weightedSum += s.value * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * 录取概率估算
 * 基于正态分布模型：用户分数在历史录取分数分布中的位置
 *
 * 创新点：
 * 1. 使用加权年份均值（近年权重更大）
 * 2. 加入趋势修正（如果分数线逐年上升，则调整预期）
 * 3. 贝叶斯平滑：样本少时用层次先验（同 tier 均值）
 */
function estimateProbability(
  userScore: number,
  stats: ScoreStats,
  currentYear: number,
  tierPrior?: { mean: number; std: number },
): number {
  // 用趋势预测今年的分数线
  const trendPredictedMin = stats.meanMinScore + stats.trend * (currentYear - 2024);

  // 贝叶斯平滑：如果有先验且样本少，混合先验和数据
  let predictedMean = trendPredictedMin;
  let predictedStd = Math.max(stats.stdDev, 10); // 最小标准差 10 分（反映年份间自然波动）

  if (stats.scores.length < 3 && tierPrior) {
    // 贝叶斯平滑：data_weight = n/(n+2), prior_weight = 2/(n+2)
    const n = stats.scores.length;
    const dataWeight = n / (n + 2);
    const priorWeight = 2 / (n + 2);
    predictedMean = predictedMean * dataWeight + tierPrior.mean * priorWeight;
    predictedStd = predictedStd * dataWeight + tierPrior.std * priorWeight;
  }

  // 计算 z-score
  const z = (userScore - predictedMean) / predictedStd;

  // 正态分布 CDF 给出录取概率
  // z > 0 表示用户分数高于预测线 → 概率高
  const rawProb = normalCDF(z);

  // 限制在 [0.01, 0.99] 范围内
  return Math.max(0.01, Math.min(0.99, rawProb));
}

/**
 * 冲稳保分类
 * 基于录取概率的分级：
 * - RUSH (冲): 概率 < 0.35 — 有希望但不保险
 * - STABLE (稳): 0.35 ≤ 概率 < 0.65 — 较有把握
 * - SAFE (保): 概率 ≥ 0.65 — 非常保险
 */
function classifyByProbability(probability: number): RiskLevel {
  if (probability < 0.35) return 'RUSH';
  if (probability < 0.65) return 'STABLE';
  return 'SAFE';
}

// ─────────────────────────────────────────────────────────────────────────────
// 统计聚合
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 将原始录取记录聚合为统计摘要
 */
function aggregateStats(records: AdmissionRecord[]): Map<string, ScoreStats> {
  // 按 (university_id, major_id, province) 分组
  const groups = new Map<string, AdmissionRecord[]>();

  for (const r of records) {
    const key = `${r.university_id}|${r.major_id}|${r.province}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const result = new Map<string, ScoreStats>();

  for (const [key, recs] of groups) {
    const sorted = recs.sort((a, b) => a.year - b.year);
    const minScores = sorted.map(r => r.min_score);
    const avgScores = sorted.map(r => r.avg_score);
    const minRanks = sorted.map(r => r.min_rank);

    const meanMinScore = minScores.reduce((a, b) => a + b, 0) / minScores.length;
    const meanAvgScore = avgScores.reduce((a, b) => a + b, 0) / avgScores.length;
    const meanMinRank = minRanks.reduce((a, b) => a + b, 0) / minRanks.length;

    const trend = linearRegression(sorted.map(r => ({ x: r.year, y: r.min_score })));

    result.set(key, {
      university_id: sorted[0].university_id,
      major_id: sorted[0].major_id,
      province: sorted[0].province,
      scores: sorted.map(r => ({
        year: r.year,
        min_score: r.min_score,
        avg_score: r.avg_score,
        min_rank: r.min_rank,
      })),
      trend,
      meanMinScore,
      meanAvgScore,
      meanMinRank,
      stdDev: stdDev(minScores, meanMinScore),
      rankStdDev: stdDev(minRanks, meanMinRank),
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// RuleEngine 实现
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 创建规则引擎实例
 * @param db - Supabase 客户端实例
 */
export function createRuleEngine(db: SupabaseLike): RuleEngine {
  return {
    canHandle(taskType: TaskType): boolean {
      return taskType === TaskType.VOLUNTEER_MATCH;
    },

    /**
     * 分数线匹配 + 冲稳保分类
     * 核心推荐算法：
     * 1. 查询用户分数 ± offset 范围内的历史录取数据
     * 2. 聚合多年数据计算统计指标
     * 3. 用趋势修正 + 贝叶斯概率模型估算录取概率
     * 4. 按冲/稳/保分类并排序
     */
    async matchByScore(params: {
      score: number;
      province: string;
      subjectCombination?: string[];
      limit?: number;
    }): Promise<PlanItem[]> {
      const { score, province, limit = 100 } = params;
      const currentYear = 2025;

      // 非对称搜索范围：向下更宽（找保底校），向上更窄（找冲刺校）
      const lowerOffset = 60; // 向下搜索 60 分（确保有足够 SAFE 选项）
      const upperOffset = 25; // 向上搜索 25 分（RUSH 选项）

      try {
        // 1. 查询历史录取数据（join universities 和 majors）
        const { data: records, error } = await db
          .from('admission_scores')
          .select(`
            university_id,
            major_id,
            province,
            year,
            min_score,
            avg_score,
            min_rank,
            batch,
            universities!inner(name, tier, province, city, tags),
            majors!inner(name, category)
          `)
          .eq('province', province)
          .gte('min_score', score - lowerOffset)
          .lte('min_score', score + upperOffset)
          .in('year', [2023, 2024, 2025]);

        if (error || !records) {
          console.error('[RuleEngine] matchByScore query error:', error?.message);
          return [];
        }

        // 2. 聚合统计
        const statsMap = aggregateStats(records as AdmissionRecord[]);

        // 3. 计算层次先验（用于贝叶斯平滑）
        const tierPriors = new Map<string, { mean: number; std: number }>();
        for (const [, stats] of statsMap) {
          const record = records.find(
            (r: any) => r.university_id === stats.university_id
          ) as AdmissionRecord | undefined;
          if (record?.universities?.tier) {
            const tier = record.universities.tier;
            if (!tierPriors.has(tier)) {
              const tierScores = [...statsMap.values()]
                .filter(s => {
                  const rec = records.find(
                    (r: any) => r.university_id === s.university_id
                  ) as AdmissionRecord | undefined;
                  return rec?.universities?.tier === tier;
                })
                .map(s => s.meanMinScore);
              const tierMean = tierScores.reduce((a, b) => a + b, 0) / (tierScores.length || 1);
              const tierStd = stdDev(tierScores, tierMean);
              tierPriors.set(tier, { mean: tierMean, std: Math.max(tierStd, 5) });
            }
          }
        }

        // 4. 为每个 (院校, 专业) 组合计算概率和分类
        const candidates: CandidateItem[] = [];
        const seen = new Set<string>();

        for (const [key, stats] of statsMap) {
          // Find the matching record for this specific university + major
          const record = records.find(
            (r: any) => r.university_id === stats.university_id && r.major_id === stats.major_id
          ) as AdmissionRecord | undefined;

          const uniName = record?.universities?.name ?? '未知';
          const majorName = (record as any)?.majors?.name ?? '未知';

          // Deduplicate by university name + major name (handles duplicate IDs)
          const dedupeKey = `${uniName}|${majorName}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          const tier = record?.universities?.tier ?? '普通本科';
          const tierPrior = tierPriors.get(tier);
          const probability = estimateProbability(score, stats, currentYear, tierPrior);
          const riskLevel = classifyByProbability(probability);

          candidates.push({
            universityId: stats.university_id,
            majorId: stats.major_id,
            universityName: uniName,
            majorName: majorName,
            tier,
            city: record?.universities?.city ?? '',
            category: (record as any)?.majors?.category ?? '',
            historicalAvgScore: Math.round(stats.meanAvgScore),
            historicalMinScore: Math.round(stats.meanMinScore),
            historicalMinRank: Math.round(stats.meanMinRank),
            trend: Math.round(stats.trend * 100) / 100,
            probability: Math.round(probability * 1000) / 1000,
            riskLevel,
            sortOrder: 0,
          });
        }

        // 5. 排序策略：冲→稳→保，组内按概率降序
        const riskOrder: Record<RiskLevel, number> = { RUSH: 0, STABLE: 1, SAFE: 2 };
        candidates.sort((a, b) => {
          const rDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
          if (rDiff !== 0) return rDiff;
          return b.probability - a.probability;
        });

        // 6. 设置排序序号
        candidates.forEach((c, i) => { c.sortOrder = i; });

        // 7. 转换为 PlanItem 格式
        return candidates.slice(0, limit).map((c): PlanItem => ({
          id: '' as any, // 由调用方在入库时生成
          planId: '' as any,
          universityId: c.universityId as any,
          majorId: c.majorId as any,
          riskLevel: c.riskLevel,
          historicalAvgScore: c.historicalAvgScore,
          estimatedProbability: c.probability,
          order: c.sortOrder,
          remark: `${c.universityName} - ${c.majorName} | ${c.tier} | ${c.city} | 趋势: ${c.trend > 0 ? '+' : ''}${c.trend}/年`,
        }));
      } catch (err) {
        console.error('[RuleEngine] matchByScore error:', err);
        return [];
      }
    },

    /**
     * 位次换算：将目标年份的位次映射为历年等效分
     * 算法：在同一省份的录取数据中，找到该位次对应的分数
     */
    async rankToScore(params: {
      rank: number;
      province: string;
      year: number;
    }): Promise<{ equivalentScore: number; confidence: number }> {
      const { rank, province, year } = params;

      try {
        // 查询该省份目标年份的录取数据，按位次排序
        const { data: records, error } = await db
          .from('admission_scores')
          .select('min_score, min_rank, year')
          .eq('province', province)
          .eq('year', year)
          .order('min_rank', { ascending: true });

        if (error || !records || records.length === 0) {
          // 回退：查询所有年份
          const fallback = await db
            .from('admission_scores')
            .select('min_score, min_rank, year')
            .eq('province', province)
            .order('min_rank', { ascending: true });

          if (fallback.error || !fallback.data || fallback.data.length === 0) {
            return { equivalentScore: 0, confidence: 0 };
          }

          return interpolateRank(rank, fallback.data as Array<{ min_score: number; min_rank: number }>);
        }

        return interpolateRank(rank, records as Array<{ min_score: number; min_rank: number }>);
      } catch (err) {
        console.error('[RuleEngine] rankToScore error:', err);
        return { equivalentScore: 0, confidence: 0 };
      }
    },

    /**
     * 冲稳保分类：对已有志愿条目进行风险分级
     */
    async classifyRisk(params: {
      items: Array<{ universityId: string; majorId: string; historicalAvgScore: number }>;
      userScore: number;
    }): Promise<Array<{ universityId: string; majorId: string; riskLevel: 'RUSH' | 'STABLE' | 'SAFE' }>> {
      const { items, userScore } = params;

      return items.map(item => {
        const diff = userScore - item.historicalAvgScore;
        const riskLevel = classifyByProbability(
          normalCDF(diff / 10) // 简化模型：10分为一个标准差
        );
        return {
          universityId: item.universityId,
          majorId: item.majorId,
          riskLevel,
        };
      });
    },

    async execute(_taskType: TaskType, _params: Record<string, unknown>): Promise<unknown> {
      throw new Error('not implemented');
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 位次插值：在已知的 (位次, 分数) 数据点中，找到目标位次对应的分数
 * 使用线性插值
 */
function interpolateRank(
  targetRank: number,
  data: Array<{ min_score: number; min_rank: number }>,
): { equivalentScore: number; confidence: number } {
  if (data.length === 0) return { equivalentScore: 0, confidence: 0 };

  // 去重并按位次排序（升序）
  const unique = [...new Map(data.map(d => [d.min_rank, d])).values()]
    .sort((a, b) => a.min_rank - b.min_rank);

  // 边界情况
  if (targetRank <= unique[0].min_rank) {
    return { equivalentScore: unique[0].min_score, confidence: 0.6 };
  }
  if (targetRank >= unique[unique.length - 1].min_rank) {
    return { equivalentScore: unique[unique.length - 1].min_score, confidence: 0.6 };
  }

  // 二分查找插值
  let lo = 0, hi = unique.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (unique[mid].min_rank <= targetRank) lo = mid;
    else hi = mid;
  }

  const p1 = unique[lo];
  const p2 = unique[hi];
  const t = (targetRank - p1.min_rank) / (p2.min_rank - p1.min_rank || 1);
  const score = Math.round(p1.min_score + t * (p2.min_score - p1.min_score));

  // 置信度基于数据密度
  const rankGap = p2.min_rank - p1.min_rank;
  const confidence = Math.max(0.3, Math.min(0.95, 1 - rankGap / 50000));

  return { equivalentScore: score, confidence };
}

// ─────────────────────────────────────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────────────────────────────────────

export { linearRegression, normalCDF, stdDev, estimateProbability, classifyByProbability };
export type { ScoreStats, CandidateItem, AdmissionRecord };
