// @zhidu/db — 对话会话 & 消息

import { getDb } from '../utils';
import type { ChatSessionRow, ChatMessageRow } from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// Chat Session 对话会话
// ─────────────────────────────────────────────────────────────────────────────

export async function createChatSession(userId: string, title?: string): Promise<ChatSessionRow | null> {
  try {
    const row: Record<string, any> = { user_id: userId };
    if (title) row.title = title;
    const { data, error } = await getDb()
      .from('chat_sessions')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('[createChatSession]', error.message); return null; }
    return mapChatSession(data);
  } catch (err) {
    console.error('[createChatSession]', err);
    return null;
  }
}

export async function getUserChatSessions(userId: string, limit = 20): Promise<ChatSessionRow[]> {
  try {
    const { data, error } = await getDb()
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_active_at', { ascending: false })
      .limit(limit);
    if (error) { console.error('[getUserChatSessions]', error.message); return []; }
    return (data ?? []).map(mapChatSession);
  } catch (err) {
    console.error('[getUserChatSessions]', err);
    return [];
  }
}

export async function deleteChatSession(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('chat_sessions').delete().eq('id', id);
    if (error) { console.error('[deleteChatSession]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteChatSession]', err);
    return false;
  }
}

export async function updateChatSessionTitle(id: string, title: string): Promise<ChatSessionRow | null> {
  try {
    const { data, error } = await getDb()
      .from('chat_sessions')
      .update({ title })
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateChatSessionTitle]', error.message); return null; }
    return mapChatSession(data);
  } catch (err) {
    console.error('[updateChatSessionTitle]', err);
    return null;
  }
}

function mapChatSession(row: any): ChatSessionRow {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    taskType: row.task_type,
    messageCount: row.message_count,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Message 对话消息
// ─────────────────────────────────────────────────────────────────────────────

export async function createChatMessage(sessionId: string, msg: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Array<{ title: string; snippet: string; score: number }>;
  taskType?: string;
  tokenCount?: number;
}): Promise<ChatMessageRow | null> {
  try {
    const row: Record<string, any> = {
      session_id: sessionId,
      role: msg.role,
      content: msg.content,
      task_type: msg.taskType ?? 'GENERAL_CHAT',
    };
    if (msg.sources) row.sources = msg.sources;
    if (msg.tokenCount) row.token_count = msg.tokenCount;
    const { data, error } = await getDb()
      .from('chat_messages')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('[createChatMessage]', error.message); return null; }
    return mapChatMessage(data);
  } catch (err) {
    console.error('[createChatMessage]', err);
    return null;
  }
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessageRow[]> {
  try {
    const { data, error } = await getDb()
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) { console.error('[getSessionMessages]', error.message); return []; }
    return (data ?? []).map(mapChatMessage);
  } catch (err) {
    console.error('[getSessionMessages]', err);
    return [];
  }
}

/** 批量创建消息（用于保存一次对话的 user + assistant） */
export async function batchCreateChatMessages(sessionId: string, messages: Array<{
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Array<{ title: string; snippet: string; score: number }>;
  taskType?: string;
}>): Promise<ChatMessageRow[]> {
  try {
    const rows = messages.map((msg) => ({
      session_id: sessionId,
      role: msg.role,
      content: msg.content,
      sources: msg.sources ?? [],
      task_type: msg.taskType ?? 'GENERAL_CHAT',
    }));
    const { data, error } = await getDb()
      .from('chat_messages')
      .insert(rows)
      .select();
    if (error) { console.error('[batchCreateChatMessages]', error.message); return []; }
    return (data ?? []).map(mapChatMessage);
  } catch (err) {
    console.error('[batchCreateChatMessages]', err);
    return [];
  }
}

function mapChatMessage(row: any): ChatMessageRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    sources: row.sources,
    taskType: row.task_type,
    tokenCount: row.token_count,
    createdAt: row.created_at,
  };
}
