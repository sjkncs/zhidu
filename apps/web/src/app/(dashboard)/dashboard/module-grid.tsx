'use client';

import { useRouter } from 'next/navigation';
import { ModuleCard, Badge } from '@zhidu/ui';
import type { ModuleCardStatus } from '@zhidu/ui';
import {
  Target,
  Compass,
  BookOpen,
  TreePine,
  FileText,
  Briefcase,
  Microscope,
  BookMarked,
  StickyNote,
  Clock,
  Wallet,
} from 'lucide-react';

type IconComponent = React.ComponentType<{ className?: string }>;

interface ModuleInfo {
  icon: IconComponent;
  title: string;
  description: string;
  href: string;
  status: ModuleCardStatus;
}

const modules: ModuleInfo[] = [
  {
    icon: Target,
    title: '志愿填报',
    description: 'AI 智能匹配院校专业，科学规划志愿方案',
    href: '/dashboard/volunteer',
    status: 'active',
  },
  {
    icon: Compass,
    title: '生涯规划',
    description: '探索职业方向，制定个人成长路线图',
    href: '/dashboard/career',
    status: 'coming_soon',
  },
  {
    icon: BookOpen,
    title: '知识库',
    description: '院校信息、专业介绍、历年数据一站查询',
    href: '/dashboard/knowledge',
    status: 'coming_soon',
  },
  {
    icon: TreePine,
    title: '技能树',
    description: '可视化技能成长路径，追踪学习进度',
    href: '/dashboard/skills',
    status: 'coming_soon',
  },
  {
    icon: FileText,
    title: '简历',
    description: 'AI 辅助生成专业简历，一键导出',
    href: '/dashboard/resume',
    status: 'coming_soon',
  },
  {
    icon: Briefcase,
    title: '实习',
    description: '匹配优质实习机会，积累实践经验',
    href: '/dashboard/internship',
    status: 'coming_soon',
  },
  {
    icon: Microscope,
    title: '科研',
    description: '科研项目推荐与管理，学术能力提升',
    href: '/dashboard/research',
    status: 'coming_soon',
  },
  {
    icon: BookMarked,
    title: '日记',
    description: '记录每日成长，AI 智能总结与洞察',
    href: '/dashboard/diary',
    status: 'coming_soon',
  },
  {
    icon: StickyNote,
    title: '备忘',
    description: '待办事项管理，重要日程提醒',
    href: '/dashboard/memo',
    status: 'coming_soon',
  },
  {
    icon: Clock,
    title: '时间',
    description: '时间追踪与分析，优化学习效率',
    href: '/dashboard/time',
    status: 'coming_soon',
  },
  {
    icon: Wallet,
    title: '财务',
    description: '收支记录与预算管理，培养理财习惯',
    href: '/dashboard/finance',
    status: 'coming_soon',
  },
];

export function ModuleGrid() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {modules.map((mod) => {
        const Icon = mod.icon;
        return (
          <ModuleCard
            key={mod.href}
            icon={<Icon className="h-6 w-6" />}
            title={mod.title}
            description={mod.description}
            status={mod.status}
            onClick={
              mod.status === 'active'
                ? () => router.push(mod.href)
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

export function QuickActions() {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="mb-4 text-base font-semibold text-text-primary">
        快速操作
      </h3>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => router.push('/dashboard/volunteer')}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          <Target className="h-4 w-4" />
          <span>开始志愿填报</span>
          <Badge color="green">推荐</Badge>
        </button>
        <button
          onClick={() => router.push('/dashboard/knowledge')}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          <BookOpen className="h-4 w-4" />
          <span>浏览院校库</span>
        </button>
        <button
          onClick={() => router.push('/dashboard/diary')}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          <BookMarked className="h-4 w-4" />
          <span>写一篇日记</span>
        </button>
        <button
          onClick={() => router.push('/dashboard/memo')}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          <StickyNote className="h-4 w-4" />
          <span>添加备忘</span>
        </button>
      </div>
    </div>
  );
}
