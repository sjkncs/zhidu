-- ============================================================================
-- Zhidu Initial Schema Migration
-- Phase 1: User system + Core tables
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables that might conflict (Supabase defaults, previous runs)
DROP TABLE IF EXISTS public.plan_items CASCADE;
DROP TABLE IF EXISTS public.application_plans CASCADE;
DROP TABLE IF EXISTS public.assessments CASCADE;
DROP TABLE IF EXISTS public.admission_scores CASCADE;
DROP TABLE IF EXISTS public.majors CASCADE;
DROP TABLE IF EXISTS public.universities CASCADE;
DROP TABLE IF EXISTS public.career_paths CASCADE;
DROP TABLE IF EXISTS public.goals CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.skill_nodes CASCADE;
DROP TABLE IF EXISTS public.skill_trees CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.folders CASCADE;
DROP TABLE IF EXISTS public.resumes CASCADE;
DROP TABLE IF EXISTS public.internships CASCADE;
DROP TABLE IF EXISTS public.research_projects CASCADE;
DROP TABLE IF EXISTS public.papers CASCADE;
DROP TABLE IF EXISTS public.schedule_events CASCADE;
DROP TABLE IF EXISTS public.todos CASCADE;
DROP TABLE IF EXISTS public.memos CASCADE;
DROP TABLE IF EXISTS public.diary_entries CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_settings_created ON auth.users;

-- ============================================================================
-- Helper: updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. profiles — extends Supabase auth.users with app-specific data
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  province TEXT,
  grade TEXT,
  total_score INTEGER,
  subject_scores JSONB DEFAULT '{}',
  subject_combination JSONB,
  track TEXT CHECK (track IN ('文', '理')),
  rank INTEGER,
  interests TEXT[] DEFAULT '{}',
  target_cities TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
-- Allow insert on signup (trigger handles this)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile row on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 2. user_settings — theme, notification, enabled modules
-- ============================================================================
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled_modules TEXT[] DEFAULT '{VOLUNTEER,CAREER,ACADEMIC,EMPLOYMENT,LIFESTYLE,AI_ASSISTANT}',
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  notification_prefs JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
  ON public.user_settings FOR ALL USING (auth.uid() = user_id);

-- Auto-create settings on signup
CREATE OR REPLACE FUNCTION handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_settings_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_settings();

-- ============================================================================
-- 3. universities — college/university reference data
-- ============================================================================
CREATE TABLE public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('985', '211', '双一流', '普通本科', '专科')),
  is_public BOOLEAN DEFAULT TRUE,
  website TEXT,
  logo TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_universities_province ON public.universities(province);
CREATE INDEX idx_universities_tier ON public.universities(tier);
CREATE INDEX idx_universities_name ON public.universities USING gin(to_tsvector('simple', name));

-- Universities are public read-only data
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Universities are publicly readable"
  ON public.universities FOR SELECT USING (true);

-- ============================================================================
-- 4. majors — academic major reference data
-- ============================================================================
CREATE TABLE public.majors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  duration INTEGER DEFAULT 4,
  degree TEXT DEFAULT '学士',
  subject_requirements TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_majors_category ON public.majors(category);

ALTER TABLE public.majors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Majors are publicly readable"
  ON public.majors FOR SELECT USING (true);

-- ============================================================================
-- 5. admission_scores — historical admission score data
-- ============================================================================
CREATE TABLE public.admission_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  major_id UUID REFERENCES public.majors(id) ON DELETE SET NULL,
  province TEXT NOT NULL,
  year INTEGER NOT NULL,
  min_score INTEGER NOT NULL,
  avg_score INTEGER,
  min_rank INTEGER,
  batch TEXT,
  UNIQUE(university_id, major_id, province, year)
);

CREATE INDEX idx_admission_scores_lookup
  ON public.admission_scores(university_id, province, year);
CREATE INDEX idx_admission_scores_province_year
  ON public.admission_scores(province, year);

ALTER TABLE public.admission_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admission scores are publicly readable"
  ON public.admission_scores FOR SELECT USING (true);

-- ============================================================================
-- 6. assessments — MBTI, Holland, etc.
-- ============================================================================
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('MBTI', 'HOLLAND', 'VALUES', 'ABILITY', 'CUSTOM')),
  raw_scores JSONB,
  result JSONB NOT NULL,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX idx_assessments_user ON public.assessments(user_id, type);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own assessments"
  ON public.assessments FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 7. application_plans — volunteer recommendation plans
-- ============================================================================
CREATE TABLE public.application_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  province TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'FINALIZED', 'SUBMITTED')),
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER application_plans_updated_at
  BEFORE UPDATE ON public.application_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_application_plans_user ON public.application_plans(user_id);

ALTER TABLE public.application_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own plans"
  ON public.application_plans FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 8. plan_items — individual volunteer entries within a plan
-- ============================================================================
CREATE TABLE public.plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.application_plans(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id),
  major_id UUID REFERENCES public.majors(id),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('RUSH', 'STABLE', 'SAFE')),
  historical_avg_score REAL,
  estimated_probability REAL CHECK (estimated_probability >= 0 AND estimated_probability <= 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  remark TEXT
);

CREATE INDEX idx_plan_items_plan ON public.plan_items(plan_id, sort_order);

ALTER TABLE public.plan_items ENABLE ROW LEVEL SECURITY;
-- Plan items inherit access from parent plan
CREATE POLICY "Users can manage plan items via plan ownership"
  ON public.plan_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.application_plans
      WHERE application_plans.id = plan_items.plan_id
      AND application_plans.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 9. career_paths — career planning routes
-- ============================================================================
CREATE TABLE public.career_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role TEXT NOT NULL,
  target_industry TEXT,
  stage TEXT DEFAULT 'EXPLORING' CHECK (stage IN ('EXPLORING', 'PLANNING', 'PREPARING', 'ACTIVE')),
  milestones JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER career_paths_updated_at
  BEFORE UPDATE ON public.career_paths
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.career_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own career paths"
  ON public.career_paths FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 10. goals — short/long-term goals
-- ============================================================================
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'OTHER' CHECK (category IN ('ACADEMIC', 'CAREER', 'LIFESTYLE', 'OTHER')),
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  completed BOOLEAN DEFAULT FALSE,
  deadline DATE,
  parent_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own goals"
  ON public.goals FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 11. courses — course management
-- ============================================================================
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  credit REAL DEFAULT 0,
  grade TEXT,
  semester TEXT,
  category TEXT DEFAULT 'required',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own courses"
  ON public.courses FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 12. todos — task management
-- ============================================================================
CREATE TABLE public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 2 CHECK (priority >= 1 AND priority <= 4),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_todos_user_active ON public.todos(user_id) WHERE NOT completed;

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own todos"
  ON public.todos FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 13. diary_entries — daily journal with mood tracking
-- ============================================================================
CREATE TABLE public.diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  mood INTEGER CHECK (mood >= 1 AND mood <= 10),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_diary_entries_user_date ON public.diary_entries(user_id, entry_date DESC);

ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own diary"
  ON public.diary_entries FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 14. memos — quick notes
-- ============================================================================
CREATE TABLE public.memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  remind_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memos_user ON public.memos(user_id, created_at DESC);

ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own memos"
  ON public.memos FOR ALL USING (auth.uid() = user_id);
