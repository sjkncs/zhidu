-- ═══════════════════════════════════════════════════════════════════════════════
-- 知渡 · 资金流通基础设施迁移
-- fund_accounts: 用户资金账户（支持多账户：银行卡/支付宝/微信/投资账户）
-- fund_ledger: 资金流水台账（复式记账，记录所有资金变动）
-- 与现有模块关联: fin_accounts(财务) / orders(订单) / portfolios(资管)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. fund_accounts — 用户资金账户
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fund_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                              -- 账户名称: "主账户", "投资账户", "储蓄"
  account_type TEXT NOT NULL DEFAULT 'investment'
    CHECK (account_type IN ('bank', 'digital', 'investment', 'cash', 'credit')),
  channel TEXT,                                    -- 渠道: "alipay", "wechat", "bank_cmb", "broker"
  balance BIGINT NOT NULL DEFAULT 0,               -- 余额(分), 31万 = 31000000
  total_deposited BIGINT NOT NULL DEFAULT 0,       -- 累计入金
  total_withdrawn BIGINT NOT NULL DEFAULT 0,       -- 累计出金
  currency TEXT NOT NULL DEFAULT 'CNY',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'frozen', 'closed')),
  metadata JSONB DEFAULT '{}',                     -- 扩展信息: bank_name, card_last4 等
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_fund_accounts_user ON public.fund_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_accounts_user_default ON public.fund_accounts(user_id) WHERE is_default = TRUE;

-- RLS
ALTER TABLE public.fund_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own fund accounts" ON public.fund_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fund accounts" ON public.fund_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fund accounts" ON public.fund_accounts FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. fund_ledger — 资金流水台账
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fund_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.fund_accounts(id) ON DELETE CASCADE,
  -- 关联账户（用于转移: 从A账户到B账户）
  to_account_id UUID REFERENCES public.fund_accounts(id) ON DELETE SET NULL,

  -- 交易信息
  type TEXT NOT NULL
    CHECK (type IN ('deposit', 'withdraw', 'transfer_in', 'transfer_out', 'invest', 'divest', 'fee', 'dividend', 'refund')),
  amount BIGINT NOT NULL,                          -- 金额(分), 始终为正数
  balance_after BIGINT NOT NULL,                   -- 交易后余额(分)
  balance_before BIGINT NOT NULL,                  -- 交易前余额(分)

  -- 关联业务
  ref_type TEXT,                                   -- 关联类型: "order", "trade", "subscription", "manual"
  ref_id UUID,                                     -- 关联ID: order.id / trade.id 等
  ref_no TEXT,                                     -- 关联编号: order_no / payment_no

  -- 描述
  title TEXT NOT NULL,                             -- "入金", "购买股票", "转账到投资账户"
  description TEXT,
  channel TEXT,                                    -- 支付渠道: "alipay", "wechat", "bank", "internal"

  -- 元数据
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_fund_ledger_user ON public.fund_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_ledger_account ON public.fund_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_fund_ledger_type ON public.fund_ledger(user_id, type);
CREATE INDEX IF NOT EXISTS idx_fund_ledger_created ON public.fund_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_ledger_ref ON public.fund_ledger(ref_type, ref_id);

-- RLS
ALTER TABLE public.fund_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ledger" ON public.fund_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ledger" ON public.fund_ledger FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. fund_channels — 支付/投资渠道配置（仅展示用，不引发法务风险）
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fund_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                              -- "招商银行储蓄", "支付宝", "微信"
  channel_type TEXT NOT NULL
    CHECK (channel_type IN ('bank', 'payment', 'broker', 'crypto', 'other')),
  provider TEXT NOT NULL,                           -- "cmb", "alipay", "wechat", "eastmoney"
  account_hint TEXT,                               -- 脱敏账号: "****1234"
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  daily_limit BIGINT,                              -- 日限额(分)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_channels_user ON public.fund_channels(user_id);

ALTER TABLE public.fund_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own channels" ON public.fund_channels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own channels" ON public.fund_channels FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 函数: 资金操作原子函数
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. 入金（充值/注入资金）
CREATE OR REPLACE FUNCTION public.fund_deposit(
  p_user_id UUID,
  p_account_id UUID,
  p_amount BIGINT,
  p_title TEXT DEFAULT '入金',
  p_description TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL,
  p_ref_type TEXT DEFAULT 'manual',
  p_ref_id UUID DEFAULT NULL,
  p_ref_no TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before BIGINT;
  v_balance_after BIGINT;
  v_ledger_id UUID;
BEGIN
  -- 锁定账户行
  SELECT balance INTO v_balance_before
  FROM public.fund_accounts
  WHERE id = p_account_id AND user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or inactive';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  v_balance_after := v_balance_before + p_amount;

  -- 更新账户余额
  UPDATE public.fund_accounts
  SET balance = v_balance_after,
      total_deposited = total_deposited + p_amount,
      updated_at = NOW()
  WHERE id = p_account_id;

  -- 写入台账
  INSERT INTO public.fund_ledger (
    user_id, account_id, type, amount,
    balance_before, balance_after,
    title, description, channel,
    ref_type, ref_id, ref_no
  ) VALUES (
    p_user_id, p_account_id, 'deposit', p_amount,
    v_balance_before, v_balance_after,
    p_title, p_description, p_channel,
    p_ref_type, p_ref_id, p_ref_no
  ) RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

-- 4b. 出金（提现/取出资金）
CREATE OR REPLACE FUNCTION public.fund_withdraw(
  p_user_id UUID,
  p_account_id UUID,
  p_amount BIGINT,
  p_title TEXT DEFAULT '出金',
  p_description TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL,
  p_ref_type TEXT DEFAULT 'manual',
  p_ref_id UUID DEFAULT NULL,
  p_ref_no TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before BIGINT;
  v_balance_after BIGINT;
  v_ledger_id UUID;
BEGIN
  SELECT balance INTO v_balance_before
  FROM public.fund_accounts
  WHERE id = p_account_id AND user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or inactive';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF v_balance_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance: have %, need %', v_balance_before, p_amount;
  END IF;

  v_balance_after := v_balance_before - p_amount;

  UPDATE public.fund_accounts
  SET balance = v_balance_after,
      total_withdrawn = total_withdrawn + p_amount,
      updated_at = NOW()
  WHERE id = p_account_id;

  INSERT INTO public.fund_ledger (
    user_id, account_id, type, amount,
    balance_before, balance_after,
    title, description, channel,
    ref_type, ref_id, ref_no
  ) VALUES (
    p_user_id, p_account_id, 'withdraw', p_amount,
    v_balance_before, v_balance_after,
    p_title, p_description, p_channel,
    p_ref_type, p_ref_id, p_ref_no
  ) RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

-- 4c. 转移（账户间转账）
CREATE OR REPLACE FUNCTION public.fund_transfer(
  p_user_id UUID,
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount BIGINT,
  p_title TEXT DEFAULT '转账',
  p_description TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_from_balance BIGINT;
  v_to_balance BIGINT;
  v_ledger_id UUID;
BEGIN
  -- 验证两个账户属于同一用户
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Cannot transfer to same account';
  END IF;

  -- 锁定源账户
  SELECT balance INTO v_from_balance
  FROM public.fund_accounts
  WHERE id = p_from_account_id AND user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source account not found or inactive';
  END IF;

  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- 锁定目标账户
  SELECT balance INTO v_to_balance
  FROM public.fund_accounts
  WHERE id = p_to_account_id AND user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target account not found or inactive';
  END IF;

  -- 扣减源账户
  UPDATE public.fund_accounts
  SET balance = v_from_balance - p_amount, updated_at = NOW()
  WHERE id = p_from_account_id;

  -- 增加目标账户
  UPDATE public.fund_accounts
  SET balance = v_to_balance + p_amount, updated_at = NOW()
  WHERE id = p_to_account_id;

  -- 写入源账户台账（转出）
  INSERT INTO public.fund_ledger (
    user_id, account_id, to_account_id, type, amount,
    balance_before, balance_after,
    title, description, channel, ref_type
  ) VALUES (
    p_user_id, p_from_account_id, p_to_account_id, 'transfer_out', p_amount,
    v_from_balance, v_from_balance - p_amount,
    p_title || ' (转出)', p_description, 'internal', 'manual'
  );

  -- 写入目标账户台账（转入）
  INSERT INTO public.fund_ledger (
    user_id, account_id, to_account_id, type, amount,
    balance_before, balance_after,
    title, description, channel, ref_type
  ) VALUES (
    p_user_id, p_to_account_id, p_from_account_id, 'transfer_in', p_amount,
    v_to_balance, v_to_balance + p_amount,
    p_title || ' (转入)', p_description, 'internal', 'manual'
  ) RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

-- 4d. 投资扣款（从账户扣款用于买入资产）
CREATE OR REPLACE FUNCTION public.fund_invest(
  p_user_id UUID,
  p_account_id UUID,
  p_amount BIGINT,
  p_title TEXT DEFAULT '投资买入',
  p_ref_id UUID DEFAULT NULL,
  p_ref_no TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before BIGINT;
  v_ledger_id UUID;
BEGIN
  SELECT balance INTO v_balance_before
  FROM public.fund_accounts
  WHERE id = p_account_id AND user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or inactive';
  END IF;

  IF v_balance_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance for investment';
  END IF;

  UPDATE public.fund_accounts
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE id = p_account_id;

  INSERT INTO public.fund_ledger (
    user_id, account_id, type, amount,
    balance_before, balance_after,
    title, channel, ref_type, ref_id, ref_no
  ) VALUES (
    p_user_id, p_account_id, 'invest', p_amount,
    v_balance_before, v_balance_before - p_amount,
    p_title, 'internal', 'trade', p_ref_id, p_ref_no
  ) RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

-- 4e. 投资回款（卖出资产回款到账户）
CREATE OR REPLACE FUNCTION public.fund_divest(
  p_user_id UUID,
  p_account_id UUID,
  p_amount BIGINT,
  p_title TEXT DEFAULT '投资卖出回款',
  p_ref_id UUID DEFAULT NULL,
  p_ref_no TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before BIGINT;
  v_ledger_id UUID;
BEGIN
  SELECT balance INTO v_balance_before
  FROM public.fund_accounts
  WHERE id = p_account_id AND user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or inactive';
  END IF;

  UPDATE public.fund_accounts
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = p_account_id;

  INSERT INTO public.fund_ledger (
    user_id, account_id, type, amount,
    balance_before, balance_after,
    title, channel, ref_type, ref_id, ref_no
  ) VALUES (
    p_user_id, p_account_id, 'divest', p_amount,
    v_balance_before, v_balance_before + p_amount,
    p_title, 'internal', 'trade', p_ref_id, p_ref_no
  ) RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. updated_at 触发器
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_fund_accounts_updated_at
  BEFORE UPDATE ON public.fund_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 视图: 用户资金概览
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_fund_overview AS
SELECT
  fa.user_id,
  SUM(fa.balance) AS total_balance,
  SUM(fa.total_deposited) AS total_deposited,
  SUM(fa.total_withdrawn) AS total_withdrawn,
  COUNT(*) AS account_count,
  COUNT(*) FILTER (WHERE fa.status = 'active') AS active_count
FROM public.fund_accounts fa
GROUP BY fa.user_id;
