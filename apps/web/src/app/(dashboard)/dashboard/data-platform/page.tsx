'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Loader2,
  AlertCircle,
  RefreshCw,
  Cpu,
  GitBranch,
  BarChart3,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelRegistry {
  name: string;
  version: string;
  type: string;
  provider: string;
  status: string;
  accuracy: number;
}

interface Pipeline {
  name: string;
  type: string;
  status: string;
  lastRunAt: string;
  recordsProcessed: number;
}

interface DataQuality {
  module: string;
  completeness: number;
}

interface DataPlatformData {
  activeModels: number;
  activePipelines: number;
  avgDataQuality: number;
  todayEvents: number;
  models: ModelRegistry[];
  pipelines: Pipeline[];
  dataQuality: DataQuality[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600 border-green-500/30',
  running: 'bg-green-500/10 text-green-600 border-green-500/30',
  completed: 'bg-blue/10 text-blue border-blue/30',
  failed: 'bg-red-500/10 text-red-500 border-red-500/30',
  paused: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  inactive: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
};

const STATUS_LABEL: Record<string, string> = {
  active: '运行中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  paused: '已暂停',
  inactive: '未激活',
  pending: '等待中',
};

const QUALITY_BAR_COLORS = [
  'bg-blue',
  'bg-green-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-orange-500',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] || status;
  const style = STATUS_STYLE[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section: KPI Cards
// ---------------------------------------------------------------------------

function KpiCards({ data }: { data: DataPlatformData }) {
  const cards = [
    { label: '活跃模型', value: data.activeModels, icon: Cpu, color: 'text-blue', bg: 'bg-blue/10' },
    { label: '活跃管道', value: data.activePipelines, icon: GitBranch, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: '数据质量', value: `${data.avgDataQuality.toFixed(1)}%`, icon: BarChart3, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: '今日事件', value: formatNumber(data.todayEvents), icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
              <card.icon className={`h-4.5 w-4.5 ${card.color}`} />
            </div>
            <span className="text-sm text-text-secondary">{card.label}</span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Model Registry
// ---------------------------------------------------------------------------

function ModelRegistrySection({ models }: { models: ModelRegistry[] }) {
  if (models.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Layers className="w-5 h-5 text-blue" />
          模型注册表
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Layers className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Layers className="w-5 h-5 text-blue" />
        模型注册表
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">名称</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">版本</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">类型</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">供应商</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">状态</th>
              <th className="text-right font-medium text-text-tertiary pb-3">准确率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {models.map((model) => (
              <tr key={`${model.name}-${model.version}`} className="hover:bg-surface-elevated transition-colors">
                <td className="py-3 pr-4 font-medium text-text-primary">{model.name}</td>
                <td className="py-3 pr-4 font-mono text-xs text-text-tertiary">v{model.version}</td>
                <td className="py-3 pr-4 text-text-secondary">{model.type}</td>
                <td className="py-3 pr-4 text-text-secondary">{model.provider}</td>
                <td className="py-3 pr-4 text-center"><StatusBadge status={model.status} /></td>
                <td className="py-3 text-right font-semibold text-text-primary">
                  {model.accuracy.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Pipeline Monitor
// ---------------------------------------------------------------------------

function PipelineMonitorSection({ pipelines }: { pipelines: Pipeline[] }) {
  if (pipelines.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <GitBranch className="w-5 h-5 text-blue" />
          管道监控
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <GitBranch className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <GitBranch className="w-5 h-5 text-blue" />
        管道监控
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">名称</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">类型</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">状态</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">上次运行</th>
              <th className="text-right font-medium text-text-tertiary pb-3">处理记录</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {pipelines.map((pipe) => (
              <tr key={pipe.name} className="hover:bg-surface-elevated transition-colors">
                <td className="py-3 pr-4 font-medium text-text-primary">{pipe.name}</td>
                <td className="py-3 pr-4 text-text-secondary">{pipe.type}</td>
                <td className="py-3 pr-4 text-center"><StatusBadge status={pipe.status} /></td>
                <td className="py-3 pr-4 text-text-tertiary text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(pipe.lastRunAt)}
                </td>
                <td className="py-3 text-right font-semibold text-text-primary">
                  {formatNumber(pipe.recordsProcessed)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Data Quality Chart
// ---------------------------------------------------------------------------

function DataQualitySection({ items }: { items: DataQuality[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-blue" />
          数据质量
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <BarChart3 className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-blue" />
        数据质量
      </h2>
      <div className="space-y-4">
        {items.map((item, idx) => {
          const barColor = QUALITY_BAR_COLORS[idx % QUALITY_BAR_COLORS.length];
          const isHigh = item.completeness >= 90;
          return (
            <div key={item.module}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-text-primary">{item.module}</span>
                <div className="flex items-center gap-2">
                  {isHigh && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                  <span className="text-sm font-semibold text-text-primary">
                    {item.completeness.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div
                className="h-3 w-full rounded-full bg-border/50 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(item.completeness)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.module} 完整度 ${item.completeness.toFixed(1)}%`}
              >
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(item.completeness, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DataPlatformPage() {
  const [data, setData] = useState<DataPlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/data-platform');
      if (!res.ok) throw new Error('获取数据平台信息失败');
      const json = await res.json();
      const raw = json.data ?? json;
      const models = (raw.models ?? []).map((m: any) => ({
        name: m.name, version: m.version, type: m.model_type ?? '', provider: m.provider ?? '',
        status: m.status, accuracy: m.metrics?.accuracy ?? 0,
      }));
      const pipelines = (raw.pipelines ?? []).map((p: any) => ({
        name: p.name, type: p.pipeline_type ?? '', status: p.status,
        lastRunAt: p.last_run_at ?? p.created_at, recordsProcessed: p.records_processed ?? 0,
      }));
      const dataQuality = (raw.qualityMetrics ?? []).map((q: any) => ({
        module: q.module ?? '', completeness: Number(q.completeness) ?? 0,
      }));
      setData({
        activeModels: models.filter((m: any) => m.status === 'active').length,
        activePipelines: pipelines.filter((p: any) => p.status === 'active').length,
        avgDataQuality: dataQuality.length > 0 ? dataQuality.reduce((s: number, q: any) => s + q.completeness, 0) / dataQuality.length : 0,
        todayEvents: 0,
        models, pipelines, dataQuality,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <Database className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">数据平台</h1>
            <p className="text-sm text-text-secondary">管理模型、管道与数据质量</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <Database className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">数据平台</h1>
            <p className="text-sm text-text-secondary">管理模型、管道与数据质量</p>
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
          <Database className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">数据平台</h1>
          <p className="text-sm text-text-secondary">管理模型、管道与数据质量</p>
        </div>
      </div>

      {/* Error banner */}
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

      {/* KPI Cards */}
      {data && <KpiCards data={data} />}

      {/* Model Registry */}
      <ModelRegistrySection models={data?.models ?? []} />

      {/* Pipeline Monitor */}
      <PipelineMonitorSection pipelines={data?.pipelines ?? []} />

      {/* Data Quality */}
      <DataQualitySection items={data?.dataQuality ?? []} />
    </div>
  );
}
