// @zhidu/ai — Supabase 实现的结构化查询执行器
// 直接查询 Supabase 数据库，支撑 StructuredQueryAgent 的数据需求

import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueryExecutor } from './structured-query-agent';

export class SupabaseQueryExecutor implements QueryExecutor {
  /** 字符串清理：移除可能影响 ilike 的特殊字符 */
  private sanitize(input: string): string {
    return input.replace(/[%_\\]/g, '').trim().slice(0, 100);
  }

  /** 限制 limit 在合理范围内 */
  private clampLimit(limit: number | undefined, max: number = 50): number {
    return Math.min(Math.max(limit ?? 20, 1), max);
  }

  constructor(private readonly db: SupabaseClient) {}

  /** 按分数/位次搜索院校 */
  async searchUniversities(params: {
    province: string;
    year: number;
    minScore?: number;
    maxScore?: number;
    tier?: string;
    limit?: number;
  }): Promise<unknown[]> {
    const { province, year, minScore, maxScore, tier } = params;
    const limit = this.clampLimit(params.limit);

    let query = this.db
      .from('admission_scores')
      .select(`
        university_id,
        min_score,
        avg_score,
        min_rank,
        universities!inner (id, name, province, city, tier, is_985, is_211, school_type)
      `)
      .eq('province', province)
      .eq('year', year);

    if (minScore) query = query.gte('min_score', minScore);
    if (maxScore) query = query.lte('min_score', maxScore);
    if (tier) query = query.eq('universities.tier', tier);

    query = query.order('min_score', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error('[SupabaseExecutor] searchUniversities:', error.message);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      universityId: row.university_id,
      universityName: row.universities?.name,
      province: row.universities?.province,
      city: row.universities?.city,
      tier: row.universities?.tier,
      is985: row.universities?.is_985,
      is211: row.universities?.is_211,
      schoolType: row.universities?.school_type,
      minScore: row.min_score,
      avgScore: row.avg_score,
      minRank: row.min_rank,
    }));
  }

  /** 查询院校详情（含排名、学科评估） */
  async getUniversityInfo(params: {
    universityName?: string;
    universityId?: string;
    province?: string;
    tier?: string;
    limit?: number;
  }): Promise<unknown[]> {
    const { province, tier } = params;
    const limit = this.clampLimit(params.limit, 50);
    const universityName = params.universityName ? this.sanitize(params.universityName) : undefined;
    const universityId = params.universityId?.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36);

    let query = this.db
      .from('universities')
      .select('*');

    if (universityId) {
      query = query.eq('id', universityId);
    } else if (universityName) {
      query = query.ilike('name', `%${universityName}%`);
    }
    if (province) query = query.eq('province', province);
    if (tier) query = query.eq('tier', tier);

    query = query.limit(limit);

    const { data: universities, error } = await query;
    if (error || !universities?.length) {
      console.error('[SupabaseExecutor] getUniversityInfo:', error?.message);
      return [];
    }

    // 批量查询排名和学科评估
    const uniIds = universities.map((u: any) => u.id);

    const [rankRes, evalRes] = await Promise.all([
      this.db
        .from('university_rankings')
        .select('*')
        .in('university_id', uniIds)
        .order('year', { ascending: false })
        .limit(50),
      this.db
        .from('discipline_evaluations')
        .select('*')
        .in('university_id', uniIds)
        .order('rating', { ascending: true })
        .limit(100),
    ]);

    // 按院校聚合
    const rankingsByUni = new Map<string, unknown[]>();
    for (const r of rankRes.data ?? []) {
      const key = r.university_id ?? '';
      if (!rankingsByUni.has(key)) rankingsByUni.set(key, []);
      rankingsByUni.get(key)!.push(r);
    }

    const evalsByUni = new Map<string, unknown[]>();
    for (const e of evalRes.data ?? []) {
      const key = e.university_id ?? '';
      if (!evalsByUni.has(key)) evalsByUni.set(key, []);
      evalsByUni.get(key)!.push(e);
    }

    return universities.map((u: any) => ({
      ...u,
      rankings: rankingsByUni.get(u.id) ?? [],
      disciplineEvaluations: evalsByUni.get(u.id) ?? [],
    }));
  }

  /** 查询专业详情（含薪资、开设院校） */
  async getMajorInfo(params: {
    majorName?: string;
    majorId?: string;
    category?: string;
    limit?: number;
  }): Promise<unknown[]> {
    const { category } = params;
    const limit = this.clampLimit(params.limit, 20);
    const majorName = params.majorName ? this.sanitize(params.majorName) : undefined;
    const majorId = params.majorId?.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36);

    let query = this.db.from('majors').select('*');

    if (majorId) {
      query = query.eq('id', majorId);
    } else if (majorName) {
      query = query.ilike('name', `%${majorName}%`);
    }
    if (category) query = query.eq('category', category);

    query = query.limit(limit);

    const { data: majors, error } = await query;
    if (error || !majors?.length) {
      console.error('[SupabaseExecutor] getMajorInfo:', error?.message);
      return [];
    }

    const majorIds = majors.map((m: any) => m.id);

    // 批量查询薪资数据
    const salaryRes = await this.db
      .from('major_salary_data')
      .select('*')
      .in('major_id', majorIds)
      .order('year', { ascending: false })
      .limit(30);

    const salaryByMajor = new Map<string, unknown[]>();
    for (const s of salaryRes.data ?? []) {
      const key = s.major_id ?? '';
      if (!salaryByMajor.has(key)) salaryByMajor.set(key, []);
      salaryByMajor.get(key)!.push(s);
    }

    return majors.map((m: any) => ({
      ...m,
      salaryData: salaryByMajor.get(m.id) ?? [],
    }));
  }

  /** 获取院校历年分数线 */
  async getScoreHistory(params: {
    universityId?: string;
    universityName?: string;
    majorId?: string;
    province: string;
    years?: number[];
  }): Promise<unknown[]> {
    const { province, years } = params;
    const universityName = params.universityName ? this.sanitize(params.universityName) : undefined;
    const universityId = params.universityId?.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36);
    const majorId = params.majorId?.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36);

    let query = this.db
      .from('admission_scores')
      .select('*, universities!inner(name)')
      .eq('province', province);

    if (universityId) {
      query = query.eq('university_id', universityId);
    } else if (universityName) {
      query = query.ilike('universities.name', `%${universityName}%`);
    }
    if (majorId) query = query.eq('major_id', majorId);
    if (years?.length) query = query.in('year', years.slice(0, 10));

    query = query.order('year', { ascending: false }).limit(30);

    const { data, error } = await query;
    if (error) {
      console.error('[SupabaseExecutor] getScoreHistory:', error.message);
      return [];
    }
    return data ?? [];
  }

  /** 位次估算 */
  async estimateRank(params: {
    score: number;
    province: string;
    year?: number;
  }): Promise<{ estimatedRank: number | null; confidence: number }> {
    const { score, province, year } = params;
    const targetYear = year ?? new Date().getFullYear() - 1;

    const { data, error } = await this.db
      .from('score_rank_tables')
      .select('*')
      .eq('province', province)
      .eq('year', targetYear)
      .eq('score', score)
      .maybeSingle();

    if (error || !data) {
      // 尝试插值：找最近的高低分
      const { data: nearby } = await this.db
        .from('score_rank_tables')
        .select('score, cumulative_rank')
        .eq('province', province)
        .eq('year', targetYear)
        .gte('score', score - 5)
        .lte('score', score + 5)
        .order('score', { ascending: true })
        .limit(11);

      if (nearby && nearby.length >= 2) {
        const below = nearby.filter((r: any) => r.score <= score).pop();
        const above = nearby.find((r: any) => r.score >= score);
        if (below && above) {
          const ratio = above.score === below.score
            ? 0.5
            : (score - below.score) / (above.score - below.score);
          const estRank = Math.round(
            below.cumulative_rank + ratio * (above.cumulative_rank - below.cumulative_rank),
          );
          return { estimatedRank: estRank, confidence: 0.7 };
        }
      }

      return { estimatedRank: null, confidence: 0 };
    }

    return { estimatedRank: data.cumulative_rank, confidence: 0.95 };
  }

  /** 专业推荐 */
  async recommendMajors(params: {
    province?: string;
    score?: number;
    category?: string;
    limit?: number;
  }): Promise<unknown[]> {
    const { category } = params;
    const limit = this.clampLimit(params.limit, 50);

    let query = this.db
      .from('majors')
      .select('id, name, category, degree, duration, employment_rate, description');

    if (category) query = query.eq('category', category);
    query = query.order('employment_rate', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error('[SupabaseExecutor] recommendMajors:', error.message);
      return [];
    }
    return data ?? [];
  }

  /** 职业薪资查询 */
  async getCareerSalary(params: {
    majorName?: string;
    careerField?: string;
    limit?: number;
  }): Promise<unknown[]> {
    const limit = this.clampLimit(params.limit, 20);
    const majorName = params.majorName ? this.sanitize(params.majorName) : undefined;

    let query = this.db
      .from('major_salary_data')
      .select('*, majors!inner(id, name, category, degree)')
      .order('year', { ascending: false });

    if (majorName) {
      query = query.ilike('majors.name', `%${majorName}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error('[SupabaseExecutor] getCareerSalary:', error.message);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      majorName: row.majors?.name,
      category: row.majors?.category,
      year: row.year,
      avgSalary: row.avg_salary,
      medianSalary: row.median_salary,
      employmentRate: row.employment_rate,
      satisfactionRate: row.satisfaction_rate,
    }));
  }

  /** 录取统计：按省份/层次汇总分数线数据 */
  async getAdmissionStats(params: {
    province: string;
    year?: number;
    tier?: string;
    limit?: number;
  }): Promise<unknown[]> {
    const { province, tier } = params;
    const year = params.year ?? new Date().getFullYear() - 1;
    const limit = this.clampLimit(params.limit, 30);

    let query = this.db
      .from('admission_scores')
      .select(`
        min_score,
        avg_score,
        min_rank,
        universities!inner(id, name, province, tier, is_985, is_211)
      `)
      .eq('province', province)
      .eq('year', year);

    if (tier) query = query.eq('universities.tier', tier);

    query = query.order('min_score', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error('[SupabaseExecutor] getAdmissionStats:', error.message);
      return [];
    }

    if (!data?.length) return [];

    // 汇总统计
    const scores = data.map((r: any) => r.min_score).filter(Boolean);
    const stats = {
      province,
      year,
      tier: tier ?? '全部',
      totalRecords: data.length,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      avgScore: Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length),
      universities985: data.filter((r: any) => r.universities?.is_985).length,
      universities211: data.filter((r: any) => r.universities?.is_211).length,
      topEntries: data.slice(0, 5).map((r: any) => ({
        name: r.universities?.name,
        minScore: r.min_score,
        minRank: r.min_rank,
      })),
    };

    return [stats];
  }
}
