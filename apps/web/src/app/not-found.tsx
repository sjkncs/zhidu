import { FileQuestion } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy/10">
          <FileQuestion className="h-8 w-8 text-navy" />
        </div>

        <h1 className="mb-3 text-2xl font-bold text-text-primary">
          页面不存在
        </h1>

        <p className="mb-8 text-text-secondary">
          你访问的页面不存在或已被移除
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy-light"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
