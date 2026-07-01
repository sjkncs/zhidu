// @zhidu/db — 职业路径 & 目标管理

import { getDb } from '../utils';
import type { CareerPathRow, GoalRow } from '../index';

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
