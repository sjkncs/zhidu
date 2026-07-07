'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Loader2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CreditCard,
  PiggyBank,
  Repeat,
  Calendar,
  BarChart3,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetCategory {
  category: string;
  spent: number;
  limit: number;
}

interface Account {
  name: string;
  type: string;
  balance: number;
}

interface RecurringItem {
  title: string;
  amount: number;
  frequency: string;
  nextDueDate: string;
}

interface MonthlyTrend {
  month: string;
  income: number;
  expense: number;
}

interface FinanceProData {
  budgets: BudgetCategory[];
  accounts: Account[];
  recurring: RecurringItem[];
  trends: MonthlyTrend[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREQ_LABEL: Record<string, string> = {
  monthly: '每月',
  weekly: '每周',
  yearly: '每年',
  quarterly: '每季度',
  daily: '每日',
};

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: '活期',
  savings: '储蓄',
  credit: '信用卡',
  investment: '投资',
  cash: '现金',
};

const BUDGET_COLORS = [
  'bg-blue',
  'bg-green-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-cyan-500',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(fen: number): string {
  return (fen / 100).toFixed(2);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

// ---------------------------------------------------------------------------
// Section: Budget Overview
// ---------------------------------------------------------------------------

function BudgetOverviewSection({ budgets }: { budgets: BudgetCategory[] }) {
  if (budgets.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <PiggyBank className="w-5 h-5 text-blue" />
          预算概览
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <PiggyBank className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <PiggyBank className="w-5 h-5 text-blue" />
        预算概览
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {budgets.map((item, idx) => {
          const percent = item.limit > 0 ? Math.min((item.spent / item.limit) * 100, 100) : 0;
          const isOver = item.spent > item.limit;
          const barColor = isOver ? 'bg-red-500' : BUDGET_COLORS[idx % BUDGET_COLORS.length];

          return (
            <div key={item.category} className="rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-text-primary">{item.category}</span>
                {isOver && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-red-500/10 text-red-500 border-red-500/30">
                    超支
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-lg font-bold text-text-primary">
                  &yen;{formatAmount(item.spent)}
                </span>
                <span className="text-xs text-text-tertiary">
                  / &yen;{formatAmount(item.limit)}
                </span>
              </div>
              <div
                className="h-2 w-full rounded-full bg-border/50 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.category} 预算使用 ${percent.toFixed(1)}%`}
              >
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-xs text-text-tertiary mt-1.5">
                已使用 {percent.toFixed(1)}%
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Accounts Grid
// ---------------------------------------------------------------------------

function AccountsGrid({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <CreditCard className="w-5 h-5 text-blue" />
          账户管理
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <CreditCard className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <CreditCard className="w-5 h-5 text-blue" />
        账户管理
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((acc) => (
          <div key={acc.name} className="rounded-lg border border-border bg-surface-elevated p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">{acc.name}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-blue/10 text-blue border-blue/30">
                {ACCOUNT_TYPE_LABEL[acc.type] || acc.type}
              </span>
            </div>
            <p className="text-xl font-bold text-text-primary">
              &yen;{formatAmount(acc.balance)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Recurring Items
// ---------------------------------------------------------------------------

function RecurringItemsSection({ items }: { items: RecurringItem[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <Repeat className="w-5 h-5 text-blue" />
          定期项目
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <Repeat className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Repeat className="w-5 h-5 text-blue" />
        定期项目
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-tertiary pb-3 pr-4">名称</th>
              <th className="text-right font-medium text-text-tertiary pb-3 pr-4">金额</th>
              <th className="text-center font-medium text-text-tertiary pb-3 pr-4">频率</th>
              <th className="text-right font-medium text-text-tertiary pb-3">下次到期</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((item) => (
              <tr key={item.title} className="hover:bg-surface-elevated transition-colors">
                <td className="py-3 pr-4 font-medium text-text-primary">{item.title}</td>
                <td className="py-3 pr-4 text-right font-semibold text-text-primary">
                  &yen;{formatAmount(item.amount)}
                </td>
                <td className="py-3 pr-4 text-center">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-blue/10 text-blue border-blue/30">
                    {FREQ_LABEL[item.frequency] || item.frequency}
                  </span>
                </td>
                <td className="py-3 text-right text-text-tertiary text-xs flex items-center justify-end gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(item.nextDueDate)}
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
// Section: Monthly Trend
// ---------------------------------------------------------------------------

function MonthlyTrendSection({ trends }: { trends: MonthlyTrend[] }) {
  if (trends.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-blue" />
          月度趋势
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <BarChart3 className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">暂无数据</p>
        </div>
      </section>
    );
  }

  const maxVal = Math.max(...trends.flatMap((t) => [t.income, t.expense]), 1);

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-blue" />
        月度趋势
      </h2>
      <div className="space-y-4">
        {trends.map((t) => {
          const incomePercent = (t.income / maxVal) * 100;
          const expensePercent = (t.expense / maxVal) * 100;
          const net = t.income - t.expense;

          return (
            <div key={t.month} className="rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-text-primary">{t.month}</span>
                <div className="flex items-center gap-1.5">
                  {net >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-semibold ${net >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {net >= 0 ? '+' : ''}&yen;{formatAmount(net)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-tertiary">收入</span>
                    <span className="text-xs font-medium text-text-primary">&yen;{formatAmount(t.income)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-border/50 overflow-hidden">
                    <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${incomePercent}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-tertiary">支出</span>
                    <span className="text-xs font-medium text-text-primary">&yen;{formatAmount(t.expense)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-border/50 overflow-hidden">
                    <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${expensePercent}%` }} />
                  </div>
                </div>
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

export default function FinanceProPage() {
  const [data, setData] = useState<FinanceProData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance-pro');
      if (!res.ok) throw new Error('获取财务信息失败');
      const json = await res.json();
      setData(json.data ?? json);
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
            <Wallet className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">财务管理</h1>
            <p className="text-sm text-text-secondary">预算、账户与财务趋势</p>
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
            <Wallet className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">财务管理</h1>
            <p className="text-sm text-text-secondary">预算、账户与财务趋势</p>
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
          <Wallet className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">财务管理</h1>
          <p className="text-sm text-text-secondary">预算、账户与财务趋势</p>
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

      <BudgetOverviewSection budgets={data?.budgets ?? []} />
      <AccountsGrid accounts={data?.accounts ?? []} />
      <RecurringItemsSection items={data?.recurring ?? []} />
      <MonthlyTrendSection trends={data?.trends ?? []} />
    </div>
  );
}
