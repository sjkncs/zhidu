// API: AI 投资组合分析 — PortfolioAgent（3 阶段流水线）
// POST /api/portfolio/analyze — 触发 PortfolioAgent 对投资组合进行多维度诊断
//
// Pipeline:
//   Stage 1: Gate Check + Market Diagnosis（5-signal voting）
//   Stage 2: Strategy Selection + Kelly Position Sizing
//   Stage 3: Continuity Guard + Validation + Output

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth-utils';
import { PortfolioAgent } from '@zhidu/ai';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));

    const portfolioId = body.portfolioId as string | undefined;
    const mode = (body.mode as string) ?? 'full_diagnosis';

    // ─── 1. 获取组合 + 持仓 ─────────────────────────────────────

    let portfolioQuery = supabase
      .from('portfolios')
      .select('*, positions(*)')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (portfolioId) {
      portfolioQuery = supabase
        .from('portfolios')
        .select('*, positions(*)')
        .eq('id', portfolioId)
        .eq('user_id', auth.user.id)
        .limit(1);
    }

    const { data: portfolios, error } = await portfolioQuery;
    if (error) throw error;

    if (!portfolios || portfolios.length === 0) {
      return NextResponse.json({ error: '未找到投资组合' }, { status: 404 });
    }

    const portfolio = portfolios[0];
    const rawPositions = (portfolio as any).positions ?? [];

    // 映射为 PositionData 格式
    const positions = rawPositions.map((p: any) => ({
      id: p.id,
      symbol: p.symbol,
      name: p.name ?? p.symbol,
      market: p.market,
      quantity: Number(p.quantity ?? 0),
      avgCost: Number(p.avg_cost ?? 0),
      currentPrice: Number(p.current_price ?? 0),
      marketValue: Number(p.market_value ?? 0),
      pnl: Number(p.unrealized_pnl ?? 0),
      pnlPercent: Number(p.unrealized_pnl_pct ?? 0),
      weight: Number(p.weight ?? 0),
      aiSignal: p.ai_signal,
    }));

    // ─── 2. 运行 PortfolioAgent ────────────────────────────────────

    const agent = new PortfolioAgent();
    const agentResult = await agent.analyze({
      portfolioId: portfolio.id,
      userId: auth.user.id,
      mode: mode as any,
      db: supabase,
      positions,
    });

    // ─── 3. 保存分析记录 ───────────────────────────────────────────

    try {
      await supabase.from('investment_analyses').insert({
        user_id: auth.user.id,
        portfolio_id: portfolio.id,
        analysis_type: 'portfolio_review',
        gate_result: agentResult.gateCheck.result,
        decision_trace: agentResult.decisionTrace as any,
        recommendation: agentResult.recommendations as any,
        confidence: agentResult.overallConfidence,
        raw_output: agentResult.structuredPrompt,
      });
    } catch (saveErr) {
      console.warn('[portfolio/analyze] 保存分析记录失败:', saveErr);
    }

    // ─── 4. 返回结果 ───────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      data: {
        gatePassed: agentResult.gateCheck.result === 'proceed',
        gateReasons: agentResult.gateCheck.reasons,
        confidence: agentResult.overallConfidence,
        decisionTrace: agentResult.decisionTrace.nodes.map(
          (n) => `[${n.authority}] ${n.label}: ${typeof n.finalValue === 'object' ? JSON.stringify(n.finalValue) : n.finalValue}`,
        ),
        decisionTraceFull: agentResult.decisionTrace,
        recommendations: agentResult.recommendations.map((r) => r.reason),
        recommendationsDetail: agentResult.recommendations,
        riskAssessment: agentResult.portfolioAssessment.riskLevel,
        portfolioAssessment: agentResult.portfolioAssessment,
        positionSignals: agentResult.positionSignals,
        continuityCheck: agentResult.continuityCheck,
        validation: agentResult.validation,
        structuredPrompt: agentResult.structuredPrompt,
        behavioralBiases: agentResult.behavioralBiases,
        matchedStrategies: agentResult.matchedStrategies,
        metrics: {
          totalPositions: positions.length,
          avgPnlPercent: positions.length > 0
            ? Number((positions.reduce((s, p) => s + (p.pnlPercent ?? 0), 0) / positions.length).toFixed(2))
            : 0,
          maxSingleWeight: Math.max(0, ...positions.map((p) => p.weight ?? 0)),
          marketDiversification: Object.keys(agentResult.portfolioAssessment.marketConcentration).length,
          winRate: positions.length > 0
            ? Math.round((positions.filter((p) => (p.pnl ?? 0) > 0).length / positions.length) * 100)
            : 0,
        },
        timestamp: agentResult.timestamp,
      },
    });
  } catch (err) {
    console.error('[portfolio/analyze POST]', err);
    if (err instanceof AuthError) {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: 'AI 分析执行失败' }, { status: 500 });
  }
}
