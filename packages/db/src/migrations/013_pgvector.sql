-- ============================================================================
-- Migration 013: pgvector 语义搜索
-- 为 knowledge_chunks 添加向量嵌入，实现语义检索
--
-- 执行方式：在 Supabase Dashboard → SQL Editor 中粘贴执行
-- 前提：Supabase 项目需先启用 pgvector 扩展
-- ============================================================================

-- 1. 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 为 knowledge_chunks 添加 embedding 列
-- 使用 1536 维向量（OpenAI text-embedding-3-small 的默认维度）
ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. 创建向量索引（IVFFlat，适合中等规模数据集）
-- lists 参数根据数据量调整：当前约 4268 条 chunks，lists = sqrt(4268) ≈ 65
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON public.knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 65);

-- 4. 语义搜索函数
CREATE OR REPLACE FUNCTION semantic_search(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_collections TEXT[] DEFAULT NULL
) RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id AS chunk_id,
    kc.document_id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  LEFT JOIN public.knowledge_documents kd ON kc.document_id = kd.id
  WHERE
    kc.embedding IS NOT NULL
    AND (filter_collections IS NULL OR kd.collection = ANY(filter_collections))
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 混合搜索函数（结合向量相似度 + 文本匹配）
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding vector(1536),
  text_weight FLOAT DEFAULT 0.3,
  vector_weight FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
) RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  combined_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id AS chunk_id,
    kc.document_id,
    kc.content,
    kc.metadata,
    (
      text_weight * COALESCE(similarity(kc.content, query_text), 0)
      + vector_weight * (1 - COALESCE(kc.embedding <=> query_embedding, 1))
    ) AS combined_score
  FROM public.knowledge_chunks kc
  WHERE
    (kc.embedding IS NOT NULL OR similarity(kc.content, query_text) > 0.1)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
