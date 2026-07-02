// @zhidu/ai — RAG 服务实现（检索增强生成）
//
// Phase 3a: pg_trgm 关键词检索 + LLM 生成
// Phase 3b: 接入 pgvector 语义检索（切换 EmbeddingService 即可）

import type { RAGService, RetrievalResult, TaskType } from './index';
import type { LLMService } from './index';
import { chunkText, type ChunkOptions } from './chunker';
import { createEmbeddingService, type EmbeddingService } from './embedding-service';

// ─────────────────────────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────────────────────────

interface SupabaseLike {
  from(table: string): any;
  rpc(fn: string, params: Record<string, unknown>): any;
}

export interface SearchResultRow {
  chunk_id: string;
  chunk_content: string;
  doc_title: string;
  doc_collection: string;
  doc_source_url: string | null;
  doc_metadata: Record<string, unknown>;
  chunk_metadata: Record<string, unknown>;
  similarity_score: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RAG 支持的任务类型
// ─────────────────────────────────────────────────────────────────────────────

const RAG_TASK_TYPES: Set<TaskType> = new Set([
  'KNOWLEDGE_QA' as TaskType,
  'CAREER_PLAN' as TaskType,
  'MAJOR_RECOMMEND' as TaskType,
  'STUDY_PLAN' as TaskType,
  'GENERAL_CHAT' as TaskType,
]);

// ─────────────────────────────────────────────────────────────────────────────
// Prompt 构建
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 构建 RAG 增强 Prompt
 * 将检索到的知识片段注入上下文，要求 LLM 引用来源
 */
export function buildRAGPrompt(params: {
  query: string;
  chunks: RetrievalResult[];
  additionalContext?: string;
}): Array<{ role: 'system' | 'user'; content: string }> {
  const { query, chunks, additionalContext } = params;

  const sourcesText = chunks
    .map((c, i) => `[${i + 1}] ${c.content}\n    — 来源: ${(c.metadata as any)?.title ?? '未知'} ${c.metadata?.collection ? `(${c.metadata.collection})` : ''}`)
    .join('\n\n');

  const systemPrompt = `你是"知渡"平台的知识助手，专门回答高考志愿填报、大学专业、职业规划等问题。

## 回答规则

1. **优先使用参考资料**：你的回答必须基于下方提供的参考资料，不要编造参考资料中没有的事实。
2. **引用来源**：在回答中用 [1]、[2] 等标注引用了哪些参考资料。
3. **诚实面对不足**：如果参考资料不足以完整回答问题，请明确说明"根据现有资料，暂时无法给出完整答案"，并建议用户查阅更多信息。
4. **补充常识**：对于通用的教育常识（如"985高校的含义"），可以适当补充，但要与引用内容区分。
5. **语言风格**：专业、简洁、有条理，适合高中生和家长阅读。

## 参考资料

${sourcesText}
${additionalContext ? `\n## 补充信息\n${additionalContext}` : ''}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// RAGService 工厂
// ─────────────────────────────────────────────────────────────────────────────

export interface RAGServiceConfig {
  /** Supabase 客户端 */
  db: SupabaseLike;
  /** LLM 服务（用于 retrieveAndGenerate） */
  llm: LLMService;
  /** Embedding 服务（可选，Phase 3b 使用） */
  embedding?: EmbeddingService;
  /** 分块参数 */
  chunkOptions?: ChunkOptions;
  /** 默认检索数量 */
  defaultTopK?: number;
}

/**
 * 创建 RAG 服务实例
 */
export function createRAGService(config: RAGServiceConfig): RAGService {
  const {
    db,
    llm,
    embedding,
    chunkOptions = { chunkSize: 500, overlap: 50 },
    defaultTopK = 8,
  } = config;

  return {
    /**
     * 判断该任务类型是否适合使用 RAG
     */
    canHandle(taskType: TaskType): boolean {
      return RAG_TASK_TYPES.has(taskType);
    },

    /**
     * 检索相关文档片段
     * Phase 3a: pg_trgm 关键词搜索 (search_knowledge)
     * Phase 3b (TODO): 当 embedding 数据就绪后，升级为 hybrid_search (关键词 + 语义向量)
     *   hybrid_search 需要 query_embedding，由 ZHIPU_EMBEDDING_KEY 或 OPENAI_API_KEY 生成
     */
    async retrieve(params: {
      query: string;
      collections?: string[];
      topK?: number;
    }): Promise<RetrievalResult[]> {
      const { query, collections, topK = defaultTopK } = params;

      try {
        // 调用 search_knowledge RPC 函数（pg_trgm 关键词搜索）
        const { data, error } = await db.rpc('search_knowledge', {
          query_text: query,
          collection_filter: collections?.length ? collections : null,
          match_limit: topK,
          similarity_threshold: 0.05,
        });

        if (error) {
          console.error('[RAG] retrieve error:', error.message);
          return [];
        }

        if (!data || !Array.isArray(data)) return [];

        return (data as SearchResultRow[]).map((row): RetrievalResult => ({
          id: row.chunk_id,
          content: row.chunk_content,
          metadata: {
            title: row.doc_title,
            collection: row.doc_collection,
            sourceUrl: row.doc_source_url,
            documentMetadata: row.doc_metadata,
            chunkMetadata: row.chunk_metadata,
          },
          score: row.similarity_score,
        }));
      } catch (err) {
        console.error('[RAG] retrieve exception:', err);
        return [];
      }
    },

    /**
     * 检索 + 生成：检索后结合上下文生成回复
     */
    async retrieveAndGenerate(params: {
      query: string;
      collections?: string[];
      context?: string;
    }): Promise<{ content: string; sources: RetrievalResult[] }> {
      const { query, collections, context } = params;

      // 1. 检索
      const chunks = await this.retrieve({ query, collections, topK: defaultTopK });

      if (chunks.length === 0) {
        // 没有检索到相关内容，直接用 LLM 回答（标注无参考来源）
        const messages: Array<{ role: 'system' | 'user'; content: string }> = [
          {
            role: 'system',
            content: `你是"知渡"平台的知识助手。当前知识库中未找到与该问题直接相关的资料。
请基于你的通用知识给出回答，但要明确说明这是通用建议而非平台专有数据。
如果涉及具体的分数线、政策细节等，建议用户咨询学校招生办或查阅官方文件。`,
          },
          { role: 'user', content: query },
        ];

        const content = await llm.chat({ messages, options: { temperature: 0.7 } });
        return { content, sources: [] };
      }

      // 2. 构建 RAG Prompt
      const messages = buildRAGPrompt({
        query,
        chunks,
        additionalContext: context,
      });

      // 3. 调用 LLM 生成
      const content = await llm.chat({
        messages,
        options: { temperature: 0.5, maxTokens: 2048 },
      });

      return { content, sources: chunks };
    },

    /**
     * 索引新文档（知识库入库）
     * 1. 文本分块
     * 2. 生成 embedding（如果 EmbeddingService 可用）
     * 3. 写入 knowledge_documents + knowledge_chunks
     */
    async index(params: {
      collection: string;
      documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>;
    }): Promise<void> {
      const { collection, documents } = params;

      for (const doc of documents) {
        try {
          // 1. 插入/更新文档记录
          const { data: docRow, error: docError } = await db
            .from('knowledge_documents')
            .upsert({
              title: doc.metadata?.title as string ?? `文档-${doc.id.slice(0, 8)}`,
              collection,
              content: doc.content,
              source_url: (doc.metadata?.sourceUrl as string) ?? null,
              metadata: doc.metadata ?? {},
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'id',
            })
            .select()
            .single();

          if (docError) {
            console.error(`[RAG] index document error (${doc.id}):`, docError.message);
            continue;
          }

          const documentId = docRow?.id ?? doc.id;

          // 2. 文本分块
          const chunks = chunkText(doc.content, chunkOptions);

          // 3. 生成 embedding（如果可用）
          let embeddings: number[][] = [];
          if (embedding?.isAvailable()) {
            try {
              embeddings = await embedding.embedBatch(chunks.map(c => c.content));
            } catch (err) {
              console.warn('[RAG] embedding generation failed, skipping vectors:', err);
            }
          }

          // 4. 删除旧分块，插入新分块
          await db.from('knowledge_chunks')
            .delete()
            .eq('document_id', documentId);

          const chunkRows = chunks.map((chunk, i) => ({
            document_id: documentId,
            chunk_index: chunk.metadata.chunkIndex,
            content: chunk.content,
            metadata: {
              ...chunk.metadata,
              ...(doc.metadata ?? {}),
            },
            ...(embeddings[i] ? { embedding: embeddings[i] } : {}),
          }));

          if (chunkRows.length > 0) {
            const { error: chunkError } = await db
              .from('knowledge_chunks')
              .insert(chunkRows);

            if (chunkError) {
              console.error(`[RAG] index chunks error (${doc.id}):`, chunkError.message);
            } else {
              console.log(`[RAG] Indexed document "${doc.metadata?.title ?? doc.id}": ${chunkRows.length} chunks`);
            }
          }
        } catch (err) {
          console.error(`[RAG] index exception (${doc.id}):`, err);
        }
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────────────────────────────────────
