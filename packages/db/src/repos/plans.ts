// @zhidu/db — 志愿方案 & 测评结果 CRUD

import { getDb, toCamel, camelToSnake } from '../utils';
import type { ApplicationPlanRow, PlanItemRow, AssessmentRow } from '../index';

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
        user_id: userId,
        name,
        year,
        province,
        status: 'DRAFT' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[createPlan] 创建失败:', error.message);
      return null;
    }

    return toCamel<ApplicationPlanRow>(data);
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

    return toCamel<ApplicationPlanRow>(data) ?? null;
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getUserPlans] 查询失败:', error.message);
      return [];
    }

    return toCamel<ApplicationPlanRow[]>(data) ?? [];
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
    const rows = items.map((item) => {
      const converted: Record<string, unknown> = { plan_id: planId };
      for (const [k, v] of Object.entries(item)) {
        converted[camelToSnake(k)] = v;
      }
      return converted;
    });

    const { data, error } = await getDb().from('plan_items')
      .insert(rows as any[])
      .select();

    if (error) {
      console.error('[addPlanItems] 添加失败:', error.message);
      return [];
    }

    return toCamel<PlanItemRow[]>(data) ?? [];
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
      .eq('plan_id', planId)
      .order('order', { ascending: true });

    if (error) {
      console.error('[getPlanItems] 查询失败:', error.message);
      return [];
    }

    return toCamel<PlanItemRow[]>(data) ?? [];
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
      .update({ status: status as any, updated_at: new Date().toISOString() } as any)
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
        user_id: userId,
        type: type as AssessmentRow['type'],
        raw_scores: rawScores,
        result,
        confidence,
        taken_at: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[saveAssessment] 保存失败:', error.message);
      return null;
    }

    return toCamel<AssessmentRow>(data);
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
      .eq('user_id', userId)
      .order('taken_at', { ascending: false });

    if (type) {
      query = query.eq('type', type as AssessmentRow['type']);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getUserAssessments] 查询失败:', error.message);
      return [];
    }

    return toCamel<AssessmentRow[]>(data) ?? [];
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
      .eq('user_id', userId)
      .eq('type', type as AssessmentRow['type'])
      .order('taken_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[getLatestAssessment] 查询失败:', error.message);
      return null;
    }

    return toCamel<AssessmentRow>(data) ?? null;
  } catch (err) {
    console.error('[getLatestAssessment] 异常:', err);
    return null;
  }
}
