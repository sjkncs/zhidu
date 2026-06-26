'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>

        <h1 className="mb-3 text-2xl font-bold text-text-primary">
          出了点问题
        </h1>

        <p className="mb-8 text-text-secondary">
          页面遇到了意外错误，请稍后重试
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-6 py-3 text-sm font-semibold text-text-primary transition hover:bg-border-subtle"
          >
            返回仪表盘
          </Link>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            重试
          </button>
        </div>
      </div>
    </div>
  );
}
