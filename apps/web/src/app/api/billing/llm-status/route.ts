// API: LLM 服务状态
// GET /api/billing/llm-status — 获取 LLM 提供商配置、用量统计与费用估算

import { NextRequest, NextResponse } from 'next/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderInfo {
  name: string;
  baseUrl: string;
  model: string;
  status: 'active' | 'not_configured';
  tasks: string[];
  description: string;
}

interface UsageStat {
  module: string;
  action: string;
  model: string;
  callCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCredits: number;
  avgDurationMs: number;
}

interface CostEstimate {
  deepseekCost: number;
  glmCost: number;
  totalCost: number;
  period: string;
}

interface CallSite {
  route: string;
  method: string;
  callType: string;
  modules: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEEPSEEK_TASKS = ['VOLUNTEER_MATCH', 'MAJOR_RECOMMEND', 'KNOWLEDGE_QA', 'STUDY_PLAN'];
const GLM_TASKS = ['ESSAY_WRITING', 'RESUME_POLISH', 'EMOTION_ANALYSIS', 'GENERAL_CHAT'];

const DEEPSEEK_DESCRIPTION = '推理能力强，速度快，适合数据分析和逻辑推理任务';
const GLM_DESCRIPTION = '中文理解好，创意写作能力强，适合文案和情感分析';

// Pricing per 1K tokens (in CNY)
const DEEPSEEK_INPUT_PRICE = 0.002;
const DEEPSEEK_OUTPUT_PRICE = 0.008;
const GLM_INPUT_PRICE = 0.004;
const GLM_OUTPUT_PRICE = 0.012;

const CALL_SITES: CallSite[] = [
  { route: '/api/ai/chat', method: 'POST', callType: 'chatStream', modules: ['chat'] },
  { route: '/api/ai/stream', method: 'GET', callType: 'chatStream', modules: ['chat'] },
  { route: '/api/ai/analyze', method: 'POST', callType: 'chat', modules: ['volunteer', 'career'] },
  { route: '/api/career/generate', method: 'POST', callType: 'chatJSON', modules: ['career'] },
  { route: '/api/skills/generate', method: 'POST', callType: 'chatJSON', modules: ['skills'] },
  { route: '/api/time/weekly-review', method: 'POST', callType: 'chatJSON', modules: ['time'] },
  { route: '/api/resume/generate', method: 'POST', callType: 'chatJSON', modules: ['resume'] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProviders(): ProviderInfo[] {
  const deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL || '';
  const deepseekModel = process.env.DEEPSEEK_MODEL || '';
  const glmBaseUrl = process.env.GLM_BASE_URL || '';
  const glmModel = process.env.GLM_MODEL || '';

  return [
    {
      name: 'DeepSeek',
      baseUrl: deepseekBaseUrl,
      model: deepseekModel,
      status: deepseekBaseUrl && deepseekModel ? 'active' : 'not_configured',
      tasks: DEEPSEEK_TASKS,
      description: DEEPSEEK_DESCRIPTION,
    },
    {
      name: 'GLM (智谱)',
      baseUrl: glmBaseUrl,
      model: glmModel,
      status: glmBaseUrl && glmModel ? 'active' : 'not_configured',
      tasks: GLM_TASKS,
      description: GLM_DESCRIPTION,
    },
  ];
}

function isDeepSeekModel(model: string): boolean {
  const m = model.toLowerCase();
  return m.includes('deepseek');
}

function calculateCosts(stats: UsageStat[]): CostEstimate {
  let deepseekCost = 0;
  let glmCost = 0;

  for (const stat of stats) {
    const inputCost = stat.totalInputTokens / 1000;
    const outputCost = stat.totalOutputTokens / 1000;

    if (isDeepSeekModel(stat.model)) {
      deepseekCost += inputCost * DEEPSEEK_INPUT_PRICE + outputCost * DEEPSEEK_OUTPUT_PRICE;
    } else {
      glmCost += inputCost * GLM_INPUT_PRICE + outputCost * GLM_OUTPUT_PRICE;
    }
  }

  // Round to 4 decimal places
  deepseekCost = Math.round(deepseekCost * 10000) / 10000;
  glmCost = Math.round(glmCost * 10000) / 10000;
  const totalCost = Math.round((deepseekCost + glmCost) * 10000) / 10000;

  return { deepseekCost, glmCost, totalCost, period: '30天' };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireUser();
    } catch (err) {
      return authErrorResponse(err);
    }

    const userId = auth.user.id;

    // Build providers from env vars
    const providers = buildProviders();

    // Query usage logs for the past 30 days
    const supabase = await createClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: usageLogs, error } = await supabase
      .from('ai_usage_logs')
      .select('module, action, model, tokens_input, tokens_output, credits_used, duration_ms')
      .eq('user_id', userId)
      .eq('status', 'SUCCESS')
      .gte('created_at', thirtyDaysAgo);

    if (error) {
      console.error('[billing/llm-status] ai_usage_logs query error:', error);
      return NextResponse.json(
        { error: '查询用量数据失败' },
        { status: 500 },
      );
    }

    // Group by module + action + model
    const groupMap = new Map<string, UsageStat>();

    for (const log of (usageLogs ?? [])) {
      const key = `${log.module}|${log.action}|${log.model}`;
      const existing = groupMap.get(key);

      if (existing) {
        existing.callCount += 1;
        existing.totalInputTokens += log.tokens_input ?? 0;
        existing.totalOutputTokens += log.tokens_output ?? 0;
        existing.totalCredits += log.credits_used ?? 0;
        existing.avgDurationMs = Math.round(
          (existing.avgDurationMs * (existing.callCount - 1) + (log.duration_ms ?? 0)) /
            existing.callCount,
        );
      } else {
        groupMap.set(key, {
          module: log.module,
          action: log.action,
          model: log.model,
          callCount: 1,
          totalInputTokens: log.tokens_input ?? 0,
          totalOutputTokens: log.tokens_output ?? 0,
          totalCredits: log.credits_used ?? 0,
          avgDurationMs: log.duration_ms ?? 0,
        });
      }
    }

    // Sort by call count descending
    const usageStats = Array.from(groupMap.values()).sort((a, b) => b.callCount - a.callCount);

    // Calculate cost estimates
    const costEstimate = calculateCosts(usageStats);

    return NextResponse.json({
      success: true,
      data: {
        providers,
        usageStats,
        costEstimate,
        callSites: CALL_SITES,
      },
    });
  } catch (err) {
    console.error('[billing/llm-status GET]', err);
    return NextResponse.json({ error: '查询 LLM 状态失败' }, { status: 500 });
  }
}
