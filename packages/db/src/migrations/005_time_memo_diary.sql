-- Migration 005: Time Management + Memos + Diary enhancements (Phase 7)

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. NEW TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Schedule events (calendar)
CREATE TABLE IF NOT EXISTS schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  event_type TEXT NOT NULL DEFAULT 'GENERAL'
    CHECK (event_type IN ('GENERAL','STUDY','EXAM','MEETING','PERSONAL','DEADLINE')),
  recurrence TEXT, -- JSON: { frequency: 'daily'|'weekly'|'monthly', until: date, count: int }
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_events_user ON schedule_events(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_time ON schedule_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_schedule_events_type ON schedule_events(user_id, event_type);

-- Pomodoro sessions
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 25 CHECK (duration_minutes BETWEEN 1 AND 120),
  completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_pomodoro_user ON pomodoro_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_date ON pomodoro_sessions(user_id, started_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ENHANCE EXISTING TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- todos: add parent_id (subtasks), tags, category
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todos' AND column_name = 'parent_id') THEN
    ALTER TABLE todos ADD COLUMN parent_id UUID REFERENCES todos(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todos' AND column_name = 'tags') THEN
    ALTER TABLE todos ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todos' AND column_name = 'category') THEN
    ALTER TABLE todos ADD COLUMN category TEXT NOT NULL DEFAULT 'GENERAL'
      CHECK (category IN ('STUDY','WORK','PERSONAL','HEALTH','GENERAL'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todos' AND column_name = 'sort_order') THEN
    ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id);
CREATE INDEX IF NOT EXISTS idx_todos_category ON todos(user_id, category);
CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(user_id, due_date);

-- diary_entries: add mood_tags
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diary_entries' AND column_name = 'mood_tags') THEN
    ALTER TABLE diary_entries ADD COLUMN mood_tags TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diary_entries' AND column_name = 'updated_at') THEN
    ALTER TABLE diary_entries ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_diary_date ON diary_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_diary_mood ON diary_entries(user_id, mood);

-- memos: add is_archived, content_type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memos' AND column_name = 'is_archived') THEN
    ALTER TABLE memos ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memos' AND column_name = 'title') THEN
    ALTER TABLE memos ADD COLUMN title TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memos' AND column_name = 'updated_at') THEN
    ALTER TABLE memos ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_memos_pinned ON memos(user_id, is_pinned);
CREATE INDEX IF NOT EXISTS idx_memos_archived ON memos(user_id, is_archived);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedule_events' AND policyname = 'Users manage own schedule_events') THEN
    CREATE POLICY "Users manage own schedule_events" ON schedule_events FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pomodoro_sessions' AND policyname = 'Users manage own pomodoro_sessions') THEN
    CREATE POLICY "Users manage own pomodoro_sessions" ON pomodoro_sessions FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. TRIGGERS (updated_at)
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_schedule_events_updated ON schedule_events;
CREATE TRIGGER trg_schedule_events_updated
  BEFORE UPDATE ON schedule_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_diary_entries_updated ON diary_entries;
CREATE TRIGGER trg_diary_entries_updated
  BEFORE UPDATE ON diary_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_memos_updated ON memos;
CREATE TRIGGER trg_memos_updated
  BEFORE UPDATE ON memos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
