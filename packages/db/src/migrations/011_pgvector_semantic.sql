-- ============================================================================
-- Migration 011: pgvector 语义检索升级（Phase 13c）
-- 将知识库检索从 pg_trgm 关键词匹配升级为 pgvector 语义向量检索
--
-- 前提条件：
-- 1. Supabase 项目已启用 pgvector 扩展（Settings → Database → Extensions）
-- 2. knowledge_chunks 表已有 embedding vector(768) 列
-- 3. 需要通过外部 Embedding API 预先为所有 chunks 生成向量
--
-- 执行方式：在 Supabase Dashboard → SQL Editor 中粘贴执行
-- ============================================================================

-- 1. 确保 pgvector 扩展已启用
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 语义检索函数（基于余弦相似度）
-- 与 search_knowledge (pg_trgm) 接口兼容，可并行使用
CREATE OR REPLACE FUNCTION search_knowledge_semantic(
  query_embedding vector(768),
  collection_filter TEXT[] DEFAULT NULL,
  match_limit INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.7
) RETURNS TABLE (
  chunk_id UUID,
  chunk_content TEXT,
  doc_title TEXT,
  doc_collection TEXT,
  doc_source_url TEXT,
  doc_metadata JSONB,
  chunk_metadata JSONB,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id AS chunk_id,
    kc.content AS chunk_content,
    kd.title AS doc_title,
    kd.collection AS doc_collection,
    kd.source_url AS doc_source_url,
    kd.metadata AS doc_metadata,
    kc.metadata AS chunk_metadata,
    (1 - (kc.embedding <=> query_embedding))::FLOAT AS similarity_score
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.embedding IS NOT NULL
  AND (
    collection_filter IS NULL
    OR array_length(collection_filter, 1) = 0
    OR kd.collection = ANY(collection_filter)
  )
  AND (1 - (kc.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY similarity_score DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. 混合检索函数：语义 + 关键词（RRF 融合排序）
-- 结合 pgvector 语义相似度和 pg_trgm 关键词匹配的优势
CREATE OR REPLACE FUNCTION search_knowledge_hybrid(
  query_text TEXT,
  query_embedding vector(768) DEFAULT NULL,
  collection_filter TEXT[] DEFAULT NULL,
  match_limit INT DEFAULT 10,
  semantic_weight FLOAT DEFAULT 0.6,
  keyword_weight FLOAT DEFAULT 0.4
) RETURNS TABLE (
  chunk_id UUID,
  chunk_content TEXT,
  doc_title TEXT,
  doc_collection TEXT,
  doc_source_url TEXT,
  doc_metadata JSONB,
  chunk_metadata JSONB,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT
      kc.id AS cid,
      kc.content AS ccontent,
      kd.title AS dtitle,
      kd.collection AS dcollection,
      kd.source_url AS dsource_url,
      kd.metadata AS dmetadata,
      kc.metadata AS cmetadata,
      (1 - (kc.embedding <=> query_embedding))::FLOAT AS semantic_score
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kd.id = kc.document_id
    WHERE query_embedding IS NOT NULL
      AND kc.embedding IS NOT NULL
      AND (collection_filter IS NULL OR array_length(collection_filter, 1) = 0 OR kd.collection = ANY(collection_filter))
    ORDER BY semantic_score DESC
    LIMIT match_limit * 3
  ),
  keyword_results AS (
    SELECT
      kc.id AS cid,
      kc.content AS ccontent,
      kd.title AS dtitle,
      kd.collection AS dcollection,
      kd.source_url AS dsource_url,
      kd.metadata AS dmetadata,
      kc.metadata AS cmetadata,
      GREATEST(
        similarity(kc.content, query_text),
        word_similarity(query_text, kc.content)
      )::FLOAT AS keyword_score
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kd.id = kc.document_id
    WHERE (
      kc.content ILIKE '%' || query_text || '%'
      OR similarity(kc.content, query_text) > 0.05
      OR word_similarity(query_text, kc.content) > 0.05
    )
    AND (collection_filter IS NULL OR array_length(collection_filter, 1) = 0 OR kd.collection = ANY(collection_filter))
    ORDER BY keyword_score DESC
    LIMIT match_limit * 3
  ),
  merged AS (
    SELECT
      COALESCE(s.cid, k.cid) AS cid,
      COALESCE(s.ccontent, k.ccontent) AS ccontent,
      COALESCE(s.dtitle, k.dtitle) AS dtitle,
      COALESCE(s.dcollection, k.dcollection) AS dcollection,
      COALESCE(s.dsource_url, k.dsource_url) AS dsource_url,
      COALESCE(s.dmetadata, k.dmetadata) AS dmetadata,
      COALESCE(s.cmetadata, k.cmetadata) AS cmetadata,
      (
        COALESCE(s.semantic_score, 0) * semantic_weight
        + COALESCE(k.keyword_score, 0) * keyword_weight
      ) AS combined_score
    FROM semantic_results s
    FULL OUTER JOIN keyword_results k ON s.cid = k.cid
  )
  SELECT
    m.cid AS chunk_id,
    m.ccontent AS chunk_content,
    m.dtitle AS doc_title,
    m.dcollection AS doc_collection,
    m.dsource_url AS doc_source_url,
    m.dmetadata AS doc_metadata,
    m.cmetadata AS chunk_metadata,
    m.combined_score AS similarity_score
  FROM merged m
  WHERE m.combined_score > 0.1
  ORDER BY m.combined_score DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. 验证
SELECT 'Migration 011 (pgvector semantic search) complete!' AS status;
