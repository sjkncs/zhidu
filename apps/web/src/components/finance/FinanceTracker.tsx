'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  UtensilsCrossed,
  Car,
  ShoppingBag,
  BookOpen,
  Home,
  Gamepad2,
  Award,
  Briefcase,
  Heart,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  BarChart3,
  Filter,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Transaction {
  id: string;
  userId: string;
  amount: number;
  category: string;
  description?: string;
  type: 'EXPENSE' | 'INCOME';
  date: string;
  createdAt: string;
}

interface Summary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPENSE_CATEGORIES = ['餐饮', '交通', '购物', '学习', '住房', '娱乐', '其他'] as const;
const INCOME_CATEGORIES = ['奖学金', '兼职', '家里', '其他'] as const;

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  '餐饮': UtensilsCrossed,
  '交通': Car,
  '购物': ShoppingBag,
  '学习': BookOpen,
  '住房': Home,
  '娱乐': Gamepad2,
  '奖学金': Award,
  '兼职': Briefcase,
  '家里': Heart,
  '其他': MoreHorizontal,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[d.getDay()];
  const today = todayStr();
  if (dateStr === today) return `今天 ${month}月${day}日 ${weekday}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (dateStr === yesterdayStr) return `昨天 ${month}月${day}日 ${weekday}`;
  return `${month}月${day}日 ${weekday}`;
}

function getMonthRange(year: number, month: number): { startDate: string; endDate: string } {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { startDate, endDate };
}

function getMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

const PERCENT = 100;
const MAX_RETRY = 2;
const RETRY_DELAY_MS = 800;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = CATEGORY_ICONS[category] || MoreHorizontal;
  return <Icon className={className || 'w-4 h-4'} />;
}

// ---------------------------------------------------------------------------
// Section: Summary Cards
// ---------------------------------------------------------------------------

function SummaryCards({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Total Income */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <span className="text-sm text-text-secondary">总收入</span>
        </div>
        <p className="text-2xl font-bold text-green-500">
          +{formatAmount(summary.totalIncome)}
        </p>
      </div>

      {/* Total Expense */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
          <span className="text-sm text-text-secondary">总支出</span>
        </div>
        <p className="text-2xl font-bold text-red-500">
          -{formatAmount(summary.totalExpense)}
        </p>
      </div>

      {/* Balance */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue/10">
            <Wallet className="h-4 w-4 text-blue" />
          </div>
          <span className="text-sm text-text-secondary">结余</span>
        </div>
        <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-blue' : 'text-red-500'}`}>
          {summary.balance >= 0 ? '+' : ''}{formatAmount(summary.balance)}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Quick Add Form
// ---------------------------------------------------------------------------

function QuickAddForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('餐饮');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayStr());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = type === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleTypeChange = useCallback((newType: 'EXPENSE' | 'INCOME') => {
    setType(newType);
    // Reset category to first option of new type
    setCategory(newType === 'EXPENSE' ? '餐饮' : '奖学金');
  }, []);

  const handleSubmit = useCallback(async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('请输入有效金额');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          category,
          description: description.trim() || undefined,
          type,
          date,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `创建失败 (${res.status})`);
      }
      // Reset form
      setAmount('');
      setDescription('');
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建交易时出错';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [amount, category, description, type, date, onCreated]);

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Plus className="w-5 h-5 text-blue" />
        快速记账
      </h2>

      {/* Type toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => handleTypeChange('EXPENSE')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            type === 'EXPENSE'
              ? 'bg-red-500/10 text-red-500 border border-red-500/30'
              : 'bg-surface-elevated text-text-secondary border border-border hover:border-red-500/30 hover:text-red-500'
          }`}
        >
          支出
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange('INCOME')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            type === 'INCOME'
              ? 'bg-green-500/10 text-green-500 border border-green-500/30'
              : 'bg-surface-elevated text-text-secondary border border-border hover:border-green-500/30 hover:text-green-500'
          }`}
        >
          收入
        </button>
      </div>

      {/* Amount */}
      <div className="mb-4">
        <label className="block text-sm text-text-secondary mb-1.5">金额</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-lg font-medium">
            &yen;
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated py-2.5 pl-8 pr-4 text-text-primary text-lg font-medium placeholder:text-text-tertiary outline-none focus:border-blue transition-colors"
          />
        </div>
      </div>

      {/* Category */}
      <div className="mb-4">
        <label className="block text-sm text-text-secondary mb-1.5">类别</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                category === cat
                  ? 'bg-blue/10 text-blue border-blue/30'
                  : 'bg-surface-elevated text-text-secondary border-border hover:border-blue/30 hover:text-blue'
              }`}
            >
              <CategoryIcon category={cat} className="w-3.5 h-3.5" />
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Description + Date row */}
      <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">描述</label>
          <input
            type="text"
            placeholder="备注（可选）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated py-2.5 px-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-blue transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated py-2.5 px-3 text-sm text-text-primary outline-none focus:border-blue transition-colors"
          />
        </div>
      </div>

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !amount}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        添加{type === 'EXPENSE' ? '支出' : '收入'}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Filter Bar
// ---------------------------------------------------------------------------

function FilterBar({
  year,
  month,
  typeFilter,
  onPrevMonth,
  onNextMonth,
  onTypeFilterChange,
}: {
  year: number;
  month: number;
  typeFilter: 'ALL' | 'EXPENSE' | 'INCOME';
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onTypeFilterChange: (v: 'ALL' | 'EXPENSE' | 'INCOME') => void;
}) {
  const typeButtons: { key: 'ALL' | 'EXPENSE' | 'INCOME'; label: string }[] = [
    { key: 'ALL', label: '全部' },
    { key: 'EXPENSE', label: '支出' },
    { key: 'INCOME', label: '收入' },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Month selector */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-elevated text-text-secondary hover:text-text-primary hover:border-blue/30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="min-w-[100px] text-center text-sm font-medium text-text-primary">
          {getMonthLabel(year, month)}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-elevated text-text-secondary hover:text-text-primary hover:border-blue/30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-1.5">
        <Filter className="w-4 h-4 text-text-tertiary" />
        {typeButtons.map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={() => onTypeFilterChange(btn.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === btn.key
                ? 'bg-blue/10 text-blue'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Transaction List
// ---------------------------------------------------------------------------

function TransactionItem({
  transaction,
  onDelete,
}: {
  transaction: Transaction;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const isExpense = transaction.type === 'EXPENSE';

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/finance/${transaction.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      onDelete(transaction.id);
    } catch {
      setDeleting(false);
    }
  }, [transaction.id, onDelete]);

  return (
    <div className="group flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-surface-elevated transition-colors">
      {/* Category icon */}
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${
          isExpense ? 'bg-red-500/10' : 'bg-green-500/10'
        }`}
      >
        <CategoryIcon
          category={transaction.category}
          className={`w-4 h-4 ${isExpense ? 'text-red-500' : 'text-green-500'}`}
        />
      </div>

      {/* Description + category */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {transaction.description || transaction.category}
        </p>
        <p className="text-xs text-text-tertiary">{transaction.category}</p>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p
          className={`text-sm font-semibold ${
            isExpense ? 'text-red-500' : 'text-green-500'
          }`}
        >
          {isExpense ? '-' : '+'}{formatAmount(transaction.amount)}
        </p>
      </div>

      {/* Delete button (visible on hover) */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
      >
        {deleting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function TransactionList({
  transactions,
  loading,
  onDelete,
}: {
  transactions: Transaction[];
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  if (loading && transactions.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-text-tertiary">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <p className="text-sm">加载中...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-text-tertiary">
        <Wallet className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm">暂无交易记录</p>
        <p className="text-xs mt-1">使用上方表单添加第一笔记录</p>
      </div>
    );
  }

  // Group by date
  const grouped: Record<string, Transaction[]> = {};
  for (const t of transactions) {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  }

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Running total for filtered view
  const runningTotal = transactions.reduce((sum, t) => {
    return sum + (t.type === 'INCOME' ? t.amount : -t.amount);
  }, 0);

  return (
    <div>
      {sortedDates.map((date) => (
        <div key={date} className="mb-4 last:mb-0">
          {/* Date header */}
          <div className="flex items-center justify-between mb-1 px-3">
            <span className="text-xs font-medium text-text-tertiary">
              {formatDateLabel(date)}
            </span>
            <span className="text-xs text-text-tertiary">
              {grouped[date].reduce((sum, t) => {
                const val = t.type === 'INCOME' ? t.amount : -t.amount;
                return sum + val;
              }, 0) >= 0
                ? '+'
                : ''}
              {formatAmount(
                grouped[date].reduce((sum, t) => {
                  return sum + (t.type === 'INCOME' ? t.amount : -t.amount);
                }, 0),
              )}
            </span>
          </div>

          {/* Transactions for this date */}
          <div className="divide-y divide-border/50">
            {grouped[date].map((t) => (
              <TransactionItem key={t.id} transaction={t} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}

      {/* Running total footer */}
      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between px-3">
        <span className="text-sm text-text-secondary">筛选合计</span>
        <span
          className={`text-sm font-semibold ${
            runningTotal >= 0 ? 'text-blue' : 'text-red-500'
          }`}
        >
          {runningTotal >= 0 ? '+' : ''}{formatAmount(runningTotal)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Category Breakdown (CSS-only bar chart)
// ---------------------------------------------------------------------------

function CategoryBreakdown({ transactions }: { transactions: Transaction[] }) {
  // Only expense transactions
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');

  if (expenses.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
          <BarChart3 className="w-5 h-5 text-blue" />
          支出分类
        </h2>
        <div className="flex flex-col items-center py-8 text-text-tertiary">
          <BarChart3 className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">暂无支出数据</p>
        </div>
      </section>
    );
  }

  // Aggregate by category
  const categoryTotals: Record<string, number> = {};
  for (const t of expenses) {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  }

  // Sort and take top 5
  const sorted = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxAmount = sorted[0]?.[1] ?? 0;
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);

  // Bar colors cycling
  const barColors = [
    'bg-red-400',
    'bg-orange-400',
    'bg-amber-400',
    'bg-yellow-400',
    'bg-lime-400',
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-blue" />
        支出分类
      </h2>

      <div className="space-y-4">
        {sorted.map(([cat, amount], idx) => {
          const pct = maxAmount > 0 ? (amount / maxAmount) * PERCENT : 0;
          const shareOfTotal = totalExpense > 0 ? ((amount / totalExpense) * PERCENT).toFixed(1) : '0';

          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/10">
                    <CategoryIcon category={cat} className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <span className="text-sm font-medium text-text-primary">{cat}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-text-primary">
                    {formatAmount(amount)}
                  </span>
                  <span className="text-xs text-text-tertiary ml-1.5">{shareOfTotal}%</span>
                </div>
              </div>

              {/* Progress bar */}
              <div
                className="h-2 w-full rounded-full bg-border/50 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${cat} 占支出 ${shareOfTotal}%`}
              >
                <div
                  className={`h-full rounded-full transition-all ${barColors[idx] || 'bg-gray-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total footer */}
      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
        <span className="text-sm text-text-secondary">支出总计</span>
        <span className="text-sm font-semibold text-red-500">
          {formatAmount(totalExpense)}
        </span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FinanceTracker() {
  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalIncome: 0, totalExpense: 0, balance: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');

  // Fetch transactions for current month + filter (with AbortSignal + retry)
  const fetchTransactions = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);

      for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
        try {
          const params = new URLSearchParams();
          const { startDate, endDate } = getMonthRange(year, month);
          params.set('startDate', startDate);
          params.set('endDate', endDate);
          if (typeFilter !== 'ALL') {
            params.set('type', typeFilter);
          }

          const res = await fetch(`/api/finance?${params.toString()}`, { signal });
          if (!res.ok) throw new Error(`获取交易记录失败 (${res.status})`);
          const json = await res.json();

          const data: Transaction[] = json.data ?? [];
          setTransactions(data);

          // Summary is computed server-side from ALL transactions in the date range
          // But we also recompute client-side for the current filter view
          if (json.summary) {
            if (typeFilter !== 'ALL') {
              let totalIncome = 0;
              let totalExpense = 0;
              for (const t of data) {
                if (t.type === 'INCOME') totalIncome += t.amount;
                else totalExpense += t.amount;
              }
              setSummary({ totalIncome, totalExpense, balance: totalIncome - totalExpense });
            } else {
              setSummary(json.summary);
            }
          }
          return; // success
        } catch (err) {
          if (signal.aborted) return;
          console.error(`[FinanceTracker] 加载失败 (第${attempt + 1}次)`, err);
          if (attempt < MAX_RETRY) {
            await delay(RETRY_DELAY_MS * (attempt + 1));
            if (signal.aborted) return;
          } else {
            const msg = err instanceof Error ? err.message : '加载交易记录失败';
            setError(msg);
          }
        } finally {
          if (!signal.aborted) setLoading(false);
        }
      }
    },
    [year, month, typeFilter],
  );

  // Initial load + filter changes (with abort on cleanup)
  useEffect(() => {
    const controller = new AbortController();
    fetchTransactions(controller.signal);
    return () => controller.abort();
  }, [fetchTransactions]);

  // Month navigation
  const handlePrevMonth = useCallback(() => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const handleNextMonth = useCallback(() => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  // After creating a new transaction
  const handleCreated = useCallback(() => {
    const controller = new AbortController();
    fetchTransactions(controller.signal);
  }, [fetchTransactions]);

  // After deleting a transaction (optimistic remove)
  const handleDelete = useCallback(
    (id: string) => {
      setTransactions((prev) => {
        const next = prev.filter((t) => t.id !== id);
        // Recompute summary
        let totalIncome = 0;
        let totalExpense = 0;
        for (const t of next) {
          if (t.type === 'INCOME') totalIncome += t.amount;
          else totalExpense += t.amount;
        }
        setSummary({ totalIncome, totalExpense, balance: totalIncome - totalExpense });
        return next;
      });
    },
    [],
  );

  // Retry handler
  const handleRetry = useCallback(() => {
    const controller = new AbortController();
    fetchTransactions(controller.signal);
  }, [fetchTransactions]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <SummaryCards summary={summary} />

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column: Quick add + Category breakdown */}
        <div className="space-y-6 lg:col-span-2">
          <QuickAddForm onCreated={handleCreated} />
          <CategoryBreakdown transactions={transactions} />
        </div>

        {/* Right column: Filter + Transaction list */}
        <div className="lg:col-span-3">
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
              <Wallet className="w-5 h-5 text-blue" />
              交易记录
            </h2>

            <FilterBar
              year={year}
              month={month}
              typeFilter={typeFilter}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onTypeFilterChange={setTypeFilter}
            />

            <div className="mt-5">
              <TransactionList
                transactions={transactions}
                loading={loading}
                onDelete={handleDelete}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
