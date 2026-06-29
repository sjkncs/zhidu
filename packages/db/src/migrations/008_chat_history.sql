-- ============================================================================
-- Migration 008: Chat History Persistence
-- Phase 10: AI 对话持久化
-- ============================================================================

-- ============================================================================
-- 1. chat_sessions — conversation sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /** Auto-generated from first user message */
  title TEXT DEFAULT '新对话',
  /** Dominant task type in this session */
  task_type TEXT DEFAULT 'GENERAL_CHAT',
  /** Number of messages in this session */
  message_count INTEGER DEFAULT 0,
  /** Last activity timestamp */
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user
  ON public.chat_sessions(user_id, last_active_at DESC);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat sessions"
  ON public.chat_sessions FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 2. chat_messages — individual messages within a session
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  /** RAG sources (JSONB array of {title, snippet, score}) */
  sources JSONB DEFAULT '[]',
  /** Task type at time of message */
  task_type TEXT DEFAULT 'GENERAL_CHAT',
  /** Approximate token count */
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON public.chat_messages(session_id, created_at ASC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat messages inherit access from parent session
CREATE POLICY "Users can manage chat messages via session ownership"
  ON public.chat_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. Auto-update session metadata on message insert
-- ============================================================================
CREATE OR REPLACE FUNCTION update_chat_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_sessions
  SET
    message_count = message_count + 1,
    last_active_at = NOW(),
    -- Auto-set title from first user message
    title = CASE
      WHEN NEW.role = 'user' AND message_count = 0
        THEN LEFT(NEW.content, 50)
      ELSE title
    END
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_chat_message_inserted
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_session_on_message();
