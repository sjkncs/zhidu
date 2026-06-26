import { createClient } from '@/lib/supabase/server';
import { ModuleGrid, QuickActions } from './module-grid';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userEmail = user?.email ?? '用户';
  const displayName = user?.user_metadata?.name ?? userEmail.split('@')[0];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Welcome section */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          你好，{displayName}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          欢迎回渡。今天想从哪里开始？
        </p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-tertiary">志愿方案</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">0</p>
          <p className="mt-1 text-xs text-text-secondary">开始创建你的第一个方案</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-tertiary">知识收藏</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">0</p>
          <p className="mt-1 text-xs text-text-secondary">探索院校与专业信息</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-tertiary">技能点数</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">0</p>
          <p className="mt-1 text-xs text-text-secondary">点亮你的技能树</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium text-text-tertiary">连续打卡</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">0 天</p>
          <p className="mt-1 text-xs text-text-secondary">坚持每日记录</p>
        </div>
      </div>

      {/* Module grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          功能模块
        </h2>
        <ModuleGrid />
      </div>

      {/* Quick actions */}
      <QuickActions />
    </div>
  );
}
