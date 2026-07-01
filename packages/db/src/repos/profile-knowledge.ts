// @zhidu/db — 用户画像 & 知识库查询

import { getDb, toCamel, camelToSnake } from '../utils';
import type { ProfileRow, KnowledgeDocumentRow, KnowledgeChunkRow } from '../index';

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
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[getUserProfile] 查询失败:', error.message);
      return null;
    }

    return toCamel<ProfileRow>(data) ?? null;
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
    const snakeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(updates)) {
      snakeUpdates[camelToSnake(k)] = v;
    }
    const { data, error } = await getDb().from('profiles')
      .update(snakeUpdates as any)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[updateUserProfile] 更新失败:', error.message);
      return null;
    }

    return toCamel<ProfileRow>(data) ?? null;
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
