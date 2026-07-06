'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Loader2,
  AlertCircle,
  RefreshCw,
  Activity,
  Coins,
  Globe,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Provider {
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

interface LlmStatus {
  providers: Provider[];
  usageStats: UsageStat[];
  costEstimate: CostEstimate;
  callSites: CallSite[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODULE_NAMES: Record<string, string> = {
  chat: 'AI对话',
  volunteer: '志愿推荐',
  career: '职业规划',
  knowledge: '知识库',
  resume: '简历',
  skills: '技能树',
  time: '时间管理',
};

const TASK_COLORS: Record<string, string> = {
  VOLUNTEER_MATCH: 'bg-green-500/10 text-green-600 border-green-500/30',
  MAJOR_RECOMMEND: 'bg-blue/10 text-blue border-blue/30',
  KNOWLEDGE_QA: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  STUDY_PLAN: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  ESSAY_WRITING: 'bg-pink-500/10 text-pink-500 border-pink-500/30',
  RESUME_POLISH: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30',
  EMOTION_ANALYSIS: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  GENERAL_CHAT: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
};

const CALL_TYPE_LABELS: Record<string, string> = {
  chatStream: '流式对话',
  chat: '同步对话',
  chatJSON: 'JSON 解析',
};

const STATUS_STYLE = {
  active: 'bg-green-500/10 text-green-600 border-green-500/30',
  not_configured: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const STATUS_TEXT: Record<string, string> = {
  active: '已启用',
  not_configured: '未配置',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  return n.toLocaleString();
}

function formatCost(n: number): string {
  return `¥${n.toFixed(4)}`;
}

function isDeepSeekModel(model: string): boolean {
  return model.toLowerCase().includes('deepseek');
}

function estimateRowCost(stat: UsageStat): number {
  const inputPer1k = stat.totalInputTokens / 1000;
  const outputPer1k = stat.totalOutputTokens / 1000;
  if (isDeepSeekModel(stat.model)) {
    return inputPer1k * 0.002 + outputPer1k * 0.008;
  }
  return inputPer1k * 0.004 + outputPer1k * 0.012;
}

// ---------------------------------------------------------------------------
// Section: Provider Cards
// ---------------------------------------------------------------------------

function ProviderCards({ providers }: { providers: Provider[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {providers.map((provider) => {
        const statusStyle = STATUS_STYLE[provider.status];
        const statusLabel = STATUS_TEXT[provider.status] || provider.status;

        return (
          <div key={provider.name} className="rounded-xl border border-border bg-surface p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue/10">
                  <Cpu className="h-4.5 w-4.5 text-blue" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary">{provider.name}</h2>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
                {statusLabel}
              </span>
            </div>

            <div className="space-y-3 mb-4 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-tertiary">模型：</span>
                <span className="text-sm font-medium text-text-primary">
                  {provider.model || '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                <span className="text-xs font-mono text-text-tertiary truncate">
                  {provider.baseUrl || '未配置'}
                </span>
              </div>
              <p className="text-sm text-text-secondary">{provider.description}</p>
            </div>

            <div>
              <p className="text-xs text-text-tertiary mb-2">支持任务：</p>
              <div className="flex flex-wrap gap-1.5">
                {provider.tasks.map((task) => {
                  const colorStyle = TASK_COLORS[task] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
                  return (
                    <span
                      key={task}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorStyle}`}
                    >
                      {task}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Usage Statistics Table
// ---------------------------------------------------------------------------

function UsageStatsSection({ stats }: { stats: UsageStat[] }) {
  if (stats.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Activity className="w-5 h-5 text-blue" />
          用量统计（近30天）
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Activity className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无 AI 调用记录</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Activity className="w-5 h-5 text-blue" />
        用量统计（近30天）
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">模块</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">动作</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">模型</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">调用次数</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">输入Token</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">输出Token</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">消耗额度</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">平均耗时</th>
              <th className="text-right font-medium text-text-tertiary pb-3">估算费用</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {stats.map((stat, idx) => {
              const moduleLabel = MODULE_NAMES[stat.module] || stat.module;
              const rowCost = estimateRowCost(stat);

              return (
                <tr key={`${stat.module}-${stat.action}-${stat.model}-${idx}`} className="group hover:bg-surface-elevated transition-colors">
                  <td className="py-3 pr-4 text-text-primary font-medium">{moduleLabel}</td>
                  <td className="py-3 pr-4 text-text-secondary">{stat.action}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-text-tertiary">{stat.model}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-text-primary">
                    {formatTokens(stat.callCount)}
                  </td>
                  <td className="py-3 pr-4 text-right text-text-secondary">
                    {formatTokens(stat.totalInputTokens)}
                  </td>
                  <td className="py-3 pr-4 text-right text-text-secondary">
                    {formatTokens(stat.totalOutputTokens)}
                  </td>
                  <td className="py-3 pr-4 text-right text-text-secondary">
                    {formatTokens(stat.totalCredits)}
                  </td>
                  <td className="py-3 pr-4 text-right text-text-tertiary text-xs">
                    {stat.avgDurationMs}ms
                  </td>
                  <td className="py-3 text-right text-text-primary font-medium">
                    {formatCost(rowCost)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Cost Summary
// ---------------------------------------------------------------------------

function CostSummaryCard({ costEstimate }: { costEstimate: CostEstimate }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
          <Coins className="h-4.5 w-4.5 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">费用估算（{costEstimate.period}）</h2>
      </div>

      <div className="rounded-lg bg-surface-elevated border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-tertiary">DeepSeek {costEstimate.period}费用</span>
          <span className="text-sm font-medium text-text-primary">
            {formatCost(costEstimate.deepseekCost)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-tertiary">GLM {costEstimate.period}费用</span>
          <span className="text-sm font-medium text-text-primary">
            {formatCost(costEstimate.glmCost)}
          </span>
        </div>
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="text-sm font-medium text-text-secondary">合计</span>
          <span className="text-base font-bold text-blue">
            {formatCost(costEstimate.totalCost)}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-surface-elevated/50 border border-border/50 p-3">
        <p className="text-xs text-text-tertiary leading-relaxed">
          <span className="font-medium text-text-secondary">定价参考：</span>
          DeepSeek deepseek-v4-pro: ~¥0.002/千输入Token, ~¥0.008/千输出Token
          {' | '}
          GLM-5.2-C: ~¥0.004/千输入Token, ~¥0.012/千输出Token
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: API Call Sites
// ---------------------------------------------------------------------------

function CallSitesSection({ callSites }: { callSites: CallSite[] }) {
  if (callSites.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Globe className="w-5 h-5 text-blue" />
        API 调用站点
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">路由</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">方法</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">调用类型</th>
              <th className="text-left font-medium text-text-tertiary pb-3">关联模块</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {callSites.map((site) => {
              const callTypeLabel = CALL_TYPE_LABELS[site.callType] || site.callType;

              return (
                <tr key={site.route} className="group hover:bg-surface-elevated transition-colors">
                  <td className="py-3 pr-4 font-mono text-xs text-text-primary">{site.route}</td>
                  <td className="py-3 pr-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-blue/10 text-blue border-blue/30">
                      {site.method}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-text-secondary">{callTypeLabel}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {site.modules.map((mod) => {
                        const label = MODULE_NAMES[mod] || mod;
                        return (
                          <span
                            key={mod}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-500/10 text-gray-500 border-gray-500/30"
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function LlmPage() {
  const [data, setData] = useState<LlmStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/llm-status', { signal });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `获取 LLM 状态失败 (${res.status})`);
      }
      const json = await res.json();
      setData(json.data ?? json);
    } catch (err) {
      if (signal.aborted) return;
      const msg = err instanceof Error ? err.message : '加载 LLM 数据失败';
      setError(msg);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchStatus(controller.signal);
    return () => controller.abort();
  }, [fetchStatus]);

  const handleRetry = useCallback(() => {
    const controller = new AbortController();
    fetchStatus(controller.signal);
  }, [fetchStatus]);

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <Cpu className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">AI 服务管理</h1>
            <p className="text-sm text-text-secondary">管理 LLM 提供商、查看用量与费用</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // Error state with no data
  if (error && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <Cpu className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">AI 服务管理</h1>
            <p className="text-sm text-text-secondary">管理 LLM 提供商、查看用量与费用</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <AlertCircle className="w-10 h-10 mb-3 text-red-500 opacity-60" />
          <p className="text-sm text-text-secondary mb-1">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      </div>
    );
  }

  // Data available
  const { providers, usageStats, costEstimate, callSites } = data!;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
          <Cpu className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">AI 服务管理</h1>
          <p className="text-sm text-text-secondary">管理 LLM 提供商、查看用量与费用</p>
        </div>
      </div>

      {/* Error banner (when data is also available) */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.04] px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span className="text-sm text-text-secondary">{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      )}

      {/* Provider cards */}
      <ProviderCards providers={providers} />

      {/* Usage statistics */}
      <UsageStatsSection stats={usageStats} />

      {/* Cost summary + API call sites */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CostSummaryCard costEstimate={costEstimate} />
        </div>
        <div className="lg:col-span-2">
          <CallSitesSection callSites={callSites} />
        </div>
      </div>
    </div>
  );
}
