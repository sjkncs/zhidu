// @zhidu/db — 日记、备忘录、简历

import { getDb } from '../utils';
import type { DiaryEntryRow, MemoRow, ResumeRow } from '../index';

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
