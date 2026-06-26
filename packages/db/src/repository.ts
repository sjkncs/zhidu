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
  KnowledgeDocumentRow,
  KnowledgeChunkRow,
  CareerPathRow,
  GoalRow,
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

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Base 知识库查询
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 搜索知识库文档（按标题和内容全文搜索）
 */
export async function searchKnowledgeDocuments(params: {
  query?: string;
  collection?: string;
  limit?: number;
}): Promise<KnowledgeDocumentRow[]> {
  const { query, collection, limit = 20 } = params;

  try {
    let q = getDb().from('knowledge_documents').select('*');

    if (query) {
      q = q.or(`title.ilike.%${query}%,content.ilike.%${query}%`);
    }
    if (collection) {
      q = q.eq('collection', collection as KnowledgeDocumentRow['collection']);
    }

    q = q.order('created_at', { ascending: false }).limit(limit);

    const { data, error } = await q;

    if (error) {
      console.error('[searchKnowledgeDocuments] 查询失败:', error.message);
      return [];
    }

    return (data as KnowledgeDocumentRow[]) ?? [];
  } catch (err) {
    console.error('[searchKnowledgeDocuments] 异常:', err);
    return [];
  }
}

/**
 * 搜索知识库分块（基于 pg_trgm 相似度）
 * 调用数据库 search_knowledge RPC 函数
 */
export async function searchKnowledgeChunks(params: {
  query: string;
  collections?: string[];
  limit?: number;
  threshold?: number;
}): Promise<Array<KnowledgeChunkRow & { title: string; collection: string; sourceUrl: string | null; similarity: number }>> {
  const { query, collections, limit = 10, threshold = 0.05 } = params;

  try {
    const { data, error } = await (getDb() as any).rpc('search_knowledge', {
      query_text: query,
      collection_filter: collections ?? null,
      match_limit: limit,
      similarity_threshold: threshold,
    });

    if (error) {
      console.error('[searchKnowledgeChunks] RPC 调用失败:', error.message);
      return [];
    }

    return ((data ?? []) as any[]).map((row) => ({
      id: row.chunk_id,
      documentId: '',
      chunkIndex: 0,
      content: row.chunk_content,
      metadata: row.chunk_metadata,
      createdAt: '',
      title: row.doc_title,
      collection: row.doc_collection,
      sourceUrl: row.doc_source_url,
      similarity: row.similarity_score,
    }));
  } catch (err) {
    console.error('[searchKnowledgeChunks] 异常:', err);
    return [];
  }
}

/**
 * 获取某知识库集合下的所有文档
 */
export async function getKnowledgeDocuments(collection: string): Promise<KnowledgeDocumentRow[]> {
  try {
    const { data, error } = await getDb().from('knowledge_documents')
      .select('*')
      .eq('collection', collection as KnowledgeDocumentRow['collection'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getKnowledgeDocuments] 查询失败:', error.message);
      return [];
    }

    return (data as KnowledgeDocumentRow[]) ?? [];
  } catch (err) {
    console.error('[getKnowledgeDocuments] 异常:', err);
    return [];
  }
}

/**
 * 获取文档的所有分块
 */
export async function getKnowledgeChunks(documentId: string): Promise<KnowledgeChunkRow[]> {
  try {
    const { data, error } = await getDb().from('knowledge_chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (error) {
      console.error('[getKnowledgeChunks] 查询失败:', error.message);
      return [];
    }

    return (data as KnowledgeChunkRow[]) ?? [];
  } catch (err) {
    console.error('[getKnowledgeChunks] 异常:', err);
    return [];
  }
}

// ─── Career Paths ──────────────────────────────────────────────────────────

export async function createCareerPath(params: {
  userId: string;
  targetRole: string;
  targetIndustry?: string;
  salaryRange?: string;
  requiredSkills?: string[];
  shortTermGoals?: any[];
  midTermGoals?: any[];
  longTermGoals?: any[];
  industryTrends?: string;
  matchScore?: number;
  sourceMajor?: string;
  sourceMbti?: string;
  sourceHolland?: string;
}): Promise<CareerPathRow | null> {
  try {
    const { data, error } = await getDb()
      .from('career_paths')
      .insert({
        user_id: params.userId,
        target_role: params.targetRole,
        target_industry: params.targetIndustry ?? null,
        salary_range: params.salaryRange ?? null,
        required_skills: params.requiredSkills ?? [],
        short_term_goals: params.shortTermGoals ?? [],
        mid_term_goals: params.midTermGoals ?? [],
        long_term_goals: params.longTermGoals ?? [],
        industry_trends: params.industryTrends ?? null,
        match_score: params.matchScore ?? 0,
        source_major: params.sourceMajor ?? null,
        source_mbti: params.sourceMbti ?? null,
        source_holland: params.sourceHolland ?? null,
      })
      .select()
      .single();
    if (error) { console.error('[createCareerPath]', error.message); return null; }
    return mapCareerPath(data);
  } catch (err) {
    console.error('[createCareerPath]', err);
    return null;
  }
}

export async function getUserCareerPaths(userId: string): Promise<CareerPathRow[]> {
  try {
    const { data, error } = await getDb()
      .from('career_paths')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) { console.error('[getUserCareerPaths]', error.message); return []; }
    return (data ?? []).map(mapCareerPath);
  } catch (err) {
    console.error('[getUserCareerPaths]', err);
    return [];
  }
}

export async function deleteCareerPath(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('career_paths').delete().eq('id', id);
    if (error) { console.error('[deleteCareerPath]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteCareerPath]', err);
    return false;
  }
}

function mapCareerPath(row: any): CareerPathRow {
  return {
    id: row.id,
    userId: row.user_id,
    targetRole: row.target_role,
    targetIndustry: row.target_industry,
    stage: row.stage,
    salaryRange: row.salary_range,
    requiredSkills: row.required_skills,
    shortTermGoals: row.short_term_goals,
    midTermGoals: row.mid_term_goals,
    longTermGoals: row.long_term_goals,
    industryTrends: row.industry_trends,
    matchScore: row.match_score,
    sourceMajor: row.source_major,
    sourceMbti: row.source_mbti,
    sourceHolland: row.source_holland,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Goals ─────────────────────────────────────────────────────────────────

export async function createGoal(params: {
  userId: string;
  title: string;
  description?: string;
  category?: string;
  priority?: number;
  deadline?: string;
  parentGoalId?: string;
  careerPathId?: string;
  sortOrder?: number;
}): Promise<GoalRow | null> {
  try {
    const { data, error } = await getDb()
      .from('goals')
      .insert({
        user_id: params.userId,
        title: params.title,
        description: params.description ?? null,
        category: params.category ?? 'OTHER',
        priority: params.priority ?? 3,
        deadline: params.deadline ?? null,
        parent_goal_id: params.parentGoalId ?? null,
        career_path_id: params.careerPathId ?? null,
        sort_order: params.sortOrder ?? 0,
      })
      .select()
      .single();
    if (error) { console.error('[createGoal]', error.message); return null; }
    return mapGoal(data);
  } catch (err) {
    console.error('[createGoal]', err);
    return null;
  }
}

export async function getUserGoals(userId: string, filters?: {
  category?: string;
  completed?: boolean;
  parentGoalId?: string;
}): Promise<GoalRow[]> {
  try {
    let query = getDb()
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.completed !== undefined) query = query.eq('completed', filters.completed);
    if (filters?.parentGoalId) query = query.eq('parent_goal_id', filters.parentGoalId);
    const { data, error } = await query;
    if (error) { console.error('[getUserGoals]', error.message); return []; }
    return (data ?? []).map(mapGoal);
  } catch (err) {
    console.error('[getUserGoals]', err);
    return [];
  }
}

export async function updateGoal(id: string, updates: {
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: number;
  deadline?: string;
}): Promise<GoalRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline;
    const { data, error } = await getDb()
      .from('goals')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateGoal]', error.message); return null; }
    return mapGoal(data);
  } catch (err) {
    console.error('[updateGoal]', err);
    return null;
  }
}

export async function deleteGoal(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('goals').delete().eq('id', id);
    if (error) { console.error('[deleteGoal]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteGoal]', err);
    return false;
  }
}

export async function batchCreateGoals(goals: Array<{
  userId: string;
  title: string;
  description?: string;
  category?: string;
  priority?: number;
  deadline?: string;
  parentGoalId?: string;
  careerPathId?: string;
  sortOrder?: number;
}>): Promise<GoalRow[]> {
  try {
    const rows = goals.map((g) => ({
      user_id: g.userId,
      title: g.title,
      description: g.description ?? null,
      category: g.category ?? 'OTHER',
      priority: g.priority ?? 3,
      deadline: g.deadline ?? null,
      parent_goal_id: g.parentGoalId ?? null,
      career_path_id: g.careerPathId ?? null,
      sort_order: g.sortOrder ?? 0,
    }));
    const { data, error } = await getDb().from('goals').insert(rows).select();
    if (error) { console.error('[batchCreateGoals]', error.message); return []; }
    return (data ?? []).map(mapGoal);
  } catch (err) {
    console.error('[batchCreateGoals]', err);
    return [];
  }
}

function mapGoal(row: any): GoalRow {
  return {
    id: row.id,
    userId: row.user_id,
    parentGoalId: row.parent_goal_id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    completed: row.completed,
    deadline: row.deadline,
    depth: row.depth,
    sortOrder: row.sort_order,
    careerPathId: row.career_path_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
