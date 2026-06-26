'use client';

import { Wallet } from 'lucide-react';
import FinanceTracker from '@/components/finance/FinanceTracker';

export default function FinancePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
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
      <FinanceTracker />
    </div>
  );
}
