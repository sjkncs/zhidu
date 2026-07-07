-- ============================================================================
-- Zhidu Enterprise Modules — 9大业务模块数据库
-- 数据平台 / 财务 / 品牌运营 / 营运支持 / 战略中心 / 客服 / 供应链 / 用户运营 / 信息中心
-- ============================================================================

-- ============================================================================
-- 1. 数据平台 (Data Platform) — 算法开发、数据质量、模型监控
-- ============================================================================

CREATE TABLE public.dp_model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- 'volunteer_match_v2', 'intent_classifier'
  version TEXT NOT NULL DEFAULT '1.0',
  model_type TEXT NOT NULL,              -- 'rule_engine' / 'llm' / 'ml' / 'hybrid'
  provider TEXT,                         -- 'deepseek' / 'glm' / 'xgboost' / 'custom'
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'testing', 'archived')),
  description TEXT,
  metrics JSONB DEFAULT '{}'::jsonb,     -- { accuracy, precision, recall, f1, latency_ms }
  config JSONB DEFAULT '{}'::jsonb,      -- 模型参数配置
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.dp_data_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- 'eol_crawler', 'score_ingestion', 'knowledge_seed'
  pipeline_type TEXT NOT NULL,           -- 'etl' / 'crawler' / 'ingestion' / 'transform'
  schedule TEXT,                         -- cron表达式
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'failed', 'completed')),
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,                  -- 'success' / 'failed' / 'partial'
  last_run_duration_ms INTEGER,
  records_processed INTEGER DEFAULT 0,
  error_log TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.dp_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  module TEXT NOT NULL,                  -- 'universities' / 'majors' / 'scores' / 'knowledge'
  total_records INTEGER NOT NULL DEFAULT 0,
  valid_records INTEGER NOT NULL DEFAULT 0,
  completeness NUMERIC(5,2) DEFAULT 0,   -- 完整率 %
  accuracy NUMERIC(5,2) DEFAULT 0,       -- 准确率 %
  freshness_hours INTEGER DEFAULT 0,     -- 数据新鲜度(小时)
  anomalies_detected INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. 财务 (Finance Pro) — 收入/支出/预算/现金流
-- ============================================================================

CREATE TABLE public.fin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- '支付宝', '微信', '银行卡', '现金'
  account_type TEXT NOT NULL DEFAULT 'bank' CHECK (account_type IN ('bank', 'cash', 'digital', 'credit')),
  balance INTEGER NOT NULL DEFAULT 0,    -- 余额(分)
  currency TEXT NOT NULL DEFAULT 'CNY',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.fin_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,                -- '餐饮', '交通', '学习', '娱乐'
  monthly_limit INTEGER NOT NULL DEFAULT 0,  -- 月预算(分)
  period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  period_end DATE,
  spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category, period_start)
);

CREATE TABLE public.fin_recurring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                   -- '房租', '订阅费', '工资'
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  category TEXT,
  next_due_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fin_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own fin_accounts" ON public.fin_accounts FOR ALL USING (auth.uid() = user_id);
ALTER TABLE public.fin_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own fin_budgets" ON public.fin_budgets FOR ALL USING (auth.uid() = user_id);
ALTER TABLE public.fin_recurring ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own fin_recurring" ON public.fin_recurring FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 3. 品牌运营 (Brand Operations) — 私域/网络/市场
-- ============================================================================

CREATE TABLE public.brand_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,                -- 'wechat', 'xiaohongshu', 'douyin', 'weibo', 'zhihu', 'bilibili'
  channel_name TEXT NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'social' CHECK (channel_type IN ('social', 'private_domain', 'marketplace', 'official')),
  followers INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  content_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  config JSONB DEFAULT '{}'::jsonb,      -- 账号配置/API keys
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.brand_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('content', 'ads', 'event', 'collaboration', 'seo')),
  channel_ids UUID[],
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
  budget INTEGER DEFAULT 0,              -- 预算(分)
  spent INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  kpi_targets JSONB DEFAULT '{}'::jsonb, -- { impressions, clicks, conversions, roi }
  kpi_actuals JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.brand_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES brand_channels(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES brand_campaigns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'post' CHECK (content_type IN ('post', 'article', 'video', 'story', 'livestream')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  publish_date TIMESTAMPTZ,
  metrics JSONB DEFAULT '{}'::jsonb,     -- { views, likes, comments, shares, saves }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.brand_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own brand_channels" ON public.brand_channels FOR ALL USING (auth.uid() = user_id);
ALTER TABLE public.brand_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own brand_campaigns" ON public.brand_campaigns FOR ALL USING (auth.uid() = user_id);
ALTER TABLE public.brand_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own brand_content" ON public.brand_content FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 4. 营运支持 (Operations Support) — SOP/任务/巡检
-- ============================================================================

CREATE TABLE public.ops_sop (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',  -- 'general' / 'study' / 'career' / 'daily'
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ order, title, description, checklist }]
  frequency TEXT DEFAULT 'once' CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  completion_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ops_checklist_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sop_id UUID REFERENCES ops_sop(id) ON DELETE CASCADE,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  results JSONB DEFAULT '[]'::jsonb,     -- [{ step_id, completed, notes }]
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ops_kpi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,               -- 'daily_active_minutes', 'tasks_completed'
  metric_value NUMERIC NOT NULL DEFAULT 0,
  target_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '次',
  period TEXT NOT NULL DEFAULT 'daily' CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly')),
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ops_sop ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ops_sop" ON public.ops_sop FOR ALL USING (auth.uid() = user_id);
ALTER TABLE public.ops_checklist_run ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ops_checklist_run" ON public.ops_checklist_run FOR ALL USING (auth.uid() = user_id);
ALTER TABLE public.ops_kpi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ops_kpi" ON public.ops_kpi FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 5. 战略中心 (Strategy Center) — OKR/里程碑/竞品
-- ============================================================================

CREATE TABLE public.strat_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  objective_type TEXT NOT NULL DEFAULT 'personal' CHECK (objective_type IN ('personal', 'academic', 'career', 'financial')),
  quarter TEXT,                            -- '2026-Q3'
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'deferred', 'cancelled')),
  progress NUMERIC(5,2) DEFAULT 0,
  parent_id UUID REFERENCES public.strat_objectives(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.strat_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES strat_objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'number' CHECK (metric_type IN ('number', 'percentage', 'boolean', 'milestone')),
  current_value NUMERIC DEFAULT 0,
  target_value NUMERIC NOT NULL DEFAULT 100,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'behind', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.strat_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objective_id UUID REFERENCES strat_objectives(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  priority INTEGER DEFAULT 2 CHECK (priority >= 1 AND priority <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.strat_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own objectives" ON public.strat_objectives FOR ALL USING (auth.uid() = user_id);
ALTER TABLE public.strat_key_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own key_results" ON public.strat_key_results FOR ALL USING (
  EXISTS (SELECT 1 FROM strat_objectives WHERE id = objective_id AND user_id = auth.uid())
);
ALTER TABLE public.strat_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own milestones" ON public.strat_milestones FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 6. 客服 (Customer Service) — 工单/满意度/FAQ
-- ============================================================================

CREATE TABLE public.cs_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'bug', 'feature_request', 'billing', 'account', 'data')),
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  assigned_to TEXT,
  resolution TEXT,
  satisfaction INTEGER CHECK (satisfaction >= 1 AND satisfaction <= 5),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cs_faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cs_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tickets" ON public.cs_tickets FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 7. 供应链 (Supply Chain) — 数据源/知识库/采集
-- ============================================================================

CREATE TABLE public.sc_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- '阳光高考', '各省考试院', '学科评估'
  source_type TEXT NOT NULL CHECK (source_type IN ('api', 'web_scrape', 'manual', 'file_import', 'partner')),
  url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'deprecated')),
  last_sync_at TIMESTAMPTZ,
  sync_frequency TEXT DEFAULT 'monthly',
  records_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.sc_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type TEXT NOT NULL,               -- 'universities' / 'majors' / 'scores' / 'rankings'
  total_records INTEGER NOT NULL DEFAULT 0,
  valid_records INTEGER NOT NULL DEFAULT 0,
  last_updated DATE,
  coverage_rate NUMERIC(5,2) DEFAULT 0,  -- 覆盖率 %
  quality_score NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.sc_procurement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,               -- 'API额度', '数据服务', '云服务器'
  vendor TEXT,
  amount INTEGER NOT NULL DEFAULT 0,     -- 金额(分)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'ordered', 'received', 'cancelled')),
  order_date DATE,
  delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sc_procurement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own procurement" ON public.sc_procurement FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 8. 用户运营 (User Operations) — 增长/留存/活跃/转化
-- ============================================================================

CREATE TABLE public.uo_funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,               -- 'signup', 'first_chat', 'first_plan', 'upgrade', 'refer'
  event_data JSONB DEFAULT '{}'::jsonb,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.uo_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_name TEXT NOT NULL,             -- '2026-06 Week1'
  cohort_date DATE NOT NULL,
  user_count INTEGER NOT NULL DEFAULT 0,
  retention_d1 NUMERIC(5,2) DEFAULT 0,   -- 次日留存率
  retention_d7 NUMERIC(5,2) DEFAULT 0,
  retention_d30 NUMERIC(5,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  avg_sessions NUMERIC(8,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.uo_user_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                     -- '高活跃用户', '付费用户', '沉默用户'
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb, -- { min_chats, has_subscription, days_active }
  user_count INTEGER DEFAULT 0,
  last_computed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uo_funnel_events_user_date ON public.uo_funnel_events(user_id, created_at DESC);
CREATE INDEX idx_uo_funnel_events_type ON public.uo_funnel_events(event_type, created_at DESC);

ALTER TABLE public.uo_funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own funnel_events" ON public.uo_funnel_events FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 9. 信息中心 (Information Center) — 公告/新闻/知识库
-- ============================================================================

CREATE TABLE public.ic_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'feature', 'maintenance', 'policy', 'event')),
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ic_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT,
  description TEXT,
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ic_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                    -- 'rss' / 'api' / 'manual'
  feed_url TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'news',
  last_fetched_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ic_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bookmarks" ON public.ic_bookmarks FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 聚合视图：企业运营总览
-- ============================================================================

CREATE OR REPLACE VIEW enterprise_overview AS
SELECT
  (SELECT COUNT(*) FROM auth.users) AS total_users,
  (SELECT COUNT(*) FROM dp_model_registry WHERE status = 'active') AS active_models,
  (SELECT COUNT(*) FROM dp_data_pipeline WHERE status = 'active') AS active_pipelines,
  (SELECT COALESCE(SUM(amount), 0) FROM fin_recurring WHERE type = 'INCOME' AND next_due_date >= date_trunc('month', CURRENT_DATE)) AS monthly_income,
  (SELECT COALESCE(SUM(amount), 0) FROM fin_recurring WHERE type = 'EXPENSE' AND next_due_date >= date_trunc('month', CURRENT_DATE)) AS monthly_expense,
  (SELECT COUNT(*) FROM brand_campaigns WHERE status = 'active') AS active_campaigns,
  (SELECT COUNT(*) FROM ops_sop WHERE is_active = TRUE) AS active_sops,
  (SELECT COUNT(*) FROM strat_objectives WHERE status = 'active') AS active_objectives,
  (SELECT COUNT(*) FROM cs_tickets WHERE status IN ('open', 'in_progress')) AS open_tickets,
  (SELECT COUNT(*) FROM sc_data_sources WHERE status = 'active') AS active_data_sources,
  (SELECT COUNT(*) FROM uo_funnel_events WHERE created_at >= CURRENT_DATE) AS today_events,
  (SELECT COUNT(*) FROM ic_announcements WHERE published_at IS NOT NULL AND (expires_at IS NULL OR expires_at > NOW())) AS live_announcements;
