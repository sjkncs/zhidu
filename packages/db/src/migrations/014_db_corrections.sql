-- Migration 014: 数据库修正
-- Phase 18 — 向量维度统一 + 函数名修复 + 索引补全 + upsert 约束
--
-- 修复项：
-- 1. 向量维度 768 → 1536（删除旧列/索引/函数，重建 1536 维）
-- 2. set_updated_at() 函数（migration 007/008 引用但未定义）
-- 3. 补全缺失索引（profiles, application_plans, assessments）
-- 4. 清理重复的向量索引

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. 向量维度统一 (768 → 1536)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1a. 删除旧的 768 维搜索函数
DROP FUNCTION IF EXISTS public.search_knowledge_semantic(vector(768), text[], integer);
DROP FUNCTION IF EXISTS public.search_knowledge_hybrid(vector(768), text[], text[], integer, float, float);

-- 1b. 删除旧的 768 维索引（migration 002 创建的）
DROP INDEX IF EXISTS public.idx_chunks_embedding;

-- 1c. 删除 migration 013 创建的索引（如果存在）
DROP INDEX IF EXISTS public.idx_knowledge_chunks_embedding;

-- 1d. 删除旧的 768 维 embedding 列
ALTER TABLE public.knowledge_chunks DROP COLUMN IF EXISTS embedding;

-- 1e. 创建新的 1536 维 embedding 列
ALTER TABLE public.knowledge_chunks
  ADD COLUMN embedding vector(1536);

-- 1f. 创建 IVFFlat 索引（1536 维）
-- 注意：IVFFlat 需要表中有数据才能创建，这里用 CREATE INDEX IF NOT EXISTS
-- 如果表为空，索引创建会失败但不影响后续操作
DO $$
BEGIN
  IF (SELECT count(*) FROM public.knowledge_chunks WHERE embedding IS NOT NULL) > 0 THEN
    CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_1536
      ON public.knowledge_chunks
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 65);
  END IF;
END $$;

-- 1g. 重建 1536 维语义搜索函数
CREATE OR REPLACE FUNCTION public.search_knowledge_semantic(
  query_embedding vector(1536),
  match_collections text[] DEFAULT NULL,
  match_count integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS score
  FROM public.knowledge_chunks kc
  LEFT JOIN public.knowledge_documents kd ON kc.document_id = kd.id
  WHERE kc.embedding IS NOT NULL
    AND (match_collections IS NULL OR kd.collection = ANY(match_collections))
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 1h. 重建 1536 维混合搜索函数
CREATE OR REPLACE FUNCTION public.search_knowledge_hybrid(
  query_embedding vector(1536),
  query_text text DEFAULT '',
  match_collections text[] DEFAULT NULL,
  match_count integer DEFAULT 10,
  semantic_weight float DEFAULT 0.6,
  keyword_weight float DEFAULT 0.4
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT
      kc.id,
      kc.content,
      kc.metadata,
      (1 - (kc.embedding <=> query_embedding)) * semantic_weight AS sem_score
    FROM public.knowledge_chunks kc
    LEFT JOIN public.knowledge_documents kd ON kc.document_id = kd.id
    WHERE kc.embedding IS NOT NULL
      AND (match_collections IS NULL OR kd.collection = ANY(match_collections))
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_results AS (
    SELECT
      kc.id,
      kc.content,
      kc.metadata,
      (similarity(kc.content, query_text)) * keyword_weight AS kw_score
    FROM public.knowledge_chunks kc
    LEFT JOIN public.knowledge_documents kd ON kc.document_id = kd.id
    WHERE (match_collections IS NULL OR kd.collection = ANY(match_collections))
      AND kc.content % query_text
    ORDER BY similarity(kc.content, query_text) DESC
    LIMIT match_count * 2
  ),
  combined AS (
    SELECT id, content, metadata, COALESCE(sem_score, 0) + COALESCE(kw_score, 0) AS total_score
    FROM semantic_results
    FULL OUTER JOIN keyword_results USING (id, content, metadata)
  )
  SELECT c.id, c.content, c.metadata, c.total_score AS score
  FROM combined c
  ORDER BY c.total_score DESC
  LIMIT match_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. 修复 set_updated_at() 函数名
-- ═══════════════════════════════════════════════════════════════════════════

-- migration 003 定义了 update_updated_at_column()
-- migration 007/008 引用了 set_updated_at() 但该函数不存在
-- 创建 set_updated_at() 作为别名，保证两个名字都能用

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. 补全缺失索引
-- ═══════════════════════════════════════════════════════════════════════════

-- profiles 表使用 id (auth UID) 作为主键，无需额外索引

-- application_plans.user_id — 志愿方案按用户查询
CREATE INDEX IF NOT EXISTS idx_application_plans_user_id
  ON public.application_plans(user_id);

-- assessments(user_id, type) — 按用户和类型查询评估结果
CREATE INDEX IF NOT EXISTS idx_assessments_user_type
  ON public.assessments(user_id, type);

-- admission_scores.university_id — 单表索引（已有组合索引但缺单列）
CREATE INDEX IF NOT EXISTS idx_admission_scores_university
  ON public.admission_scores(university_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. 清理重复的 migration 002 中 768 维 IVFFlat 索引
-- ═══════════════════════════════════════════════════════════════════════════

-- migration 002 在 DO block 中创建了 idx_chunks_embedding（768 维, lists=100）
-- 已在上面 step 1b 中删除，这里确保干净
DROP INDEX IF EXISTS public.idx_chunks_embedding;

-- migration 013 创建的 idx_knowledge_chunks_embedding（1536 维, lists=65）
-- 已在上面 step 1c 中删除，新的统一索引名为 idx_knowledge_embedding_1536
