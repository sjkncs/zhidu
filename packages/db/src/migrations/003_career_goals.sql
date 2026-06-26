-- Migration 003: Career paths + Goals (with hierarchy)

-- Career paths: LLM-generated career development paths
CREATE TABLE IF NOT EXISTS career_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role TEXT NOT NULL,
  target_industry TEXT,
  stage TEXT NOT NULL DEFAULT 'EXPLORING'
    CHECK (stage IN ('EXPLORING','PLANNING','PREPARING','ACTIVE')),
  salary_range TEXT,
  required_skills TEXT[] DEFAULT '{}',
  short_term_goals JSONB DEFAULT '[]'::jsonb,
  mid_term_goals JSONB DEFAULT '[]'::jsonb,
  long_term_goals JSONB DEFAULT '[]'::jsonb,
  industry_trends TEXT,
  match_score INTEGER DEFAULT 0,
  source_major TEXT,
  source_mbti TEXT,
  source_holland TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_paths_user ON career_paths(user_id);

-- Goals: hierarchical goal management (max 3 levels)
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'OTHER'
    CHECK (category IN ('ACADEMIC','CAREER','LIFESTYLE','OTHER')),
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  completed BOOLEAN NOT NULL DEFAULT false,
  deadline TIMESTAMPTZ,
  depth INTEGER NOT NULL DEFAULT 1 CHECK (depth BETWEEN 1 AND 3),
  sort_order INTEGER NOT NULL DEFAULT 0,
  career_path_id UUID REFERENCES career_paths(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(user_id, category);

-- RLS
ALTER TABLE career_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'career_paths' AND policyname = 'Users manage own career_paths') THEN
    CREATE POLICY "Users manage own career_paths" ON career_paths FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'goals' AND policyname = 'Users manage own goals') THEN
    CREATE POLICY "Users manage own goals" ON goals FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_career_paths_updated ON career_paths;
CREATE TRIGGER trg_career_paths_updated
  BEFORE UPDATE ON career_paths FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_goals_updated ON goals;
CREATE TRIGGER trg_goals_updated
  BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-compute depth from parent
CREATE OR REPLACE FUNCTION check_goal_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_depth INTEGER;
BEGIN
  IF NEW.parent_goal_id IS NOT NULL THEN
    SELECT depth INTO parent_depth FROM goals WHERE id = NEW.parent_goal_id;
    IF parent_depth IS NULL THEN
      RAISE EXCEPTION 'Parent goal not found';
    END IF;
    NEW.depth := parent_depth + 1;
    IF NEW.depth > 3 THEN
      RAISE EXCEPTION 'Goal hierarchy cannot exceed 3 levels';
    END IF;
  ELSE
    NEW.depth := 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_goal_depth ON goals;
CREATE TRIGGER trg_goal_depth
  BEFORE INSERT OR UPDATE OF parent_goal_id ON goals
  FOR EACH ROW EXECUTE FUNCTION check_goal_depth();
