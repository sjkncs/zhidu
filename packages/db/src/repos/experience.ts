// @zhidu/db — 实习经历 & 科研项目

import { getDb } from '../utils';
import type { InternshipRow, ResearchProjectRow } from '../index';

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
