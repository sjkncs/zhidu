-- ============================================================================
-- Zhidu 资管模块 — 投资组合 + 交易记录 + 持仓 + AI 分析
-- Portfolio / Position / Trade / Investment Analysis
-- ============================================================================

-- ============================================================================
-- 1. 投资组合表 (Portfolios)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  market_type TEXT NOT NULL CHECK (market_type IN ('stock', 'crypto', 'mixed')),
  currency TEXT NOT NULL DEFAULT 'CNY',
  total_value DECIMAL(18,2) DEFAULT 0,
  total_cost DECIMAL(18,2) DEFAULT 0,
  total_return DECIMAL(18,2) DEFAULT 0,
  return_pct DECIMAL(8,4) DEFAULT 0,
  risk_level TEXT CHECK (risk_level IN ('conservative', 'balanced', 'aggressive', 'extreme')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. 持仓表 (Positions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('A股', '港股', '美股', 'BTC', 'ETH', 'SOL', 'DeFi', 'other')),
  quantity DECIMAL(18,6) NOT NULL DEFAULT 0,
  avg_cost DECIMAL(18,6) DEFAULT 0,
  current_price DECIMAL(18,6) DEFAULT 0,
  market_value DECIMAL(18,2) DEFAULT 0,
  unrealized_pnl DECIMAL(18,2) DEFAULT 0,
  unrealized_pnl_pct DECIMAL(8,4) DEFAULT 0,
  weight DECIMAL(8,4) DEFAULT 0,
  sector TEXT,
  ai_score DECIMAL(4,2),
  ai_signal TEXT CHECK (ai_signal IN ('strong_buy', 'buy', 'hold', 'sell', 'strong_sell')),
  ai_reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. 交易记录表 (Trades)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity DECIMAL(18,6) NOT NULL,
  price DECIMAL(18,6) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  fee DECIMAL(18,4) DEFAULT 0,
  market TEXT NOT NULL,
  note TEXT,
  ai_recommended BOOLEAN DEFAULT false,
  traded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. AI 分析记录表 (Investment Analyses)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investment_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL,
  symbol TEXT,
  market TEXT,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('stock_screen', 'portfolio_review', 'risk_assess', 'factor_analysis', 'defi_yield')),
  gate_result TEXT CHECK (gate_result IN ('proceed', 'wait', 'insufficient_data')),
  decision_trace JSONB,
  recommendation JSONB,
  confidence DECIMAL(4,2),
  raw_output TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own portfolios"
  ON public.portfolios FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own positions"
  ON public.positions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own trades"
  ON public.trades FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own analyses"
  ON public.investment_analyses FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 6. Indexes
-- ============================================================================

CREATE INDEX idx_portfolios_user ON public.portfolios(user_id);
CREATE INDEX idx_positions_portfolio ON public.positions(portfolio_id);
CREATE INDEX idx_positions_user ON public.positions(user_id);
CREATE INDEX idx_trades_portfolio ON public.trades(portfolio_id);
CREATE INDEX idx_trades_user ON public.trades(user_id);
CREATE INDEX idx_analyses_user ON public.investment_analyses(user_id);
CREATE INDEX idx_analyses_portfolio ON public.investment_analyses(portfolio_id);
CREATE INDEX idx_positions_symbol ON public.positions(symbol);
CREATE INDEX idx_trades_symbol ON public.trades(symbol);

-- ============================================================================
-- 7. Updated_at trigger (自动更新时间戳)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_investment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.update_investment_updated_at();

CREATE TRIGGER trg_positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_investment_updated_at();
