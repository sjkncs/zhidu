-- ============================================================================
-- Zhidu Billing & Quota Management System
-- 全链路额度/订单/订阅/API调用管理
-- ============================================================================

-- ============================================================================
-- 1. subscription_plans — 订阅套餐定义
-- ============================================================================
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,               -- '免费版' / '基础版' / '专业版'
  slug TEXT NOT NULL UNIQUE,        -- 'free' / 'basic' / 'pro'
  description TEXT,
  price_monthly INTEGER NOT NULL DEFAULT 0,     -- 月付价格（分）
  price_yearly INTEGER NOT NULL DEFAULT 0,      -- 年付价格（分）
  ai_credits_monthly INTEGER NOT NULL DEFAULT 0, -- 每月 AI 额度
  max_chats_per_day INTEGER NOT NULL DEFAULT 0,  -- 每日对话上限 (0=无限)
  max_volunteer_plans INTEGER NOT NULL DEFAULT 0, -- 志愿方案上限
  max_research_projects INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,   -- 功能列表
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 2. user_subscriptions — 用户订阅记录
-- ============================================================================
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('TRIAL', 'ACTIVE', 'CANCELLED', 'EXPIRED', 'SUSPENDED')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  payment_method TEXT,                -- 'wechat' / 'alipay' / 'stripe'
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_user_active
  ON public.user_subscriptions(user_id)
  WHERE status IN ('ACTIVE', 'TRIAL');

CREATE TRIGGER user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 3. ai_credits — AI 额度余额表（每用户一行）
-- ============================================================================
CREATE TABLE public.ai_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_credits INTEGER NOT NULL DEFAULT 0,      -- 累计获得额度
  used_credits INTEGER NOT NULL DEFAULT 0,       -- 已消耗额度
  free_credits INTEGER NOT NULL DEFAULT 0,       -- 免费额度余额
  purchased_credits INTEGER NOT NULL DEFAULT 0,  -- 购买额度余额
  bonus_credits INTEGER NOT NULL DEFAULT 0,      -- 赠送额度余额
  monthly_quota INTEGER NOT NULL DEFAULT 0,      -- 当月配额
  monthly_used INTEGER NOT NULL DEFAULT 0,       -- 当月已用
  last_reset_at TIMESTAMPTZ,                     -- 上次月度重置
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER ai_credits_updated_at
  BEFORE UPDATE ON public.ai_credits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credits"
  ON public.ai_credits FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 4. ai_usage_logs — AI 调用日志（每次API调用记录一行）
-- ============================================================================
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,              -- 'chat' / 'volunteer' / 'career' / 'knowledge' / 'resume'
  action TEXT NOT NULL,              -- 'chat_message' / 'plan_generate' / 'rag_search' / 'resume_generate'
  credits_used INTEGER NOT NULL DEFAULT 0,
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  model TEXT,                         -- 使用的模型名称
  duration_ms INTEGER,               -- 请求耗时
  status TEXT NOT NULL DEFAULT 'SUCCESS'
    CHECK (status IN ('SUCCESS', 'FAILED', 'TIMEOUT', 'RATE_LIMITED')),
  error_message TEXT,
  request_metadata JSONB DEFAULT '{}'::jsonb,   -- 额外参数（session_id, query等）
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_logs_user_date
  ON public.ai_usage_logs(user_id, created_at DESC);

CREATE INDEX idx_ai_usage_logs_module
  ON public.ai_usage_logs(module, created_at DESC);

-- 管理后台用：按日聚合统计
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_usage_stats AS
SELECT
  DATE(created_at) AS usage_date,
  module,
  COUNT(*) AS total_calls,
  SUM(credits_used) AS total_credits,
  SUM(tokens_input + tokens_output) AS total_tokens,
  COUNT(DISTINCT user_id) AS unique_users,
  AVG(duration_ms)::INTEGER AS avg_duration_ms
FROM ai_usage_logs
WHERE status = 'SUCCESS'
GROUP BY DATE(created_at), module;

-- ============================================================================
-- 5. orders — 订单表（全链路订单管理）
-- ============================================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_no TEXT NOT NULL UNIQUE,     -- 业务订单号 (e.g. ZD202607060001)
  order_type TEXT NOT NULL
    CHECK (order_type IN ('SUBSCRIPTION', 'CREDITS', 'ONE_TIME')),
  plan_id UUID REFERENCES subscription_plans(id),
  product_name TEXT NOT NULL,        -- 商品名称
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,   -- 单价（分）
  amount INTEGER NOT NULL DEFAULT 0,       -- 订单总额（分）
  discount INTEGER NOT NULL DEFAULT 0,     -- 优惠金额（分）
  final_amount INTEGER NOT NULL DEFAULT 0, -- 实付金额（分）
  currency TEXT NOT NULL DEFAULT 'CNY',
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PAID', 'PROCESSING', 'COMPLETED',
                       'CANCELLED', 'FAILED', 'REFUNDING', 'REFUNDED')),
  payment_method TEXT,                 -- 'wechat' / 'alipay' / 'stripe'
  payment_no TEXT,                     -- 第三方支付流水号
  paid_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  refund_amount INTEGER DEFAULT 0,     -- 退款金额（分）
  refund_at TIMESTAMPTZ,
  refund_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,  -- 订单附加信息
  expires_at TIMESTAMPTZ,              -- 订单过期时间（30分钟未支付自动关闭）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_status
  ON public.orders(user_id, status);

CREATE INDEX idx_orders_created
  ON public.orders(created_at DESC);

CREATE INDEX idx_orders_order_no
  ON public.orders(order_no);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own orders"
  ON public.orders FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 6. payments — 支付流水表
-- ============================================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_no TEXT NOT NULL UNIQUE,    -- 支付流水号
  payment_method TEXT NOT NULL,       -- 'wechat' / 'alipay' / 'stripe'
  amount INTEGER NOT NULL,            -- 支付金额（分）
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CLOSED')),
  paid_at TIMESTAMPTZ,
  callback_data JSONB DEFAULT '{}'::jsonb,  -- 第三方回调原始数据
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order
  ON public.payments(order_id);

CREATE INDEX idx_payments_user
  ON public.payments(user_id, created_at DESC);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 7. feature_usage — 功能板块使用计数（按周期统计）
-- ============================================================================
CREATE TABLE public.feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,                -- 'chat' / 'volunteer' / 'career' 等
  feature TEXT NOT NULL,               -- 'ai_chat' / 'plan_generate' / 'resume_export' 等
  usage_count INTEGER NOT NULL DEFAULT 0,
  period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  period_end DATE,                     -- NULL=无限期
  limit_value INTEGER NOT NULL DEFAULT 0,  -- 0=无限
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, module, feature, period_start)
);

CREATE INDEX idx_feature_usage_user
  ON public.feature_usage(user_id, module);

CREATE TRIGGER feature_usage_updated_at
  BEFORE UPDATE ON public.feature_usage
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own feature usage"
  ON public.feature_usage FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- 8. 初始化订阅套餐数据
-- ============================================================================
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, ai_credits_monthly, max_chats_per_day, max_volunteer_plans, max_research_projects, features, sort_order) VALUES
  ('免费版', 'free', '基础功能体验，适合初次使用', 0, 0, 50, 20, 1, 0,
   '["AI 智能问答（每日20次）", "基础院校查询", "MBTI 性格测评", "1 份志愿方案草稿"]'::jsonb, 1),
  ('基础版', 'basic', '满足日常学业规划需求', 2900, 29000, 300, 100, 5, 3,
   '["AI 智能问答（每日100次）", "完整院校/专业库", "全部测评工具", "5 份志愿方案", "知识库 RAG 检索", "3 个科研项目"]'::jsonb, 2),
  ('专业版', 'pro', '全方位 AI 升学规划服务', 6900, 69000, 1000, 0, 0, 0,
   '["AI 无限对话", "全功能解锁", "不限志愿方案", "不限科研项目", "优先模型响应", "专属客服支持", "简历 AI 生成", "数据分析报告"]'::jsonb, 3);

-- ============================================================================
-- 9. 触发器：新用户注册时自动创建免费额度
-- ============================================================================
CREATE OR REPLACE FUNCTION on_auth_user_billing_created()
RETURNS TRIGGER AS $$
BEGIN
  -- 创建 AI 额度记录
  INSERT INTO public.ai_credits (user_id, free_credits, total_credits, monthly_quota)
  VALUES (NEW.id, 50, 50, 50);

  -- 创建免费试用订阅（7天）
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, billing_cycle, expires_at, trial_ends_at)
  SELECT NEW.id, id, 'TRIAL', 'monthly',
         NOW() + INTERVAL '7 days',
         NOW() + INTERVAL '7 days'
  FROM subscription_plans WHERE slug = 'free';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_billing_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION on_auth_user_billing_created();

-- ============================================================================
-- 10. 函数：扣减 AI 额度
-- ============================================================================
CREATE OR REPLACE FUNCTION deduct_ai_credits(
  p_user_id UUID,
  p_credits INTEGER,
  p_module TEXT,
  p_action TEXT,
  p_tokens_in INTEGER DEFAULT 0,
  p_tokens_out INTEGER DEFAULT 0,
  p_model TEXT DEFAULT NULL,
  p_duration INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN AS $$
DECLARE
  v_available INTEGER;
BEGIN
  -- 检查余额
  SELECT (free_credits + purchased_credits + bonus_credits +
          GREATEST(0, monthly_quota - monthly_used))
  INTO v_available
  FROM ai_credits WHERE user_id = p_user_id;

  IF v_available IS NULL OR v_available < p_credits THEN
    RETURN FALSE;
  END IF;

  -- 扣减额度（优先扣月度配额，再扣免费额度，最后扣购买额度）
  UPDATE ai_credits SET
    monthly_used = monthly_used + LEAST(p_credits, GREATEST(0, monthly_quota - monthly_used)),
    free_credits = free_credits - LEAST(p_credits - LEAST(p_credits, GREATEST(0, monthly_quota - monthly_used)), free_credits),
    used_credits = used_credits + p_credits,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 记录调用日志
  INSERT INTO ai_usage_logs (user_id, module, action, credits_used, tokens_input, tokens_output, model, duration_ms, request_metadata)
  VALUES (p_user_id, p_module, p_action, p_credits, p_tokens_in, p_tokens_out, p_model, p_duration, p_metadata);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 11. 函数：月度额度自动重置（由 pg_cron 调用）
-- ============================================================================
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
  UPDATE ai_credits ac SET
    monthly_used = 0,
    last_reset_at = NOW(),
    updated_at = NOW()
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = ac.user_id
    AND us.status IN ('ACTIVE', 'TRIAL')
    AND ac.monthly_used > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 12. 管理视图：用户+订阅+额度综合视图
-- ============================================================================
CREATE OR REPLACE VIEW admin_user_overview AS
SELECT
  u.id AS user_id,
  u.email,
  u.created_at AS registered_at,
  COALESCE(ac.total_credits, 0) AS total_credits,
  COALESCE(ac.used_credits, 0) AS used_credits,
  COALESCE(ac.free_credits + ac.purchased_credits + ac.bonus_credits, 0) AS available_credits,
  COALESCE(ac.monthly_quota, 0) AS monthly_quota,
  COALESCE(ac.monthly_used, 0) AS monthly_used,
  sp.name AS plan_name,
  sp.slug AS plan_slug,
  us.status AS subscription_status,
  us.expires_at AS subscription_expires,
  COALESCE(order_stats.total_orders, 0) AS total_orders,
  COALESCE(order_stats.total_spent, 0) AS total_spent,
  COALESCE(order_stats.last_order_at, u.created_at) AS last_order_at
FROM auth.users u
LEFT JOIN ai_credits ac ON ac.user_id = u.id
LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.status IN ('ACTIVE', 'TRIAL')
LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS total_orders,
         SUM(final_amount) AS total_spent,
         MAX(created_at) AS last_order_at
  FROM orders WHERE user_id = u.id AND status IN ('PAID', 'COMPLETED')
) order_stats ON true
ORDER BY u.created_at DESC;
