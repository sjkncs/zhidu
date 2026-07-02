-- ============================================================================
-- 合并迁移脚本: Migration 010 + 015
-- 用途: 在 Supabase Dashboard SQL Editor 中一次性执行
-- 包含: admission_scores 增强 + score_rank_tables + province_score_lines +
--       employment_salaries + major_groups + 科类索引回填
-- ============================================================================

-- ============================================================================
-- Part 1: admission_scores 增强 (原 Migration 010)
-- ============================================================================

-- 1a. 新增列（全部 IF NOT EXISTS，幂等安全）
ALTER TABLE public.admission_scores
  ADD COLUMN IF NOT EXISTS major_group_name TEXT,
  ADD COLUMN IF NOT EXISTS subject_group TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS max_score INTEGER,
  ADD COLUMN IF NOT EXISTS enrollment_count INTEGER;

-- score_type 列需要单独处理（CHECK 约束可能已存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admission_scores' AND column_name = 'score_type'
  ) THEN
    ALTER TABLE public.admission_scores
      ADD COLUMN score_type TEXT DEFAULT 'raw'
        CHECK (score_type IN ('raw', 'composite', 'converted'));
  END IF;
END $$;

-- 1b. 索引（IF NOT EXISTS，幂等安全）
CREATE INDEX IF NOT EXISTS idx_admission_province_year_rank
  ON public.admission_scores(province, year, min_rank)
  WHERE min_rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admission_major_province
  ON public.admission_scores(major_id, province, year DESC)
  WHERE major_id IS NOT NULL;

-- ============================================================================
-- Part 2: province_score_lines 省控线表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.province_score_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province TEXT NOT NULL,
  year INTEGER NOT NULL,
  batch TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  score_line INTEGER NOT NULL,
  total_candidates INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(province, year, batch, subject_type)
);

CREATE INDEX IF NOT EXISTS idx_province_score_lines_lookup
  ON public.province_score_lines(province, year, subject_type);

-- ============================================================================
-- Part 3: employment_salaries 就业薪资表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employment_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  major_id UUID REFERENCES public.majors(id),
  major_name TEXT,
  city TEXT,
  province TEXT,
  avg_salary INTEGER,
  median_salary INTEGER,
  p25_salary INTEGER,
  p75_salary INTEGER,
  data_year INTEGER NOT NULL,
  sample_size INTEGER,
  source TEXT DEFAULT 'survey',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employment_major
  ON public.employment_salaries(major_id, data_year DESC);

CREATE INDEX IF NOT EXISTS idx_employment_city
  ON public.employment_salaries(city, data_year DESC)
  WHERE city IS NOT NULL;

-- ============================================================================
-- Part 4: score_rank_tables 一分一段表（位次法核心）
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.score_rank_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province TEXT NOT NULL,
  year INTEGER NOT NULL,
  subject_type TEXT NOT NULL,
  score INTEGER NOT NULL,
  count_at_score INTEGER NOT NULL,
  cumulative_rank INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(province, year, subject_type, score)
);

CREATE INDEX IF NOT EXISTS idx_score_rank_lookup
  ON public.score_rank_tables(province, year, subject_type, score);

-- ============================================================================
-- Part 5: major_groups 院校专业组映射
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.major_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id),
  group_name TEXT NOT NULL,
  province TEXT NOT NULL,
  year INTEGER NOT NULL,
  subject_requirements TEXT,
  major_ids UUID[] DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_major_groups_uni_province
  ON public.major_groups(university_id, province, year DESC);

-- ============================================================================
-- Part 6: 科类支持 (原 Migration 015)
-- ============================================================================

-- 6a. subject_group 索引
CREATE INDEX IF NOT EXISTS idx_admission_subject_group
  ON public.admission_scores(province, year, subject_group)
  WHERE subject_group IS NOT NULL;

-- 6b. score_rank_tables 覆盖索引（含 cumulative_rank 和 count_at_score）
DROP INDEX IF EXISTS idx_score_rank_lookup;
CREATE INDEX IF NOT EXISTS idx_score_rank_lookup
  ON public.score_rank_tables(province, year, subject_type, score)
  INCLUDE (cumulative_rank, count_at_score);

-- 6c. province_score_lines 索引（已在 Part 2 创建，这里幂等重复无影响）

-- 6d. 回填 admission_scores: 根据批次名称推断科类
UPDATE public.admission_scores
SET subject_group = CASE
  WHEN batch LIKE '%理%' THEN '理科'
  WHEN batch LIKE '%文%' THEN '文科'
  ELSE NULL
END
WHERE subject_group IS NULL
  AND batch IS NOT NULL;

-- 6e. recommend API 快速查询索引
CREATE INDEX IF NOT EXISTS idx_admission_province_year_score
  ON public.admission_scores(province, year, min_score)
  INCLUDE (min_rank, subject_group, batch);

-- ============================================================================
-- 完成！验证查询（可单独运行确认）
-- ============================================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'admission_scores' ORDER BY ordinal_position;
-- SELECT COUNT(*) FROM score_rank_tables;
-- SELECT COUNT(*) FROM province_score_lines;
