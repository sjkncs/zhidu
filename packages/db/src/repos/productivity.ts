// @zhidu/db — 日程、番茄钟、待办事项

import { getDb } from '../utils';
import type { ScheduleEventRow, PomodoroSessionRow, TodoRow } from '../index';

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
