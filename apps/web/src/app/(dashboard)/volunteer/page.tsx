import Link from 'next/link';

export default function VolunteerPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-border bg-surface p-12 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue/10 text-3xl">
          🎯
        </div>
        <h1 className="text-2xl font-bold text-text-primary">志愿填报</h1>
        <p className="mt-2 text-text-secondary">
          AI 智能匹配院校专业，科学规划志愿方案
        </p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue/10 px-5 py-2.5 text-sm font-medium text-blue">
          <span className="h-2 w-2 rounded-full bg-blue animate-pulse" />
          正在建设中
        </div>
        <p className="mt-6 text-sm text-text-tertiary">
          该模块即将上线，敬请期待
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
