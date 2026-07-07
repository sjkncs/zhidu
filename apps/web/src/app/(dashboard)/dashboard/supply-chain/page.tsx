'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Loader2,
  AlertCircle,
  RefreshCw,
  Database,
  Package,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Wifi,
  WifiOff,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataSource {
  name: string;
  type: string;
  syncStatus: string;
  lastSyncAt: string | null;
}

interface InventoryItem {
  dataType: string;
  totalRecords: number;
  qualityScore: number;
  coverageRate: number;
}

interface ProcurementItem {
  title: string;
  supplier: string;
  status: string;
  amount: number;
  createdAt: string;
}

interface SupplyChainData {
  sources: DataSource[];
  inventory: InventoryItem[];
  procurement: ProcurementItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYNC_STATUS_STYLE: Record<string, string> = {
  synced: 'bg-green-500/10 text-green-600 border-green-500/30',
  syncing: 'bg-blue/10 text-blue border-blue/30',
  error: 'bg-red-500/10 text-red-500 border-red-500/30',
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
};

const SYNC_STATUS_LABEL: Record<string, string> = {
  synced: '已同步',
  syncing: '同步中',
  error: '同步失败',
  pending: '等待同步',
};

const PROC_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  approved: 'bg-blue/10 text-blue border-blue/30',
  delivered: 'bg-green-500/10 text-green-600 border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/30',
  in_transit: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
};

const PROC_STATUS_LABEL: Record<string, string> = {
  pending: '待审批',
  approved: '已审批',
  delivered: '已交付',
  cancelled: '已取消',
  in_transit: '运输中',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(fen: number): string {
  return (fen / 100).toFixed(2);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
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

function StatusBadge({ status, styleMap, labelMap }: {
  status: string;
  styleMap: Record<string, string>;
  labelMap: Record<string, string>;
}) {
  const label = labelMap[status] || status;
  const style = styleMap[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section: Data Source Status
// ---------------------------------------------------------------------------

function DataSourceSection({ sources }: { sources: DataSource[] }) {
  if (sources.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Wifi className="w-5 h-5 text-blue" />
          数据源状态
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Wifi className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Wifi className="w-5 h-5 text-blue" />
        数据源状态
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((src) => {
          const isOk = src.syncStatus === 'synced';
          return (
            <div key={src.name} className="rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isOk ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                    {isOk ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{src.name}</p>
                    <p className="text-xs text-text-tertiary">{src.type}</p>
                  </div>
                </div>
                <StatusBadge
                  status={src.syncStatus}
                  styleMap={SYNC_STATUS_STYLE}
                  labelMap={SYNC_STATUS_LABEL}
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Clock className="w-3 h-3" />
                <span>上次同步：{formatDate(src.lastSyncAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Inventory Table
// ---------------------------------------------------------------------------

function InventorySection({ inventory }: { inventory: InventoryItem[] }) {
  if (inventory.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Database className="w-5 h-5 text-blue" />
          数据资产
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Database className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Database className="w-5 h-5 text-blue" />
        数据资产
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">数据类型</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">总记录数</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4 min-w-[120px]">质量分</th>
              <th className="text-right font-medium text-text-tertiary pb-3 min-w-[120px]">覆盖率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {inventory.map((item) => {
              const qualityColor = item.qualityScore >= 90 ? 'text-green-500' : item.qualityScore >= 70 ? 'text-amber-500' : 'text-red-500';
              const qualityBarColor = item.qualityScore >= 90 ? 'bg-green-500' : item.qualityScore >= 70 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <tr key={item.dataType} className="hover:bg-surface-elevated transition-colors">
                  <td className="py-3 pr-4 font-medium text-text-primary">{item.dataType}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-text-primary">
                    {formatNumber(item.totalRecords)}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="h-1.5 w-16 rounded-full bg-border/50 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${qualityBarColor}`}
                          style={{ width: `${Math.min(item.qualityScore, 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold ${qualityColor}`}>
                        {item.qualityScore.toFixed(0)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-semibold text-text-primary">
                      {item.coverageRate.toFixed(1)}%
                    </span>
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
// Section: Procurement Tracker
// ---------------------------------------------------------------------------

function ProcurementSection({ items }: { items: ProcurementItem[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <ShoppingCart className="w-5 h-5 text-blue" />
          采购跟踪
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <ShoppingCart className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <ShoppingCart className="w-5 h-5 text-blue" />
        采购跟踪
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">项目</th>
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">供应商</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">状态</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">金额</th>
              <th className="text-right font-medium text-text-tertiary pb-3">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((item) => (
              <tr key={item.title} className="hover:bg-surface-elevated transition-colors">
                <td className="py-3 pr-4 font-medium text-text-primary">{item.title}</td>
                <td className="py-3 pr-4 text-text-secondary">{item.supplier}</td>
                <td className="py-3 pr-4 text-center">
                  <StatusBadge
                    status={item.status}
                    styleMap={PROC_STATUS_STYLE}
                    labelMap={PROC_STATUS_LABEL}
                  />
                </td>
                <td className="py-3 pr-4 text-right font-semibold text-text-primary">
                  &yen;{formatAmount(item.amount)}
                </td>
                <td className="py-3 text-right text-text-tertiary text-xs">
                  {formatDate(item.createdAt)}
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
// Main Component
// ---------------------------------------------------------------------------

export default function SupplyChainPage() {
  const [data, setData] = useState<SupplyChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/supply-chain');
      if (!res.ok) throw new Error('获取供应链信息失败');
      const json = await res.json();
      const raw = json.data ?? json;
      const sources = (raw.dataSources ?? []).map((s: any) => ({
        name: s.name, type: s.source_type ?? '',
        syncStatus: s.status === 'active' ? 'synced' : s.status === 'error' ? 'error' : 'pending',
        lastSyncAt: s.last_sync_at ?? null,
      }));
      const inventory = (raw.inventory ?? []).map((i: any) => ({
        dataType: i.data_type ?? '', totalRecords: i.total_records ?? 0,
        qualityScore: Number(i.quality_score) ?? 0, coverageRate: Number(i.coverage_rate) ?? 0,
      }));
      const procurement = (raw.procurementItems ?? []).map((p: any) => ({
        title: p.item_name ?? '', supplier: p.vendor ?? '', status: p.status ?? 'pending',
        amount: p.amount ?? 0, createdAt: p.order_date ?? p.created_at,
      }));
      setData({ sources, inventory, procurement });
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

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <Truck className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">供应链</h1>
            <p className="text-sm text-text-secondary">数据源、资产与采购管理</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <Truck className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">供应链</h1>
            <p className="text-sm text-text-secondary">数据源、资产与采购管理</p>
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
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
          <Truck className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">供应链</h1>
          <p className="text-sm text-text-secondary">数据源、资产与采购管理</p>
        </div>
      </div>

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

      <DataSourceSection sources={data?.sources ?? []} />
      <InventorySection inventory={data?.inventory ?? []} />
      <ProcurementSection items={data?.procurement ?? []} />
    </div>
  );
}
