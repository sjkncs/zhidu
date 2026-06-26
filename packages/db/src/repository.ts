// @zhidu/db — 数据查询层（Repository）
// 为规则引擎和前端提供类型安全的数据库查询函数

import { createClient, type SupabaseClient, type Database } from './index';
import type {
  UniversityRow,
  MajorRow,
  AdmissionScoreRow,
  AssessmentRow,
  ApplicationPlanRow,
  PlanItemRow,
  ProfileRow,
} from './index';

// Lazy-initialized client to avoid circular dependency at module load time.
// index.ts re-exports this module, so eagerly calling createClient() here
// would execute before index.ts finishes evaluating its own exports.
let _db: SupabaseClient<Database> | null = null;
function getDb(): SupabaseClient<Database> {
  if (!_db) {
    _db = createClient();
  }
  return _db;
}

// ─────────────────────────────────────────────────────────────────────────────
// University 院校查询
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 搜索院校（支持名称模糊搜索、省份、层次筛选、分页）
 */
export async function searchUniversities(params: {
  name?: string;
  province?: string;
  tier?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: UniversityRow[]; count: number }> {
  const { name, province, tier, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = getDb().from('universities')
      .select('*', { count: 'exact' });

    if (name) {
      // Use ilike for partial, case-insensitive name search
      query = query.ilike('name', `%${name}%`);
    }
    if (province) {
      query = query.eq('province', province);
    }
    if (tier) {
      query = query.eq('tier', tier as UniversityRow['tier']);
    }

    query = query.order('name', { ascending: true }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('[searchUniversities] 查询失败:', error.message);
      return { data: [], count: 0 };
    }

    return { data: (data as UniversityRow[]) ?? [], count: count ?? 0 };
  } catch (err) {
    console.error('[searchUniversities] 异常:', err);
    return { data: [], count: 0 };
  }
}

/**
 * 根据 ID 获取单个院校详情
 */
export async function getUniversityById(id: string): Promise<UniversityRow | null> {
  try {
    const { data, error } = await getDb().from('universities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[getUniversityById] 查询失败:', error.message);
      return null;
    }

    return (data as UniversityRow) ?? null;
  } catch (err) {
    console.error('[getUniversityById] 异常:', err);
    return null;
  }
}

/**
 * 批量获取院校（按 ID 列表）
 */
export async function getUniversitiesByIds(ids: string[]): Promise<UniversityRow[]> {
  if (!ids || ids.length === 0) return [];

  try {
    const { data, error } = await getDb().from('universities')
      .select('*')
      .in('id', ids);

    if (error) {
      console.error('[getUniversitiesByIds] 查询失败:', error.message);
      return [];
    }

    return (data as UniversityRow[]) ?? [];
  } catch (err) {
    console.error('[getUniversitiesByIds] 异常:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Major 专业查询
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 搜索专业（支持名称模糊搜索、类别筛选、分页）
 */
export async function searchMajors(params: {
  name?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: MajorRow[]; count: number }> {
  const { name, category, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = getDb().from('majors')
      .select('*', { count: 'exact' });

    if (name) {
      query = query.ilike('name', `%${name}%`);
    }
    if (category) {
      query = query.eq('category', category);
    }

    query = query.order('name', { ascending: true }).range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error('[searchMajors] 查询失败:', error.message);
      return { data: [], count: 0 };
    }

    return { data: (data as MajorRow[]) ?? [], count: count ?? 0 };
  } catch (err) {
    console.error('[searchMajors] 异常:', err);
    return { data: [], count: 0 };
  }
}

/**
 * 根据 ID 获取单个专业详情
 */
export async function getMajorById(id: string): Promise<MajorRow | null> {
  try {
    const { data, error } = await getDb().from('majors')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[getMajorById] 查询失败:', error.message);
      return null;
    }

    return (data as MajorRow) ?? null;
  } catch (err) {
    console.error('[getMajorById] 异常:', err);
    return null;
  }
}

/**
 * 根据类别获取专业列表（如：工学、理学、医学等）
 */
export async function getMajorsByCategory(category: string): Promise<MajorRow[]> {
  try {
    const { data, error } = await getDb().from('majors')
      .select('*')
      .eq('category', category)
      .order('name', { ascending: true });

    if (error) {
      console.error('[getMajorsByCategory] 查询失败:', error.message);
      return [];
    }

    return (data as MajorRow[]) ?? [];
  } catch (err) {
    console.error('[getMajorsByCategory] 异常:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admission Scores 录取分数线查询（规则引擎核心）
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
      query = query.eq('universityId', universityId);
    }
    if (majorId) {
      query = query.eq('majorId', majorId);
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

    return (data as AdmissionScoreRow[]) ?? [];
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
      query = query.gte('minScore', minScore);
    }
    if (maxScore != null) {
      query = query.lte('minScore', maxScore);
    }

    query = query.order('minScore', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[getAdmissionScoreRange] 查询失败:', error.message);
      return [];
    }

    return (data as AdmissionScoreRow[]) ?? [];
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
      .gte('minScore', lowerBound)
      .lte('minScore', upperBound);

    if (tier) {
      query = query.eq('universities.tier', tier as UniversityRow['tier']);
    }

    query = query.order('minScore', { ascending: false }).limit(limit);

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

// ─────────────────────────────────────────────────────────────────────────────
// Application Plan 志愿方案 CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 创建新的志愿方案
 */
export async function createPlan(params: {
  userId: string;
  name: string;
  year: number;
  province: string;
}): Promise<ApplicationPlanRow | null> {
  const { userId, name, year, province } = params;

  try {
    const { data, error } = await getDb().from('application_plans')
      .insert({
        userId,
        name,
        year,
        province,
        status: 'DRAFT' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[createPlan] 创建失败:', error.message);
      return null;
    }

    return data as ApplicationPlanRow;
  } catch (err) {
    console.error('[createPlan] 异常:', err);
    return null;
  }
}

/**
 * 根据 ID 获取方案详情
 */
export async function getPlanById(planId: string): Promise<ApplicationPlanRow | null> {
  try {
    const { data, error } = await getDb().from('application_plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle();

    if (error) {
      console.error('[getPlanById] 查询失败:', error.message);
      return null;
    }

    return (data as ApplicationPlanRow) ?? null;
  } catch (err) {
    console.error('[getPlanById] 异常:', err);
    return null;
  }
}

/**
 * 获取用户的所有志愿方案（按创建时间倒序）
 */
export async function getUserPlans(userId: string): Promise<ApplicationPlanRow[]> {
  try {
    const { data, error } = await getDb().from('application_plans')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('[getUserPlans] 查询失败:', error.message);
      return [];
    }

    return (data as ApplicationPlanRow[]) ?? [];
  } catch (err) {
    console.error('[getUserPlans] 异常:', err);
    return [];
  }
}

/**
 * 向方案中批量添加志愿条目
 */
export async function addPlanItems(planId: string, items: Partial<PlanItemRow>[]): Promise<PlanItemRow[]> {
  if (!items || items.length === 0) return [];

  try {
    const rows = items.map((item) => ({
      ...item,
      planId,
    }));

    const { data, error } = await getDb().from('plan_items')
      .insert(rows as any[])
      .select();

    if (error) {
      console.error('[addPlanItems] 添加失败:', error.message);
      return [];
    }

    return (data as PlanItemRow[]) ?? [];
  } catch (err) {
    console.error('[addPlanItems] 异常:', err);
    return [];
  }
}

/**
 * 获取方案中的所有志愿条目（按排序字段升序）
 */
export async function getPlanItems(planId: string): Promise<PlanItemRow[]> {
  try {
    const { data, error } = await getDb().from('plan_items')
      .select('*')
      .eq('planId', planId)
      .order('order', { ascending: true });

    if (error) {
      console.error('[getPlanItems] 查询失败:', error.message);
      return [];
    }

    return (data as PlanItemRow[]) ?? [];
  } catch (err) {
    console.error('[getPlanItems] 异常:', err);
    return [];
  }
}

/**
 * 删除单个志愿条目
 */
export async function deletePlanItem(itemId: string): Promise<void> {
  try {
    const { error } = await getDb().from('plan_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('[deletePlanItem] 删除失败:', error.message);
    }
  } catch (err) {
    console.error('[deletePlanItem] 异常:', err);
  }
}

/**
 * 更新方案状态（DRAFT → IN_PROGRESS → FINALIZED → SUBMITTED）
 */
export async function updatePlanStatus(planId: string, status: string): Promise<void> {
  try {
    const { error } = await getDb().from('application_plans')
      .update({ status: status as any, updatedAt: new Date().toISOString() } as any)
      .eq('id', planId);

    if (error) {
      console.error('[updatePlanStatus] 更新失败:', error.message);
    }
  } catch (err) {
    console.error('[updatePlanStatus] 异常:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment 测评结果 CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 保存测评结果（新增）
 */
export async function saveAssessment(params: {
  userId: string;
  type: string;
  rawScores: any;
  result: any;
  confidence?: number;
}): Promise<AssessmentRow | null> {
  const { userId, type, rawScores, result, confidence } = params;

  try {
    const { data, error } = await getDb().from('assessments')
      .insert({
        userId,
        type: type as AssessmentRow['type'],
        rawScores,
        result,
        confidence,
        takenAt: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[saveAssessment] 保存失败:', error.message);
      return null;
    }

    return data as AssessmentRow;
  } catch (err) {
    console.error('[saveAssessment] 异常:', err);
    return null;
  }
}

/**
 * 获取用户的测评记录（可选按类型筛选，按时间倒序）
 */
export async function getUserAssessments(
  userId: string,
  type?: string,
): Promise<AssessmentRow[]> {
  try {
    let query = getDb().from('assessments')
      .select('*')
      .eq('userId', userId)
      .order('takenAt', { ascending: false });

    if (type) {
      query = query.eq('type', type as AssessmentRow['type']);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getUserAssessments] 查询失败:', error.message);
      return [];
    }

    return (data as AssessmentRow[]) ?? [];
  } catch (err) {
    console.error('[getUserAssessments] 异常:', err);
    return [];
  }
}

/**
 * 获取用户某类型的最新一次测评结果
 */
export async function getLatestAssessment(
  userId: string,
  type: string,
): Promise<AssessmentRow | null> {
  try {
    const { data, error } = await getDb().from('assessments')
      .select('*')
      .eq('userId', userId)
      .eq('type', type as AssessmentRow['type'])
      .order('takenAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[getLatestAssessment] 查询失败:', error.message);
      return null;
    }

    return (data as AssessmentRow) ?? null;
  } catch (err) {
    console.error('[getLatestAssessment] 异常:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile 用户画像查询
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 获取用户画像
 */
export async function getUserProfile(userId: string): Promise<ProfileRow | null> {
  try {
    const { data, error } = await getDb().from('profiles')
      .select('*')
      .eq('userId', userId)
      .maybeSingle();

    if (error) {
      console.error('[getUserProfile] 查询失败:', error.message);
      return null;
    }

    return (data as ProfileRow) ?? null;
  } catch (err) {
    console.error('[getUserProfile] 异常:', err);
    return null;
  }
}

/**
 * 更新用户画像（部分更新）
 * 如果画像不存在则返回 null
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<ProfileRow>,
): Promise<ProfileRow | null> {
  try {
    const { data, error } = await getDb().from('profiles')
      .update({
        ...updates,
        updatedAt: new Date().toISOString(),
      } as any)
      .eq('userId', userId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[updateUserProfile] 更新失败:', error.message);
      return null;
    }

    return (data as ProfileRow) ?? null;
  } catch (err) {
    console.error('[updateUserProfile] 异常:', err);
    return null;
  }
}
