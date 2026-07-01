// @zhidu/db — 技能树 & 技能节点

import { getDb } from '../utils';
import type { SkillTreeRow, SkillNodeRow } from '../index';

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
