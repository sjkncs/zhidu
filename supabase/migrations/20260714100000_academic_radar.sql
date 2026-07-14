-- ============================================================
-- 学术雷达（Academic Radar）— 论文追踪 + 投资/量化交叉分析
-- 原创模块：arXiv 论文追踪 + AI 增强摘要 + 投资关联
-- ============================================================

-- ─── 1. papers 表：存储 arXiv 论文 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arxiv_id TEXT UNIQUE NOT NULL,             -- e.g., "2407.12345"
    title TEXT NOT NULL,
    abstract TEXT,
    authors TEXT[] NOT NULL DEFAULT '{}',       -- array of author names
    categories TEXT[] NOT NULL DEFAULT '{}',     -- e.g., {"cs.AI", "stat.ML"}
    primary_category TEXT,                       -- e.g., "cs.AI"
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    pdf_url TEXT,
    abs_url TEXT,
    -- AI 增强字段
    ai_summary TEXT,                             -- LLM 生成的中文摘要
    ai_insights JSONB DEFAULT '[]'::jsonb,       -- 投资/量化关联洞察
    ai_tags TEXT[] DEFAULT '{}',                 -- AI 提取的关键词标签
    relevance_scores JSONB DEFAULT '{}'::jsonb,  -- {investment: 0.8, quant: 0.6, research: 0.9}
    -- 元数据
    fetched_at TIMESTAMPTZ DEFAULT now(),
    source TEXT DEFAULT 'arxiv',                 -- 来源: arxiv, biorxiv, etc.
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_papers_arxiv_id ON public.papers (arxiv_id);
CREATE INDEX idx_papers_published ON public.papers (published_at DESC);
CREATE INDEX idx_papers_categories ON public.papers USING GIN (categories);
CREATE INDEX idx_papers_authors ON public.papers USING GIN (authors);
CREATE INDEX idx_papers_ai_tags ON public.papers USING GIN (ai_tags);
CREATE INDEX idx_papers_primary_cat ON public.papers (primary_category);

-- RLS: 论文是公开数据，所有人可读，但只有认证用户可以写
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "papers_read_all"
    ON public.papers FOR SELECT
    USING (true);

CREATE POLICY "papers_insert_auth"
    ON public.papers FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "papers_update_auth"
    ON public.papers FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- ─── 2. paper_interactions 表：用户收藏/阅读/笔记 ─────────────────────
CREATE TABLE IF NOT EXISTS public.paper_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('bookmark', 'read', 'note', 'share', 'investigate')),
    note TEXT,                                   -- 用户笔记
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, paper_id, interaction_type)
);

CREATE INDEX idx_paper_interactions_user ON public.paper_interactions (user_id);
CREATE INDEX idx_paper_interactions_paper ON public.paper_interactions (paper_id);
CREATE INDEX idx_paper_interactions_type ON public.paper_interactions (user_id, interaction_type);

ALTER TABLE public.paper_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paper_interactions_own"
    ON public.paper_interactions FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ─── 3. paper_categories 表：用户自定义分类/关注领域 ────────────────────
CREATE TABLE IF NOT EXISTS public.paper_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    arxiv_categories TEXT[] NOT NULL DEFAULT '{}',  -- e.g., {"cs.AI", "cs.LG"}
    keywords TEXT[] DEFAULT '{}',                    -- 用户自定义关键词
    color TEXT DEFAULT '#3b82f6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_paper_categories_user ON public.paper_categories (user_id);

ALTER TABLE public.paper_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paper_categories_own"
    ON public.paper_categories FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ─── 4. search_papers 函数：全文搜索论文 ────────────────────────────────
CREATE OR REPLACE FUNCTION search_papers(
    query_text TEXT DEFAULT NULL,
    category_filter TEXT[] DEFAULT NULL,
    author_filter TEXT DEFAULT NULL,
    date_from TIMESTAMPTZ DEFAULT NULL,
    date_to TIMESTAMPTZ DEFAULT NULL,
    has_summary BOOLEAN DEFAULT NULL,
    match_limit INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    paper_id UUID,
    arxiv_id TEXT,
    title TEXT,
    abstract TEXT,
    authors TEXT[],
    categories TEXT[],
    primary_category TEXT,
    published_at TIMESTAMPTZ,
    ai_summary TEXT,
    ai_tags TEXT[],
    relevance_scores JSONB,
    pdf_url TEXT,
    abs_url TEXT,
    total_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    total BIGINT;
BEGIN
    -- 计算总数
    SELECT COUNT(*) INTO total
    FROM public.papers p
    WHERE (query_text IS NULL OR
           p.title ILIKE '%' || query_text || '%' OR
           p.abstract ILIKE '%' || query_text || '%' OR
           EXISTS (SELECT 1 FROM unnest(p.ai_tags) t WHERE t ILIKE '%' || query_text || '%'))
      AND (category_filter IS NULL OR p.categories && category_filter)
      AND (author_filter IS NULL OR EXISTS (SELECT 1 FROM unnest(p.authors) a WHERE a ILIKE '%' || author_filter || '%'))
      AND (date_from IS NULL OR p.published_at >= date_from)
      AND (date_to IS NULL OR p.published_at <= date_to)
      AND (has_summary IS NULL OR (has_summary AND p.ai_summary IS NOT NULL));

    -- 返回分页结果
    RETURN QUERY
    SELECT
        p.id AS paper_id,
        p.arxiv_id,
        p.title,
        p.abstract,
        p.authors,
        p.categories,
        p.primary_category,
        p.published_at,
        p.ai_summary,
        p.ai_tags,
        p.relevance_scores,
        p.pdf_url,
        p.abs_url,
        total AS total_count
    FROM public.papers p
    WHERE (query_text IS NULL OR
           p.title ILIKE '%' || query_text || '%' OR
           p.abstract ILIKE '%' || query_text || '%' OR
           EXISTS (SELECT 1 FROM unnest(p.ai_tags) t WHERE t ILIKE '%' || query_text || '%'))
      AND (category_filter IS NULL OR p.categories && category_filter)
      AND (author_filter IS NULL OR EXISTS (SELECT 1 FROM unnest(p.authors) a WHERE a ILIKE '%' || author_filter || '%'))
      AND (date_from IS NULL OR p.published_at >= date_from)
      AND (date_to IS NULL OR p.published_at <= date_to)
      AND (has_summary IS NULL OR (has_summary AND p.ai_summary IS NOT NULL))
    ORDER BY p.published_at DESC NULLS LAST
    LIMIT match_limit
    OFFSET offset_count;
END;
$$;

-- ─── 5. 默认论文分类（种子数据） ────────────────────────────────────────
-- 这些是系统级别的分类模板，用户可以在前端自定义
-- 不在这里插入，因为需要 user_id，改为在前端/API 初始化时创建

-- ─── 6. 论文相关视图 ────────────────────────────────────────────────────

-- 用户收藏的论文
CREATE OR REPLACE VIEW user_bookmarked_papers AS
SELECT
    p.*,
    pi.created_at AS bookmarked_at,
    pi.note,
    pi.rating,
    pi.tags AS user_tags
FROM public.papers p
JOIN public.paper_interactions pi ON pi.paper_id = p.id
WHERE pi.interaction_type = 'bookmark';

-- 论文统计
CREATE OR REPLACE VIEW paper_stats AS
SELECT
    COUNT(*) AS total_papers,
    COUNT(*) FILTER (WHERE ai_summary IS NOT NULL) AS summarized_papers,
    COUNT(DISTINCT primary_category) AS unique_categories,
    MIN(published_at) AS oldest_paper,
    MAX(published_at) AS newest_paper,
    COUNT(*) FILTER (WHERE published_at >= now() - interval '7 days') AS papers_last_week
FROM public.papers;
