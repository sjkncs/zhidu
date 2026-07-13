'use client';

import { Wallet, TrendingUp, ArrowRight } from 'lucide-react';
import FinanceTracker from '@/components/finance/FinanceTracker';

export default function FinancePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
            <Wallet className="h-5 w-5 text-navy" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">财务</h1>
            <p className="text-sm text-text-secondary">
              收支记录与预算管理，培养良好的理财习惯
            </p>
          </div>
        </div>
        <a
          href="/dashboard/portfolio"
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition hover:border-blue/30 hover:text-blue"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          投资资管
          <ArrowRight className="h-3 w-3" />
        </a>
      </div>
      <FinanceTracker />
    </div>
  );
}
