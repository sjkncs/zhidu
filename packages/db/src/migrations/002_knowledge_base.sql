-- ==========================================================================
-- 智渡 Phase 3: Knowledge Base & RAG
-- 知识库 Schema Migration
--
-- 执行方式：在 Supabase Dashboard → SQL Editor 中粘贴执行
-- 依赖：pg_trgm 扩展（Supabase 默认支持）
-- ==========================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. 启用扩展
-- ──────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- pgvector（可选，如果可用则启用，不可用也不影响 Phase 3a）
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension not available, skipping. Will use pg_trgm only.';
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. 知识文档表
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  -- 知识库分类：
  --   policy       = 招生政策/高考政策
  --   major_intro  = 专业介绍
  --   career       = 职业规划/就业信息
  --   volunteer    = 志愿填报指南
  --   general      = 通用知识
  collection TEXT NOT NULL CHECK (collection IN ('policy', 'major_intro', 'career', 'volunteer', 'general')),
  source_url TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. 知识分块表
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  -- 预留 vector 列（768维，Phase 3b 接入 Embedding 后使用）
  -- 如果 pgvector 未安装则跳过此列
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

-- 如果 pgvector 不可用，创建不带 embedding 列的表
-- （上面的 CREATE TABLE 会在 pgvector 不可用时失败，所以用 DO 块处理）
DO $$
BEGIN
  -- 尝试添加 embedding 列（如果表已存在但列不存在）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'
  ) THEN
    BEGIN
      ALTER TABLE knowledge_chunks ADD COLUMN embedding vector(768);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Cannot add embedding column (pgvector not available), skipping.';
    END;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- 表可能还不存在，忽略
  NULL;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. 索引
-- ──────────────────────────────────────────────────────────────────────────

-- 文档表索引
CREATE INDEX IF NOT EXISTS idx_documents_collection ON knowledge_documents(collection);
CREATE INDEX IF NOT EXISTS idx_documents_created ON knowledge_documents(created_at DESC);

-- 分块表索引
CREATE INDEX IF NOT EXISTS idx_chunks_document ON knowledge_chunks(document_id);

-- 三元组索引（pg_trgm 核心，支持模糊匹配和相似度搜索）
CREATE INDEX IF NOT EXISTS idx_chunks_content_trgm ON knowledge_chunks USING gin(content gin_trgm_ops);

-- 元数据索引
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON knowledge_chunks USING gin(metadata);

-- pgvector 索引（如果 pgvector 可用且 embedding 列存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cannot create vector index, skipping.';
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. 检索函数
-- ──────────────────────────────────────────────────────────────────────────

-- 基于 pg_trgm 的文本相似度检索
CREATE OR REPLACE FUNCTION search_knowledge(
  query_text TEXT,
  collection_filter TEXT[] DEFAULT NULL,
  match_limit INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.05
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
    GREATEST(
      similarity(kc.content, query_text),
      word_similarity(query_text, kc.content)
    )::double precision AS similarity_score
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE (
    collection_filter IS NULL
    OR array_length(collection_filter, 1) = 0
    OR kd.collection = ANY(collection_filter)
  )
  AND (
    -- 关键词包含匹配（中英文都有效）
    kc.content ILIKE '%' || query_text || '%'
    -- 三元组相似度
    OR similarity(kc.content, query_text) > similarity_threshold
    -- 词级相似度（对短查询更有效）
    OR word_similarity(query_text, kc.content) > similarity_threshold
  )
  ORDER BY similarity_score DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. 辅助函数：获取知识库统计
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION knowledge_stats()
RETURNS TABLE (
  collection_name TEXT,
  document_count BIGINT,
  chunk_count BIGINT,
  total_chars BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kd.collection AS collection_name,
    COUNT(DISTINCT kd.id) AS document_count,
    COUNT(kc.id) AS chunk_count,
    COALESCE(SUM(LENGTH(kc.content)), 0) AS total_chars
  FROM knowledge_documents kd
  LEFT JOIN knowledge_chunks kc ON kc.document_id = kd.id
  GROUP BY kd.collection
  ORDER BY kd.collection;
END;
$$ LANGUAGE plpgsql STABLE;

-- ──────────────────────────────────────────────────────────────────────────
-- 7. Row Level Security
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- 知识库内容对所有用户可读
CREATE POLICY "knowledge_documents_select" ON knowledge_documents
  FOR SELECT USING (true);

CREATE POLICY "knowledge_chunks_select" ON knowledge_chunks
  FOR SELECT USING (true);

-- 写入需要认证（仅管理员/API可写）
CREATE POLICY "knowledge_documents_insert" ON knowledge_documents
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "knowledge_chunks_insert" ON knowledge_chunks
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- ──────────────────────────────────────────────────────────────────────────
-- 完成
-- ──────────────────────────────────────────────────────────────────────────

-- 验证
SELECT 'Knowledge Base migration complete!' AS status;
SELECT * FROM knowledge_stats();
