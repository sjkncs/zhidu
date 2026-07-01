// @zhidu/db — 院校 & 专业查询

import { getDb } from '../utils';
import type { UniversityRow, MajorRow } from '../index';

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
