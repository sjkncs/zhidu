-- ============================================================================
-- Migration 010: 志愿算法升级 — 专业级数据 + 就业薪资 + 省控线
-- Phase 12: 对标高考数据通，构建确定性匹配引擎数据基础
-- ============================================================================

-- 1. 增强 admission_scores: 专业组 + 备注 + 科目组
ALTER TABLE public.admission_scores
  ADD COLUMN IF NOT EXISTS major_group_name TEXT,
  ADD COLUMN IF NOT EXISTS subject_group TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS max_score INTEGER,
  ADD COLUMN IF NOT EXISTS enrollment_count INTEGER,
  ADD COLUMN IF NOT EXISTS score_type TEXT DEFAULT 'raw'
    CHECK (score_type IN ('raw', 'composite', 'converted'));

-- 为位次法查询优化索引
CREATE INDEX IF NOT EXISTS idx_admission_province_year_rank
  ON public.admission_scores(province, year, min_rank)
  WHERE min_rank IS NOT NULL;

-- 为专业级查询优化
CREATE INDEX IF NOT EXISTS idx_admission_major_province
  ON public.admission_scores(major_id, province, year DESC)
  WHERE major_id IS NOT NULL;

-- 2. 省控线表（线差法基础数据）
CREATE TABLE IF NOT EXISTS public.province_score_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province TEXT NOT NULL,
  year INTEGER NOT NULL,
  batch TEXT NOT NULL,
  -- 科类: 理科/文科/物理类/历史类/综合
  subject_type TEXT NOT NULL,
  -- 批次控制线
  score_line INTEGER NOT NULL,
  -- 对应一分一段表的总人数
  total_candidates INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(province, year, batch, subject_type)
);

CREATE INDEX IF NOT EXISTS idx_province_score_lines_lookup
  ON public.province_score_lines(province, year, subject_type);

-- 3. 就业薪资数据表
CREATE TABLE IF NOT EXISTS public.employment_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  major_id UUID REFERENCES public.majors(id),
  -- 也支持直接文本（兼容非标准专业名）
  major_name TEXT,
  city TEXT,
  province TEXT,
  -- 薪资统计（月薪，单位：元）
  avg_salary INTEGER,
  median_salary INTEGER,
  p25_salary INTEGER,
  p75_salary INTEGER,
  -- 数据来源年份
  data_year INTEGER NOT NULL,
  -- 样本量
  sample_size INTEGER,
  -- 数据来源
  source TEXT DEFAULT 'survey',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employment_major
  ON public.employment_salaries(major_id, data_year DESC);

CREATE INDEX IF NOT EXISTS idx_employment_city
  ON public.employment_salaries(city, data_year DESC)
  WHERE city IS NOT NULL;

-- 4. 一分一段表（位次法核心数据）
CREATE TABLE IF NOT EXISTS public.score_rank_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province TEXT NOT NULL,
  year INTEGER NOT NULL,
  subject_type TEXT NOT NULL,
  score INTEGER NOT NULL,
  -- 该分数的人数
  count_at_score INTEGER NOT NULL,
  -- 该分数及以上的累计人数（即位次）
  cumulative_rank INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(province, year, subject_type, score)
);

CREATE INDEX IF NOT EXISTS idx_score_rank_lookup
  ON public.score_rank_tables(province, year, subject_type, score);

-- 5. 院校专业组映射（处理专业组 vs 专业的粒度问题）
CREATE TABLE IF NOT EXISTS public.major_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id),
  -- 专业组名称（如"计算机类"、"生物工程(基地班)"）
  group_name TEXT NOT NULL,
  -- 省份 + 年份（不同省份分组可能不同）
  province TEXT NOT NULL,
  year INTEGER NOT NULL,
  -- 科目要求
  subject_requirements TEXT,
  -- 包含的专业 ID 列表
  major_ids UUID[] DEFAULT '{}',
  -- 备注（基地班、中外合作等）
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_major_groups_uni_province
  ON public.major_groups(university_id, province, year DESC);
