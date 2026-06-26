-- Migration 004: Skill Trees + Skill Nodes (hierarchical skill tracking)

-- Skill trees: top-level groupings (per user, AI-generated or manual)
CREATE TABLE IF NOT EXISTS skill_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'CUSTOM'
    CHECK (category IN ('TECH','SOFT','LANGUAGE','CERTIFICATE','CUSTOM')),
  source_major TEXT,
  source_career TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_trees_user ON skill_trees(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_trees_category ON skill_trees(user_id, category);

-- Skill nodes: individual skills within a tree (hierarchical, max 3 levels)
CREATE TABLE IF NOT EXISTS skill_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_tree_id UUID NOT NULL REFERENCES skill_trees(id) ON DELETE CASCADE,
  parent_node_id UUID REFERENCES skill_nodes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  difficulty INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  prerequisites TEXT[] DEFAULT '{}',
  resources JSONB DEFAULT '[]'::jsonb,
  estimated_hours NUMERIC(5,1),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 1 CHECK (depth BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_nodes_tree ON skill_nodes(skill_tree_id);
CREATE INDEX IF NOT EXISTS idx_skill_nodes_parent ON skill_nodes(parent_node_id);

-- RLS
ALTER TABLE skill_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_nodes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'skill_trees' AND policyname = 'Users manage own skill_trees') THEN
    CREATE POLICY "Users manage own skill_trees" ON skill_trees FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'skill_nodes' AND policyname = 'Users manage own skill_nodes') THEN
    CREATE POLICY "Users manage own skill_nodes" ON skill_nodes FOR ALL
      USING (auth.uid() = (SELECT user_id FROM skill_trees WHERE id = skill_tree_id));
  END IF;
END $$;

-- Auto-update updated_at
DROP TRIGGER IF EXISTS trg_skill_trees_updated ON skill_trees;
CREATE TRIGGER trg_skill_trees_updated
  BEFORE UPDATE ON skill_trees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_skill_nodes_updated ON skill_nodes;
CREATE TRIGGER trg_skill_nodes_updated
  BEFORE UPDATE ON skill_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-compute depth from parent (same pattern as goals)
CREATE OR REPLACE FUNCTION check_skill_node_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_depth INTEGER;
BEGIN
  IF NEW.parent_node_id IS NOT NULL THEN
    SELECT depth INTO parent_depth FROM skill_nodes WHERE id = NEW.parent_node_id;
    IF parent_depth IS NULL THEN
      RAISE EXCEPTION 'Parent skill node not found';
    END IF;
    NEW.depth := parent_depth + 1;
    IF NEW.depth > 3 THEN
      RAISE EXCEPTION 'Skill node hierarchy cannot exceed 3 levels';
    END IF;
  ELSE
    NEW.depth := 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_skill_node_depth ON skill_nodes;
CREATE TRIGGER trg_skill_node_depth
  BEFORE INSERT OR UPDATE OF parent_node_id ON skill_nodes
  FOR EACH ROW EXECUTE FUNCTION check_skill_node_depth();

-- Auto-set completed when progress reaches 100
CREATE OR REPLACE FUNCTION check_skill_node_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.progress >= 100 AND NOT NEW.completed THEN
    NEW.completed := true;
    NEW.completed_at := now();
  ELSIF NEW.progress < 100 AND NEW.completed THEN
    NEW.completed := false;
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_skill_node_completion ON skill_nodes;
CREATE TRIGGER trg_skill_node_completion
  BEFORE INSERT OR UPDATE OF progress ON skill_nodes
  FOR EACH ROW EXECUTE FUNCTION check_skill_node_completion();
