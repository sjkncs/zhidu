-- ============================================================================
-- Migration 007: University Management (Courses Enhancement + Semesters + GPA)
-- Phase 9: 学业管理模块
-- ============================================================================

-- ============================================================================
-- 1. Enhance courses table — add grade_point, teacher, notes; fix category
-- ============================================================================

-- Add new columns
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS grade_point NUMERIC(3,2);
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS teacher TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS notes TEXT;

-- Convert grade from TEXT to NUMERIC (store score 0-100)
-- First drop any existing default, then alter
ALTER TABLE public.courses ALTER COLUMN grade DROP DEFAULT;
ALTER TABLE public.courses ALTER COLUMN grade TYPE NUMERIC(5,1)
  USING (CASE
    WHEN grade ~ '^\d+(\.\d+)?$' THEN grade::NUMERIC
    ELSE NULL
  END);

-- Add CHECK constraint on grade (0-100)
ALTER TABLE public.courses ADD CONSTRAINT courses_grade_check
  CHECK (grade IS NULL OR (grade >= 0 AND grade <= 100));

-- Add CHECK on grade_point (0-5.0)
ALTER TABLE public.courses ADD CONSTRAINT courses_grade_point_check
  CHECK (grade_point IS NULL OR (grade_point >= 0 AND grade_point <= 5.0));

-- Add CHECK on credit (>= 0)
ALTER TABLE public.courses ADD CONSTRAINT courses_credit_check
  CHECK (credit >= 0);

-- Add index for semester filtering
CREATE INDEX IF NOT EXISTS idx_courses_user_semester
  ON public.courses(user_id, semester);

-- ============================================================================
-- 2. semesters — academic semester management
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER semesters_updated_at
  BEFORE UPDATE ON public.semesters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_semesters_user
  ON public.semesters(user_id, start_date DESC);

ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own semesters"
  ON public.semesters FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. GPA calculation function (Chinese 4.0 scale)
-- ============================================================================

-- Grade score to grade point conversion (百分制 → 绩点)
-- 90-100: 4.0, 85-89: 3.7, 82-84: 3.3, 78-81: 3.0, 75-77: 2.7,
-- 72-74: 2.3, 68-71: 2.0, 64-67: 1.5, 60-63: 1.0, <60: 0
CREATE OR REPLACE FUNCTION score_to_grade_point(score NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  IF score IS NULL THEN RETURN NULL; END IF;
  RETURN CASE
    WHEN score >= 90 THEN 4.0
    WHEN score >= 85 THEN 3.7
    WHEN score >= 82 THEN 3.3
    WHEN score >= 78 THEN 3.0
    WHEN score >= 75 THEN 2.7
    WHEN score >= 72 THEN 2.3
    WHEN score >= 68 THEN 2.0
    WHEN score >= 64 THEN 1.5
    WHEN score >= 60 THEN 1.0
    ELSE 0.0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate GPA for a user (weighted by credit)
CREATE OR REPLACE FUNCTION calculate_gpa(p_user_id UUID, p_semester TEXT DEFAULT NULL)
RETURNS TABLE (
  gpa NUMERIC,
  weighted_avg NUMERIC,
  total_credits NUMERIC,
  earned_credits NUMERIC,
  course_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(
      SUM(COALESCE(c.grade_point, score_to_grade_point(c.grade)) * c.credit)
      / NULLIF(SUM(c.credit), 0),
      0
    )::NUMERIC(4,2) AS gpa,
    COALESCE(
      SUM(c.grade * c.credit) / NULLIF(SUM(c.credit), 0),
      0
    )::NUMERIC(5,1) AS weighted_avg,
    COALESCE(SUM(c.credit), 0)::NUMERIC AS total_credits,
    COALESCE(
      SUM(CASE WHEN c.grade >= 60 OR c.grade_point > 0 THEN c.credit ELSE 0 END),
      0
    )::NUMERIC AS earned_credits,
    COUNT(*)::INTEGER AS course_count
  FROM public.courses c
  WHERE c.user_id = p_user_id
    AND (p_semester IS NULL OR c.semester = p_semester)
    AND (c.grade IS NOT NULL OR c.grade_point IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Auto-update grade_point when grade changes
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_fill_grade_point()
RETURNS TRIGGER AS $$
BEGIN
  -- If grade is set but grade_point is not, auto-calculate
  IF NEW.grade IS NOT NULL AND NEW.grade_point IS NULL THEN
    NEW.grade_point := score_to_grade_point(NEW.grade);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER courses_auto_grade_point
  BEFORE INSERT OR UPDATE OF grade ON public.courses
  FOR EACH ROW EXECUTE FUNCTION auto_fill_grade_point();
