'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';

export default function FinancePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-border bg-surface p-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue/10">
          <Wallet className="h-8 w-8 text-blue" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">财务</h1>
        <p className="mt-2 text-text-secondary">
          收支记录与预算管理，培养理财习惯
        </p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue/10 px-5 py-2.5 text-sm font-medium text-blue">
          <span className="h-2 w-2 rounded-full bg-blue animate-pulse" />
          即将上线
        </div>
        <p className="mt-6 text-sm text-text-tertiary">
          该模块正在开发中，敬请期待
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm text-blue hover:text-blue-dark transition-colors"
        >
          &larr; 返回仪表盘
        </Link>
      </div>
    </div>
  );
}
