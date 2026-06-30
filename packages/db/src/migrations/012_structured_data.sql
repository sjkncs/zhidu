-- ============================================================================
-- Migration 012: Structured Data Expansion
-- 院校 + 专业数据增强，支撑 Excel 数据导入和未来爬虫数据
--
-- 执行方式：在 Supabase Dashboard → SQL Editor 中粘贴执行
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. 扩展 universities 表
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS is_985 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_211 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_dual_first_class BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS founding_year INTEGER,
  ADD COLUMN IF NOT EXISTS school_type TEXT,
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS master_programs INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doctoral_programs INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gender_ratio TEXT,
  ADD COLUMN IF NOT EXISTS admission_phone TEXT,
  ADD COLUMN IF NOT EXISTS national_specialties TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS discipline_evaluation JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS motto TEXT,
  ADD COLUMN IF NOT EXISTS affiliated TEXT,
  ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'seed',
  ADD COLUMN IF NOT EXISTS data_year INTEGER DEFAULT 2023,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 从 tier 字段回填布尔标志
UPDATE public.universities SET
  is_985 = (tier = '985'),
  is_211 = (tier IN ('985', '211')),
  is_dual_first_class = (tier IN ('985', '211', '双一流'));

-- 结构化查询索引
CREATE INDEX IF NOT EXISTS idx_universities_985 ON public.universities(is_985) WHERE is_985 = TRUE;
CREATE INDEX IF NOT EXISTS idx_universities_211 ON public.universities(is_211) WHERE is_211 = TRUE;
CREATE INDEX IF NOT EXISTS idx_universities_dual_first_class ON public.universities(is_dual_first_class) WHERE is_dual_first_class = TRUE;
CREATE INDEX IF NOT EXISTS idx_universities_school_type ON public.universities(school_type);
CREATE INDEX IF NOT EXISTS idx_universities_province_city ON public.universities(province, city);
CREATE INDEX IF NOT EXISTS idx_universities_name_trgm ON public.universities USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_universities_data_source ON public.universities(data_source);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. 扩展 majors 表
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.majors
  ADD COLUMN IF NOT EXISTS major_code TEXT,
  ADD COLUMN IF NOT EXISTS discipline_category TEXT,
  ADD COLUMN IF NOT EXISTS gender_ratio TEXT,
  ADD COLUMN IF NOT EXISTS employment_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS employment_rates JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS what_description TEXT,
  ADD COLUMN IF NOT EXISTS study_description TEXT,
  ADD COLUMN IF NOT EXISTS career_description TEXT,
  ADD COLUMN IF NOT EXISTS core_courses TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS graduate_paths TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notable_alumni TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS offering_schools JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'seed',
  ADD COLUMN IF NOT EXISTS data_year INTEGER DEFAULT 2023,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_majors_code ON public.majors(major_code);
CREATE INDEX IF NOT EXISTS idx_majors_discipline ON public.majors(discipline_category);
CREATE INDEX IF NOT EXISTS idx_majors_name_trgm ON public.majors USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_majors_data_source ON public.majors(data_source);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. university_rankings 表
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.university_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  university_name TEXT NOT NULL,
  source TEXT NOT NULL,
  year INTEGER NOT NULL,
  rank INTEGER,
  score NUMERIC(8,2),
  tags TEXT[] DEFAULT '{}',
  region TEXT,
  type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(university_name, source, year)
);

CREATE INDEX IF NOT EXISTS idx_rankings_source_year ON public.university_rankings(source, year);
CREATE INDEX IF NOT EXISTS idx_rankings_university ON public.university_rankings(university_id, year);
CREATE INDEX IF NOT EXISTS idx_rankings_name_trgm ON public.university_rankings USING gin(university_name gin_trgm_ops);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. discipline_evaluations 表
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.discipline_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  university_name TEXT NOT NULL,
  discipline_name TEXT NOT NULL,
  evaluation_round TEXT NOT NULL,
  rating TEXT NOT NULL,
  ranking_position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(university_name, discipline_name, evaluation_round)
);

CREATE INDEX IF NOT EXISTS idx_disc_eval_university ON public.discipline_evaluations(university_id);
CREATE INDEX IF NOT EXISTS idx_disc_eval_discipline ON public.discipline_evaluations(discipline_name);
CREATE INDEX IF NOT EXISTS idx_disc_eval_rating ON public.discipline_evaluations(rating) WHERE rating IN ('A+', 'A', 'A-');

-- ──────────────────────────────────────────────────────────────────────────
-- 5. major_salary_data 表（专业薪酬时间序列）
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.major_salary_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  major_id UUID REFERENCES public.majors(id) ON DELETE SET NULL,
  major_name TEXT NOT NULL,
  year INTEGER NOT NULL,
  avg_monthly_salary INTEGER,
  median_monthly_salary INTEGER,
  sample_size INTEGER,
  top_industries JSONB DEFAULT '[]',
  top_cities JSONB DEFAULT '[]',
  top_occupations JSONB DEFAULT '[]',
  data_source TEXT DEFAULT 'excel',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(major_name, year)
);

CREATE INDEX IF NOT EXISTS idx_major_salary_major ON public.major_salary_data(major_id, year DESC);
CREATE INDEX IF NOT EXISTS idx_major_salary_name ON public.major_salary_data(major_name);

-- ──────────────────────────────────────────────────────────────────────────
-- 6. RLS 策略
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.university_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_salary_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "university_rankings_select" ON public.university_rankings FOR SELECT USING (true);
CREATE POLICY "discipline_evaluations_select" ON public.discipline_evaluations FOR SELECT USING (true);
CREATE POLICY "major_salary_data_select" ON public.major_salary_data FOR SELECT USING (true);

CREATE POLICY "university_rankings_insert" ON public.university_rankings
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
CREATE POLICY "discipline_evaluations_insert" ON public.discipline_evaluations
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');
CREATE POLICY "major_salary_data_insert" ON public.major_salary_data
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- ──────────────────────────────────────────────────────────────────────────
-- 7. unified_search() 统一检索函数
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION unified_search(
  query_text TEXT,
  search_mode TEXT DEFAULT 'all',
  filters JSONB DEFAULT '{}',
  match_limit INT DEFAULT 20
) RETURNS TABLE (
  result_type TEXT,
  result_id UUID,
  title TEXT,
  content TEXT,
  metadata JSONB,
  relevance_score FLOAT
) AS $$
BEGIN
  -- 结构化: 院校
  IF search_mode IN ('structured', 'all') THEN
    RETURN QUERY
    SELECT
      'university'::TEXT AS result_type,
      u.id AS result_id,
      u.name AS title,
      COALESCE(u.description, '')::TEXT AS content,
      jsonb_build_object(
        'province', u.province, 'city', u.city, 'tier', u.tier,
        'is_985', u.is_985, 'is_211', u.is_211,
        'is_dual_first_class', u.is_dual_first_class,
        'school_type', u.school_type, 'tags', u.tags
      ) AS metadata,
      GREATEST(
        similarity(u.name, query_text),
        word_similarity(query_text, u.name)
      )::double precision AS relevance_score
    FROM public.universities u
    WHERE (u.name ILIKE '%' || query_text || '%'
           OR similarity(u.name, query_text) > 0.1
           OR u.description ILIKE '%' || query_text || '%')
      AND (filters->>'province' IS NULL OR u.province = filters->>'province')
      AND (filters->>'tier' IS NULL OR u.tier = filters->>'tier')
      AND (filters->>'is_985' IS NULL OR u.is_985 = (filters->>'is_985')::boolean)
      AND (filters->>'is_211' IS NULL OR u.is_211 = (filters->>'is_211')::boolean)
    ORDER BY relevance_score DESC
    LIMIT match_limit / 3;
  END IF;

  -- 结构化: 专业
  IF search_mode IN ('structured', 'all') THEN
    RETURN QUERY
    SELECT
      'major'::TEXT AS result_type,
      m.id AS result_id,
      m.name AS title,
      COALESCE(m.description, m.career_description, '')::TEXT AS content,
      jsonb_build_object(
        'category', m.category, 'discipline_category', m.discipline_category,
        'degree', m.degree, 'employment_rate', m.employment_rate
      ) AS metadata,
      GREATEST(
        similarity(m.name, query_text),
        word_similarity(query_text, m.name)
      )::double precision AS relevance_score
    FROM public.majors m
    WHERE (m.name ILIKE '%' || query_text || '%'
           OR similarity(m.name, query_text) > 0.1
           OR m.description ILIKE '%' || query_text || '%')
      AND (filters->>'category' IS NULL OR m.category = filters->>'category')
    ORDER BY relevance_score DESC
    LIMIT match_limit / 3;
  END IF;

  -- 知识库文本
  IF search_mode IN ('knowledge', 'all') THEN
    RETURN QUERY
    SELECT
      'knowledge_chunk'::TEXT AS result_type,
      kc.id AS result_id,
      kd.title AS title,
      kc.content AS content,
      jsonb_build_object(
        'collection', kd.collection, 'source_url', kd.source_url,
        'doc_metadata', kd.metadata
      ) AS metadata,
      GREATEST(
        similarity(kc.content, query_text),
        word_similarity(query_text, kc.content)
      )::double precision AS relevance_score
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kd.id = kc.document_id
    WHERE (kc.content ILIKE '%' || query_text || '%'
           OR similarity(kc.content, query_text) > 0.05)
      AND (filters->>'collection' IS NULL OR kd.collection = filters->>'collection')
    ORDER BY relevance_score DESC
    LIMIT match_limit / 3;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ──────────────────────────────────────────────────────────────────────────
-- 验证
-- ──────────────────────────────────────────────────────────────────────────

SELECT 'Migration 012 (Structured Data Expansion) complete!' AS status;
