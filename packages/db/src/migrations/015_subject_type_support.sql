-- ============================================================================
-- Migration 015: 科类支持 — admission_scores subject_group 回填 + 索引优化
-- Phase 20: 支持物理类/历史类/理科/文科区分
-- ============================================================================

-- 1. admission_scores 的 subject_group 列已在 migration 010 创建（TEXT），
--    这里为其添加索引并回填已有数据
CREATE INDEX IF NOT EXISTS idx_admission_subject_group
  ON public.admission_scores(province, year, subject_group)
  WHERE subject_group IS NOT NULL;

-- 2. score_rank_tables 已有 UNIQUE 约束 (province, year, subject_type, score)，
--    补充查询优化索引
CREATE INDEX IF NOT EXISTS idx_score_rank_lookup
  ON public.score_rank_tables(province, year, subject_type, score)
  INCLUDE (cumulative_rank, count_at_score);

-- 3. province_score_lines 补充索引
CREATE INDEX IF NOT EXISTS idx_province_score_lines_lookup
  ON public.province_score_lines(province, year, subject_type);

-- 4. 回填 admission_scores: 根据批次名称推断科类
--    对于没有 subject_group 的记录，根据 batch 字段推断
UPDATE public.admission_scores
SET subject_group = CASE
  WHEN batch LIKE '%理%' THEN '理科'
  WHEN batch LIKE '%文%' THEN '文科'
  ELSE NULL
END
WHERE subject_group IS NULL
  AND batch IS NOT NULL;

-- 5. 对于新高考省份（已知列表），将 NULL subject_group 标记为对应的科类
--    广东、湖北、湖南、江苏、福建、河北、辽宁、重庆 → 物理类/历史类
--    浙江、上海、北京、天津、山东、海南 → 综合
--    这里不强制设置，因为需要专业级别的选科要求才能精确分配
--    留给数据导入脚本处理

-- 6. 为 recommend API 添加快速查询索引
CREATE INDEX IF NOT EXISTS idx_admission_province_year_score
  ON public.admission_scores(province, year, min_score)
  INCLUDE (min_rank, subject_group, batch);
