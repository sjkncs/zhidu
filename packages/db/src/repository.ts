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
  SkillTreeRow,
  SkillNodeRow,
  ScheduleEventRow,
  PomodoroSessionRow,
  TodoRow,
  DiaryEntryRow,
  MemoRow,
  ResumeRow,
  InternshipRow,
  ResearchProjectRow,
  TransactionRow,
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

// ─── Skill Trees ────────────────────────────────────────────────────────────

export async function createSkillTree(params: {
  userId: string;
  name: string;
  description?: string;
  category?: string;
  sourceMajor?: string;
  sourceCareer?: string;
  aiGenerated?: boolean;
}): Promise<SkillTreeRow | null> {
  try {
    const { data, error } = await getDb()
      .from('skill_trees')
      .insert({
        user_id: params.userId,
        name: params.name,
        description: params.description ?? null,
        category: params.category ?? 'CUSTOM',
        source_major: params.sourceMajor ?? null,
        source_career: params.sourceCareer ?? null,
        ai_generated: params.aiGenerated ?? false,
      })
      .select()
      .single();
    if (error) { console.error('[createSkillTree]', error.message); return null; }
    return mapSkillTree(data);
  } catch (err) {
    console.error('[createSkillTree]', err);
    return null;
  }
}

export async function getUserSkillTrees(userId: string): Promise<SkillTreeRow[]> {
  try {
    const { data, error } = await getDb()
      .from('skill_trees')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) { console.error('[getUserSkillTrees]', error.message); return []; }
    return (data ?? []).map(mapSkillTree);
  } catch (err) {
    console.error('[getUserSkillTrees]', err);
    return [];
  }
}

export async function getSkillTreeById(id: string): Promise<SkillTreeRow | null> {
  try {
    const { data, error } = await getDb()
      .from('skill_trees')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) { console.error('[getSkillTreeById]', error.message); return null; }
    return data ? mapSkillTree(data) : null;
  } catch (err) {
    console.error('[getSkillTreeById]', err);
    return null;
  }
}

export async function updateSkillTree(id: string, updates: {
  name?: string;
  description?: string;
  category?: string;
}): Promise<SkillTreeRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    const { data, error } = await getDb()
      .from('skill_trees')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateSkillTree]', error.message); return null; }
    return mapSkillTree(data);
  } catch (err) {
    console.error('[updateSkillTree]', err);
    return null;
  }
}

export async function deleteSkillTree(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('skill_trees').delete().eq('id', id);
    if (error) { console.error('[deleteSkillTree]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteSkillTree]', err);
    return false;
  }
}

function mapSkillTree(row: any): SkillTreeRow {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    category: row.category,
    sourceMajor: row.source_major,
    sourceCareer: row.source_career,
    aiGenerated: row.ai_generated,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Skill Nodes ────────────────────────────────────────────────────────────

export async function createSkillNode(params: {
  skillTreeId: string;
  title: string;
  description?: string;
  parentNodeId?: string;
  difficulty?: number;
  prerequisites?: string[];
  resources?: any[];
  estimatedHours?: number;
  sortOrder?: number;
}): Promise<SkillNodeRow | null> {
  try {
    const { data, error } = await getDb()
      .from('skill_nodes')
      .insert({
        skill_tree_id: params.skillTreeId,
        title: params.title,
        description: params.description ?? null,
        parent_node_id: params.parentNodeId ?? null,
        difficulty: params.difficulty ?? 3,
        prerequisites: params.prerequisites ?? [],
        resources: params.resources ?? [],
        estimated_hours: params.estimatedHours ?? null,
        sort_order: params.sortOrder ?? 0,
      })
      .select()
      .single();
    if (error) { console.error('[createSkillNode]', error.message); return null; }
    return mapSkillNode(data);
  } catch (err) {
    console.error('[createSkillNode]', err);
    return null;
  }
}

export async function getSkillNodes(treeId: string): Promise<SkillNodeRow[]> {
  try {
    const { data, error } = await getDb()
      .from('skill_nodes')
      .select('*')
      .eq('skill_tree_id', treeId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { console.error('[getSkillNodes]', error.message); return []; }
    return (data ?? []).map(mapSkillNode);
  } catch (err) {
    console.error('[getSkillNodes]', err);
    return [];
  }
}

export async function updateSkillNode(id: string, updates: {
  title?: string;
  description?: string;
  progress?: number;
  difficulty?: number;
  prerequisites?: string[];
  resources?: any[];
  estimatedHours?: number;
}): Promise<SkillNodeRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
    if (updates.difficulty !== undefined) dbUpdates.difficulty = updates.difficulty;
    if (updates.prerequisites !== undefined) dbUpdates.prerequisites = updates.prerequisites;
    if (updates.resources !== undefined) dbUpdates.resources = updates.resources;
    if (updates.estimatedHours !== undefined) dbUpdates.estimated_hours = updates.estimatedHours;
    const { data, error } = await getDb()
      .from('skill_nodes')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateSkillNode]', error.message); return null; }
    return mapSkillNode(data);
  } catch (err) {
    console.error('[updateSkillNode]', err);
    return null;
  }
}

export async function deleteSkillNode(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('skill_nodes').delete().eq('id', id);
    if (error) { console.error('[deleteSkillNode]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteSkillNode]', err);
    return false;
  }
}

export async function batchCreateSkillNodes(nodes: Array<{
  skillTreeId: string;
  title: string;
  description?: string;
  parentNodeId?: string;
  difficulty?: number;
  prerequisites?: string[];
  resources?: any[];
  estimatedHours?: number;
  sortOrder?: number;
}>): Promise<SkillNodeRow[]> {
  try {
    const rows = nodes.map((n) => ({
      skill_tree_id: n.skillTreeId,
      title: n.title,
      description: n.description ?? null,
      parent_node_id: n.parentNodeId ?? null,
      difficulty: n.difficulty ?? 3,
      prerequisites: n.prerequisites ?? [],
      resources: n.resources ?? [],
      estimated_hours: n.estimatedHours ?? null,
      sort_order: n.sortOrder ?? 0,
    }));
    const { data, error } = await getDb().from('skill_nodes').insert(rows).select();
    if (error) { console.error('[batchCreateSkillNodes]', error.message); return []; }
    return (data ?? []).map(mapSkillNode);
  } catch (err) {
    console.error('[batchCreateSkillNodes]', err);
    return [];
  }
}

function mapSkillNode(row: any): SkillNodeRow {
  return {
    id: row.id,
    skillTreeId: row.skill_tree_id,
    parentNodeId: row.parent_node_id,
    title: row.title,
    description: row.description,
    difficulty: row.difficulty,
    progress: row.progress,
    prerequisites: row.prerequisites,
    resources: row.resources,
    estimatedHours: row.estimated_hours,
    completed: row.completed,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    depth: row.depth,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Schedule Events ────────────────────────────────────────────────────────

export async function createScheduleEvent(params: {
  userId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  allDay?: boolean;
  eventType?: string;
  recurrence?: any;
  location?: string;
}): Promise<ScheduleEventRow | null> {
  try {
    const { data, error } = await getDb()
      .from('schedule_events')
      .insert({
        user_id: params.userId,
        title: params.title,
        description: params.description ?? null,
        start_time: params.startTime,
        end_time: params.endTime ?? null,
        all_day: params.allDay ?? false,
        event_type: params.eventType ?? 'GENERAL',
        recurrence: params.recurrence ?? null,
        location: params.location ?? null,
      })
      .select()
      .single();
    if (error) { console.error('[createScheduleEvent]', error.message); return null; }
    return mapScheduleEvent(data);
  } catch (err) {
    console.error('[createScheduleEvent]', err);
    return null;
  }
}

export async function getUserScheduleEvents(userId: string, filters?: {
  startTime?: string;
  endTime?: string;
  eventType?: string;
}): Promise<ScheduleEventRow[]> {
  try {
    let query = getDb()
      .from('schedule_events')
      .select('*')
      .eq('user_id', userId);
    if (filters?.startTime) query = query.gte('start_time', filters.startTime);
    if (filters?.endTime) query = query.lte('start_time', filters.endTime);
    if (filters?.eventType) query = query.eq('event_type', filters.eventType);
    const { data, error } = await query.order('start_time', { ascending: true });
    if (error) { console.error('[getUserScheduleEvents]', error.message); return []; }
    return (data ?? []).map(mapScheduleEvent);
  } catch (err) {
    console.error('[getUserScheduleEvents]', err);
    return [];
  }
}

export async function updateScheduleEvent(id: string, updates: {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  eventType?: string;
  recurrence?: any;
  location?: string;
}): Promise<ScheduleEventRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.allDay !== undefined) dbUpdates.all_day = updates.allDay;
    if (updates.eventType !== undefined) dbUpdates.event_type = updates.eventType;
    if (updates.recurrence !== undefined) dbUpdates.recurrence = updates.recurrence;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    const { data, error } = await getDb()
      .from('schedule_events')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateScheduleEvent]', error.message); return null; }
    return mapScheduleEvent(data);
  } catch (err) {
    console.error('[updateScheduleEvent]', err);
    return null;
  }
}

export async function deleteScheduleEvent(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('schedule_events').delete().eq('id', id);
    if (error) { console.error('[deleteScheduleEvent]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteScheduleEvent]', err);
    return false;
  }
}

function mapScheduleEvent(row: any): ScheduleEventRow {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    allDay: row.all_day,
    eventType: row.event_type,
    recurrence: row.recurrence,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Pomodoro Sessions ──────────────────────────────────────────────────────

export async function createPomodoroSession(params: {
  userId: string;
  todoId?: string;
  durationMinutes?: number;
  completed?: boolean;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
}): Promise<PomodoroSessionRow | null> {
  try {
    const { data, error } = await getDb()
      .from('pomodoro_sessions')
      .insert({
        user_id: params.userId,
        todo_id: params.todoId ?? null,
        duration_minutes: params.durationMinutes ?? 25,
        completed: params.completed ?? false,
        started_at: params.startedAt ?? new Date().toISOString(),
        completed_at: params.completedAt ?? null,
        notes: params.notes ?? null,
      })
      .select()
      .single();
    if (error) { console.error('[createPomodoroSession]', error.message); return null; }
    return mapPomodoroSession(data);
  } catch (err) {
    console.error('[createPomodoroSession]', err);
    return null;
  }
}

export async function getUserPomodoroSessions(userId: string, filters?: {
  startDate?: string;
  endDate?: string;
  completed?: boolean;
}): Promise<PomodoroSessionRow[]> {
  try {
    let query = getDb()
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', userId);
    if (filters?.startDate) query = query.gte('started_at', filters.startDate);
    if (filters?.endDate) query = query.lte('started_at', filters.endDate);
    if (filters?.completed !== undefined) query = query.eq('completed', filters.completed);
    const { data, error } = await query.order('started_at', { ascending: false });
    if (error) { console.error('[getUserPomodoroSessions]', error.message); return []; }
    return (data ?? []).map(mapPomodoroSession);
  } catch (err) {
    console.error('[getUserPomodoroSessions]', err);
    return [];
  }
}

export async function updatePomodoroSession(id: string, updates: {
  completed?: boolean;
  completedAt?: string;
  notes?: string;
}): Promise<PomodoroSessionRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    const { data, error } = await getDb()
      .from('pomodoro_sessions')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updatePomodoroSession]', error.message); return null; }
    return mapPomodoroSession(data);
  } catch (err) {
    console.error('[updatePomodoroSession]', err);
    return null;
  }
}

function mapPomodoroSession(row: any): PomodoroSessionRow {
  return {
    id: row.id,
    userId: row.user_id,
    todoId: row.todo_id,
    durationMinutes: row.duration_minutes,
    completed: row.completed,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    notes: row.notes,
  };
}

// ─── Todos (enhanced with parent_id, tags, category) ────────────────────────

export async function createTodo(params: {
  userId: string;
  title: string;
  description?: string;
  priority?: number;
  dueDate?: string;
  parentId?: string;
  tags?: string[];
  category?: string;
  sortOrder?: number;
}): Promise<TodoRow | null> {
  try {
    const { data, error } = await getDb()
      .from('todos')
      .insert({
        user_id: params.userId,
        title: params.title,
        description: params.description ?? null,
        priority: params.priority ?? 3,
        due_date: params.dueDate ?? null,
        parent_id: params.parentId ?? null,
        tags: params.tags ?? [],
        category: params.category ?? 'GENERAL',
        sort_order: params.sortOrder ?? 0,
      })
      .select()
      .single();
    if (error) { console.error('[createTodo]', error.message); return null; }
    return mapTodo(data);
  } catch (err) {
    console.error('[createTodo]', err);
    return null;
  }
}

export async function getUserTodos(userId: string, filters?: {
  completed?: boolean;
  category?: string;
  parentId?: string;
  priority?: number;
}): Promise<TodoRow[]> {
  try {
    let query = getDb()
      .from('todos')
      .select('*')
      .eq('user_id', userId);
    if (filters?.completed !== undefined) query = query.eq('completed', filters.completed);
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.parentId !== undefined) query = query.eq('parent_id', filters.parentId);
    if (filters?.priority) query = query.eq('priority', filters.priority);
    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { console.error('[getUserTodos]', error.message); return []; }
    return (data ?? []).map(mapTodo);
  } catch (err) {
    console.error('[getUserTodos]', err);
    return [];
  }
}

export async function updateTodo(id: string, updates: {
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: number;
  dueDate?: string;
  parentId?: string;
  tags?: string[];
  category?: string;
  sortOrder?: number;
}): Promise<TodoRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
    const { data, error } = await getDb()
      .from('todos')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateTodo]', error.message); return null; }
    return mapTodo(data);
  } catch (err) {
    console.error('[updateTodo]', err);
    return null;
  }
}

export async function deleteTodo(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('todos').delete().eq('id', id);
    if (error) { console.error('[deleteTodo]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteTodo]', err);
    return false;
  }
}

function mapTodo(row: any): TodoRow {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    completed: row.completed,
    priority: row.priority,
    dueDate: row.due_date,
    parentId: row.parent_id,
    tags: row.tags,
    category: row.category ?? 'GENERAL',
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Diary Entries (enhanced with mood_tags) ────────────────────────────────

export async function createDiaryEntry(params: {
  userId: string;
  title?: string;
  content: string;
  mood?: number;
  moodTags?: string[];
  entryDate: string;
}): Promise<DiaryEntryRow | null> {
  try {
    const { data, error } = await getDb()
      .from('diary_entries')
      .insert({
        user_id: params.userId,
        title: params.title ?? null,
        content: params.content,
        mood: params.mood ?? null,
        mood_tags: params.moodTags ?? [],
        entry_date: params.entryDate,
      })
      .select()
      .single();
    if (error) { console.error('[createDiaryEntry]', error.message); return null; }
    return mapDiaryEntry(data);
  } catch (err) {
    console.error('[createDiaryEntry]', err);
    return null;
  }
}

export async function getUserDiaryEntries(userId: string, filters?: {
  startDate?: string;
  endDate?: string;
  minMood?: number;
  maxMood?: number;
  limit?: number;
}): Promise<DiaryEntryRow[]> {
  try {
    let query = getDb()
      .from('diary_entries')
      .select('*')
      .eq('user_id', userId);
    if (filters?.startDate) query = query.gte('entry_date', filters.startDate);
    if (filters?.endDate) query = query.lte('entry_date', filters.endDate);
    if (filters?.minMood != null) query = query.gte('mood', filters.minMood);
    if (filters?.maxMood != null) query = query.lte('mood', filters.maxMood);
    const { data, error } = await query
      .order('entry_date', { ascending: false })
      .limit(filters?.limit ?? 100);
    if (error) { console.error('[getUserDiaryEntries]', error.message); return []; }
    return (data ?? []).map(mapDiaryEntry);
  } catch (err) {
    console.error('[getUserDiaryEntries]', err);
    return [];
  }
}

export async function updateDiaryEntry(id: string, updates: {
  title?: string;
  content?: string;
  mood?: number;
  moodTags?: string[];
}): Promise<DiaryEntryRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.mood !== undefined) dbUpdates.mood = updates.mood;
    if (updates.moodTags !== undefined) dbUpdates.mood_tags = updates.moodTags;
    const { data, error } = await getDb()
      .from('diary_entries')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateDiaryEntry]', error.message); return null; }
    return mapDiaryEntry(data);
  } catch (err) {
    console.error('[updateDiaryEntry]', err);
    return null;
  }
}

export async function deleteDiaryEntry(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('diary_entries').delete().eq('id', id);
    if (error) { console.error('[deleteDiaryEntry]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteDiaryEntry]', err);
    return false;
  }
}

function mapDiaryEntry(row: any): DiaryEntryRow {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    mood: row.mood,
    moodTags: row.mood_tags,
    entryDate: row.entry_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Memos (enhanced with title, is_archived) ───────────────────────────────

export async function createMemo(params: {
  userId: string;
  title?: string;
  content: string;
  tags?: string[];
  isPinned?: boolean;
  remindAt?: string;
}): Promise<MemoRow | null> {
  try {
    const { data, error } = await getDb()
      .from('memos')
      .insert({
        user_id: params.userId,
        title: params.title ?? null,
        content: params.content,
        tags: params.tags ?? [],
        is_pinned: params.isPinned ?? false,
        remind_at: params.remindAt ?? null,
      })
      .select()
      .single();
    if (error) { console.error('[createMemo]', error.message); return null; }
    return mapMemo(data);
  } catch (err) {
    console.error('[createMemo]', err);
    return null;
  }
}

export async function getUserMemos(userId: string, filters?: {
  isPinned?: boolean;
  isArchived?: boolean;
  search?: string;
  limit?: number;
}): Promise<MemoRow[]> {
  try {
    let query = getDb()
      .from('memos')
      .select('*')
      .eq('user_id', userId);
    if (filters?.isPinned !== undefined) query = query.eq('is_pinned', filters.isPinned);
    if (filters?.isArchived !== undefined) query = query.eq('is_archived', filters.isArchived);
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
    }
    const { data, error } = await query
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(filters?.limit ?? 200);
    if (error) { console.error('[getUserMemos]', error.message); return []; }
    return (data ?? []).map(mapMemo);
  } catch (err) {
    console.error('[getUserMemos]', err);
    return [];
  }
}

export async function updateMemo(id: string, updates: {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
  isArchived?: boolean;
  remindAt?: string;
}): Promise<MemoRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.isPinned !== undefined) dbUpdates.is_pinned = updates.isPinned;
    if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;
    if (updates.remindAt !== undefined) dbUpdates.remind_at = updates.remindAt;
    const { data, error } = await getDb()
      .from('memos')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateMemo]', error.message); return null; }
    return mapMemo(data);
  } catch (err) {
    console.error('[updateMemo]', err);
    return null;
  }
}

export async function deleteMemo(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('memos').delete().eq('id', id);
    if (error) { console.error('[deleteMemo]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteMemo]', err);
    return false;
  }
}

function mapMemo(row: any): MemoRow {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    tags: row.tags,
    isPinned: row.is_pinned,
    remindAt: row.remind_at,
    isArchived: row.is_archived ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Resumes ────────────────────────────────────────────────────────────────

export async function createResume(params: {
  userId: string;
  title: string;
  data?: Record<string, unknown>;
  targetRole?: string;
}): Promise<ResumeRow | null> {
  try {
    const { data, error } = await getDb()
      .from('resumes')
      .insert({
        user_id: params.userId,
        title: params.title,
        data: params.data ?? {},
        target_role: params.targetRole ?? null,
      })
      .select()
      .single();
    if (error) { console.error('[createResume]', error.message); return null; }
    return mapResume(data);
  } catch (err) {
    console.error('[createResume]', err);
    return null;
  }
}

export async function getUserResumes(userId: string): Promise<ResumeRow[]> {
  try {
    const { data, error } = await getDb()
      .from('resumes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) { console.error('[getUserResumes]', error.message); return []; }
    return (data ?? []).map(mapResume);
  } catch (err) {
    console.error('[getUserResumes]', err);
    return [];
  }
}

export async function getResumeById(id: string): Promise<ResumeRow | null> {
  try {
    const { data, error } = await getDb()
      .from('resumes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) { console.error('[getResumeById]', error.message); return null; }
    return data ? mapResume(data) : null;
  } catch (err) {
    console.error('[getResumeById]', err);
    return null;
  }
}

export async function updateResume(id: string, updates: {
  title?: string;
  data?: Record<string, unknown>;
  targetRole?: string;
}): Promise<ResumeRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.data !== undefined) dbUpdates.data = updates.data;
    if (updates.targetRole !== undefined) dbUpdates.target_role = updates.targetRole;
    const { data, error } = await getDb()
      .from('resumes')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateResume]', error.message); return null; }
    return mapResume(data);
  } catch (err) {
    console.error('[updateResume]', err);
    return null;
  }
}

export async function deleteResume(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('resumes').delete().eq('id', id);
    if (error) { console.error('[deleteResume]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteResume]', err);
    return false;
  }
}

function mapResume(row: any): ResumeRow {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    data: row.data ?? {},
    targetRole: row.target_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Internships ────────────────────────────────────────────────────────────

export async function createInternship(params: {
  userId: string;
  company: string;
  role: string;
  description?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
}): Promise<InternshipRow | null> {
  try {
    const { data, error } = await getDb()
      .from('internships')
      .insert({
        user_id: params.userId,
        company: params.company,
        role: params.role,
        description: params.description ?? null,
        start_date: params.startDate,
        end_date: params.endDate ?? null,
        current: params.current ?? false,
      })
      .select()
      .single();
    if (error) { console.error('[createInternship]', error.message); return null; }
    return mapInternship(data);
  } catch (err) {
    console.error('[createInternship]', err);
    return null;
  }
}

export async function getUserInternships(userId: string): Promise<InternshipRow[]> {
  try {
    const { data, error } = await getDb()
      .from('internships')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false });
    if (error) { console.error('[getUserInternships]', error.message); return []; }
    return (data ?? []).map(mapInternship);
  } catch (err) {
    console.error('[getUserInternships]', err);
    return [];
  }
}

export async function updateInternship(id: string, updates: {
  company?: string;
  role?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
}): Promise<InternshipRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.current !== undefined) dbUpdates.current = updates.current;
    const { data, error } = await getDb()
      .from('internships')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateInternship]', error.message); return null; }
    return mapInternship(data);
  } catch (err) {
    console.error('[updateInternship]', err);
    return null;
  }
}

export async function deleteInternship(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('internships').delete().eq('id', id);
    if (error) { console.error('[deleteInternship]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteInternship]', err);
    return false;
  }
}

function mapInternship(row: any): InternshipRow {
  return {
    id: row.id,
    userId: row.user_id,
    company: row.company,
    role: row.role,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    current: row.current ?? false,
  };
}

// ─── Research Projects ──────────────────────────────────────────────────────

export async function createResearchProject(params: {
  userId: string;
  title: string;
  role: string;
  description?: string;
  advisor?: string;
  startDate: string;
  endDate?: string;
  status?: 'ONGOING' | 'COMPLETED';
}): Promise<ResearchProjectRow | null> {
  try {
    const { data, error } = await getDb()
      .from('research_projects')
      .insert({
        user_id: params.userId,
        title: params.title,
        role: params.role,
        description: params.description ?? null,
        advisor: params.advisor ?? null,
        start_date: params.startDate,
        end_date: params.endDate ?? null,
        status: params.status ?? 'ONGOING',
      })
      .select()
      .single();
    if (error) { console.error('[createResearchProject]', error.message); return null; }
    return mapResearchProject(data);
  } catch (err) {
    console.error('[createResearchProject]', err);
    return null;
  }
}

export async function getUserResearchProjects(userId: string, filters?: {
  status?: 'ONGOING' | 'COMPLETED';
}): Promise<ResearchProjectRow[]> {
  try {
    let query = getDb()
      .from('research_projects')
      .select('*')
      .eq('user_id', userId);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query.order('start_date', { ascending: false });
    if (error) { console.error('[getUserResearchProjects]', error.message); return []; }
    return (data ?? []).map(mapResearchProject);
  } catch (err) {
    console.error('[getUserResearchProjects]', err);
    return [];
  }
}

export async function updateResearchProject(id: string, updates: {
  title?: string;
  role?: string;
  description?: string;
  advisor?: string;
  startDate?: string;
  endDate?: string;
  status?: 'ONGOING' | 'COMPLETED';
}): Promise<ResearchProjectRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.advisor !== undefined) dbUpdates.advisor = updates.advisor;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    const { data, error } = await getDb()
      .from('research_projects')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateResearchProject]', error.message); return null; }
    return mapResearchProject(data);
  } catch (err) {
    console.error('[updateResearchProject]', err);
    return null;
  }
}

export async function deleteResearchProject(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('research_projects').delete().eq('id', id);
    if (error) { console.error('[deleteResearchProject]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteResearchProject]', err);
    return false;
  }
}

function mapResearchProject(row: any): ResearchProjectRow {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    role: row.role,
    description: row.description,
    advisor: row.advisor,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
  };
}

// ─── Transactions (Finance) ─────────────────────────────────────────────────

export async function createTransaction(params: {
  userId: string;
  amount: number;
  category: string;
  description?: string;
  type: 'EXPENSE' | 'INCOME';
  date?: string;
}): Promise<TransactionRow | null> {
  try {
    const { data, error } = await getDb()
      .from('transactions')
      .insert({
        user_id: params.userId,
        amount: params.amount,
        category: params.category,
        description: params.description ?? null,
        type: params.type,
        date: params.date ?? new Date().toISOString().split('T')[0],
      })
      .select()
      .single();
    if (error) { console.error('[createTransaction]', error.message); return null; }
    return mapTransaction(data);
  } catch (err) {
    console.error('[createTransaction]', err);
    return null;
  }
}

export async function getUserTransactions(userId: string, filters?: {
  type?: 'EXPENSE' | 'INCOME';
  category?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<TransactionRow[]> {
  try {
    let query = getDb()
      .from('transactions')
      .select('*')
      .eq('user_id', userId);
    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.startDate) query = query.gte('date', filters.startDate);
    if (filters?.endDate) query = query.lte('date', filters.endDate);
    const { data, error } = await query
      .order('date', { ascending: false })
      .limit(filters?.limit ?? 200);
    if (error) { console.error('[getUserTransactions]', error.message); return []; }
    return (data ?? []).map(mapTransaction);
  } catch (err) {
    console.error('[getUserTransactions]', err);
    return [];
  }
}

export async function updateTransaction(id: string, updates: {
  amount?: number;
  category?: string;
  description?: string;
  type?: 'EXPENSE' | 'INCOME';
  date?: string;
}): Promise<TransactionRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    const { data, error } = await getDb()
      .from('transactions')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateTransaction]', error.message); return null; }
    return mapTransaction(data);
  } catch (err) {
    console.error('[updateTransaction]', err);
    return null;
  }
}

export async function deleteTransaction(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('transactions').delete().eq('id', id);
    if (error) { console.error('[deleteTransaction]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteTransaction]', err);
    return false;
  }
}

function mapTransaction(row: any): TransactionRow {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    category: row.category,
    description: row.description,
    type: row.type,
    date: row.date,
    createdAt: row.created_at,
  };
}
