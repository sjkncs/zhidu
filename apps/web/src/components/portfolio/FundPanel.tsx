'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  Plus,
  X,
  Check,
  Loader2,
  Landmark,
  CreditCard,
  Smartphone,
  Building2,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FundAccount {
  id: string;
  name: string;
  account_type: string;
  channel: string | null;
  balance: number;
  total_deposited: number;
  total_withdrawn: number;
  currency: string;
  is_default: boolean;
  status: string;
}

interface FundSummary {
  totalBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  accountCount: number;
}

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  title: string;
  description: string | null;
  channel: string | null;
  status: string;
  created_at: string;
  account_id: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFen(fen: number): string {
  const yuan = fen / 100;
  if (Math.abs(yuan) >= 10000) {
    return (yuan / 10000).toFixed(2) + '万';
  }
  return yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  deposit: { label: '入金', color: 'text-green-500', icon: '↓' },
  withdraw: { label: '出金', color: 'text-red-500', icon: '↑' },
  transfer_in: { label: '转入', color: 'text-blue', icon: '←' },
  transfer_out: { label: '转出', color: 'text-orange-500', icon: '→' },
  invest: { label: '投资', color: 'text-purple-500', icon: '📈' },
  divest: { label: '回款', color: 'text-emerald-500', icon: '📉' },
  fee: { label: '费用', color: 'text-text-secondary', icon: '💰' },
  dividend: { label: '分红', color: 'text-green-500', icon: '💎' },
  refund: { label: '退款', color: 'text-cyan-500', icon: '↩' },
};

const ACCOUNT_TYPE_ICONS: Record<string, typeof Wallet> = {
  bank: Landmark,
  digital: Smartphone,
  investment: Building2,
  cash: Wallet,
  credit: CreditCard,
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FundPanel() {
  const [accounts, setAccounts] = useState<FundAccount[]>([]);
  const [summary, setSummary] = useState<FundSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [showLedger, setShowLedger] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showOperate, setShowOperate] = useState<string | null>(null); // 'deposit' | 'withdraw' | 'transfer'
  const [operateLoading, setOperateLoading] = useState(false);
  const [operateSuccess, setOperateSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formAmount, setFormAmount] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formToAccountId, setFormToAccountId] = useState('');
  const [formChannel, setFormChannel] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // New account form
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('investment');
  const [newAccountChannel, setNewAccountChannel] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fund/account');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAccounts(data.accounts ?? []);
      setSummary(data.summary ?? null);
      if (data.accounts?.length > 0 && !formAccountId) {
        const defaultAcc = data.accounts.find((a: FundAccount) => a.is_default) ?? data.accounts[0];
        setFormAccountId(defaultAcc.id);
      }
    } catch (err) {
      console.error('Failed to fetch fund accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [formAccountId]);

  const fetchLedger = useCallback(async () => {
    try {
      const res = await fetch('/api/fund/ledger?limit=20');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setLedger(data.ledger ?? []);
    } catch (err) {
      console.error('Failed to fetch ledger:', err);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => { if (showLedger) fetchLedger(); }, [showLedger, fetchLedger]);

  // Create account
  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    try {
      setOperateLoading(true);
      setError(null);
      const balanceFen = newAccountBalance ? Math.round(parseFloat(newAccountBalance) * 100) : 0;
      const res = await fetch('/api/fund/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAccountName.trim(),
          accountType: newAccountType,
          channel: newAccountChannel || undefined,
          balance: balanceFen,
          isDefault: accounts.length === 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '创建失败');
      }
      setShowAddAccount(false);
      setNewAccountName('');
      setNewAccountBalance('');
      setNewAccountChannel('');
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建账户失败');
    } finally {
      setOperateLoading(false);
    }
  };

  // Fund operation
  const handleOperate = async () => {
    if (!formAccountId || !formAmount) return;
    const amountFen = Math.round(parseFloat(formAmount) * 100);
    if (amountFen <= 0) {
      setError('金额必须为正数');
      return;
    }

    try {
      setOperateLoading(true);
      setError(null);
      setOperateSuccess(false);

      const body: Record<string, unknown> = {
        type: showOperate,
        accountId: formAccountId,
        amount: amountFen,
        title: formTitle || undefined,
        description: formDescription || undefined,
        channel: formChannel || undefined,
      };

      if (showOperate === 'transfer') {
        if (!formToAccountId) {
          setError('请选择目标账户');
          return;
        }
        body.toAccountId = formToAccountId;
      }

      const res = await fetch('/api/fund/operate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '操作失败');
      }

      setOperateSuccess(true);
      setFormAmount('');
      setFormTitle('');
      setFormDescription('');
      await fetchAccounts();
      setTimeout(() => {
        setShowOperate(null);
        setOperateSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setOperateLoading(false);
    }
  };

  const resetOperate = () => {
    setShowOperate(null);
    setFormAmount('');
    setFormTitle('');
    setFormDescription('');
    setFormChannel('');
    setError(null);
    setOperateSuccess(false);
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
        </div>
      </section>
    );
  }

  return (
    <>
      {/* ── 资金概览 ── */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue" />
            资金账户
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLedger(!showLedger)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-elevated"
            >
              <History className="w-3.5 h-3.5" />
              {showLedger ? '隐藏流水' : '查看流水'}
            </button>
            <button
              onClick={() => setShowAddAccount(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue px-3 py-1.5 text-xs text-white hover:bg-blue/90"
            >
              <Plus className="w-3.5 h-3.5" />
              新建账户
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && summary.accountCount > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-5 sm:grid-cols-4">
            <div className="rounded-lg bg-surface-elevated p-3">
              <p className="text-xs text-text-secondary mb-1">总余额</p>
              <p className="text-lg font-bold text-text-primary">¥{formatFen(summary.totalBalance)}</p>
            </div>
            <div className="rounded-lg bg-surface-elevated p-3">
              <p className="text-xs text-text-secondary mb-1">累计入金</p>
              <p className="text-lg font-bold text-green-500">¥{formatFen(summary.totalDeposited)}</p>
            </div>
            <div className="rounded-lg bg-surface-elevated p-3">
              <p className="text-xs text-text-secondary mb-1">累计出金</p>
              <p className="text-lg font-bold text-red-500">¥{formatFen(summary.totalWithdrawn)}</p>
            </div>
            <div className="rounded-lg bg-surface-elevated p-3">
              <p className="text-xs text-text-secondary mb-1">账户数</p>
              <p className="text-lg font-bold text-text-primary">{summary.accountCount}</p>
            </div>
          </div>
        )}

        {/* Account Cards */}
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-text-secondary">
            <Wallet className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">暂无资金账户</p>
            <p className="text-xs mt-1">点击「新建账户」开始管理您的投资资金</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((acc) => {
              const Icon = ACCOUNT_TYPE_ICONS[acc.account_type] ?? Wallet;
              return (
                <div
                  key={acc.id}
                  className={`relative rounded-lg border p-4 transition-colors ${
                    acc.is_default ? 'border-blue/30 bg-blue/5' : 'border-border bg-surface-elevated'
                  }`}
                >
                  {acc.is_default && (
                    <span className="absolute top-2 right-2 rounded-full bg-blue/10 px-2 py-0.5 text-[10px] font-medium text-blue">
                      默认
                    </span>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue/10">
                      <Icon className="h-4 w-4 text-blue" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{acc.name}</p>
                      <p className="text-xs text-text-secondary">{acc.channel ?? acc.account_type}</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-text-primary mb-1">
                    ¥{formatFen(acc.balance)}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-text-secondary">
                    <span>入金 ¥{formatFen(acc.total_deposited)}</span>
                    <span>出金 ¥{formatFen(acc.total_withdrawn)}</span>
                  </div>

                  {/* Quick action buttons per account */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <button
                      onClick={() => { setFormAccountId(acc.id); setShowOperate('deposit'); }}
                      className="flex-1 flex items-center justify-center gap-1 rounded-md bg-green-500/10 py-1.5 text-xs text-green-500 hover:bg-green-500/20"
                    >
                      <ArrowDownToLine className="w-3 h-3" />入金
                    </button>
                    <button
                      onClick={() => { setFormAccountId(acc.id); setShowOperate('withdraw'); }}
                      className="flex-1 flex items-center justify-center gap-1 rounded-md bg-red-500/10 py-1.5 text-xs text-red-500 hover:bg-red-500/20"
                    >
                      <ArrowUpFromLine className="w-3 h-3" />出金
                    </button>
                    <button
                      onClick={() => { setFormAccountId(acc.id); setShowOperate('transfer'); }}
                      className="flex-1 flex items-center justify-center gap-1 rounded-md bg-blue/10 py-1.5 text-xs text-blue hover:bg-blue/20"
                    >
                      <ArrowLeftRight className="w-3 h-3" />转账
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Ledger Section ── */}
        {showLedger && (
          <div className="mt-5 border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">资金流水</h3>
            {ledger.length === 0 ? (
              <p className="text-xs text-text-secondary py-4 text-center">暂无流水记录</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ledger.map((entry) => {
                  const typeInfo = TYPE_LABELS[entry.type] ?? { label: entry.type, color: 'text-text-secondary', icon: '•' };
                  return (
                    <div key={entry.id} className="flex items-center justify-between rounded-lg bg-surface-elevated px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-base">{typeInfo.icon}</span>
                        <div>
                          <p className="text-xs font-medium text-text-primary">{entry.title}</p>
                          <p className="text-[10px] text-text-secondary">
                            {accounts.find((a) => a.id === entry.account_id)?.name ?? '-'} · {new Date(entry.created_at).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-medium ${typeInfo.color}`}>
                          {['deposit', 'transfer_in', 'divest', 'refund', 'dividend'].includes(entry.type) ? '+' : '-'}
                          ¥{formatFen(entry.amount)}
                        </p>
                        <p className="text-[10px] text-text-secondary">余额 ¥{formatFen(entry.balance_after)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Add Account Modal ── */}
      {showAddAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-text-primary">新建资金账户</h3>
              <button onClick={() => setShowAddAccount(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" />{error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">账户名称</label>
                <input
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="如：招商证券、支付宝理财"
                  className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">账户类型</label>
                  <select
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue"
                  >
                    <option value="investment">投资账户</option>
                    <option value="bank">银行账户</option>
                    <option value="digital">数字钱包</option>
                    <option value="cash">现金</option>
                    <option value="credit">信用账户</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">渠道标识</label>
                  <input
                    value={newAccountChannel}
                    onChange={(e) => setNewAccountChannel(e.target.value)}
                    placeholder="如：alipay, broker"
                    className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">初始余额（元，可留空）</label>
                <input
                  value={newAccountBalance}
                  onChange={(e) => setNewAccountBalance(e.target.value)}
                  placeholder="310000"
                  type="number"
                  className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowAddAccount(false)}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-text-secondary hover:bg-surface-elevated"
              >
                取消
              </button>
              <button
                onClick={handleCreateAccount}
                disabled={operateLoading || !newAccountName.trim()}
                className="flex-1 rounded-lg bg-blue py-2 text-sm text-white hover:bg-blue/90 disabled:opacity-50"
              >
                {operateLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : '创建账户'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Operate Modal (Deposit/Withdraw/Transfer) ── */}
      {showOperate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-text-primary">
                {showOperate === 'deposit' && '入金'}
                {showOperate === 'withdraw' && '出金'}
                {showOperate === 'transfer' && '账户转账'}
              </h3>
              <button onClick={resetOperate} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            {operateSuccess ? (
              <div className="flex flex-col items-center py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 mb-3">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-sm font-medium text-text-primary">操作成功</p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
                    <AlertCircle className="w-4 h-4" />{error}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Source account */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      {showOperate === 'transfer' ? '转出账户' : '操作账户'}
                    </label>
                    <select
                      value={formAccountId}
                      onChange={(e) => setFormAccountId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (¥{formatFen(a.balance)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target account for transfer */}
                  {showOperate === 'transfer' && (
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">转入账户</label>
                      <select
                        value={formToAccountId}
                        onChange={(e) => setFormToAccountId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue"
                      >
                        <option value="">选择目标账户</option>
                        {accounts.filter((a) => a.id !== formAccountId).map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} (¥{formatFen(a.balance)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">金额（元）</label>
                    <input
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="10000.00"
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue"
                    />
                  </div>

                  {/* Title (optional) */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">备注（可选）</label>
                    <input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="如：第一笔注资"
                      className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue"
                    />
                  </div>

                  {/* Channel (for deposit/withdraw) */}
                  {showOperate !== 'transfer' && (
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">渠道（可选）</label>
                      <select
                        value={formChannel}
                        onChange={(e) => setFormChannel(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue"
                      >
                        <option value="">内部操作</option>
                        <option value="alipay">支付宝</option>
                        <option value="wechat">微信支付</option>
                        <option value="bank">银行转账</option>
                        <option value="broker">券商</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={resetOperate}
                    className="flex-1 rounded-lg border border-border py-2 text-sm text-text-secondary hover:bg-surface-elevated"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleOperate}
                    disabled={operateLoading || !formAmount}
                    className={`flex-1 rounded-lg py-2 text-sm text-white disabled:opacity-50 ${
                      showOperate === 'deposit' ? 'bg-green-500 hover:bg-green-600' :
                      showOperate === 'withdraw' ? 'bg-red-500 hover:bg-red-600' :
                      'bg-blue hover:bg-blue/90'
                    }`}
                  >
                    {operateLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : '确认'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
