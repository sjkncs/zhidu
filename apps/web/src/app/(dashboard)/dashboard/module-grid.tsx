'use client';

import { useRouter } from 'next/navigation';
import { ModuleCard, Badge } from '@zhidu/ui';
import type { ModuleCardStatus } from '@zhidu/ui';
import {
  Target,
  Compass,
  BookOpen,
  MessageSquare,
  TreePine,
  GraduationCap,
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
    status: 'active',
  },
  {
    icon: BookOpen,
    title: '知识库',
    description: '院校信息、专业介绍、历年数据一站查询',
    href: '/dashboard/knowledge',
    status: 'active',
  },
  {
    icon: MessageSquare,
    title: 'AI 助手',
    description: '智能问答，支持志愿填报、专业咨询、职业规划',
    href: '/dashboard/chat',
    status: 'active',
  },
  {
    icon: TreePine,
    title: '技能树',
    description: '可视化技能成长路径，追踪学习进度',
    href: '/dashboard/skills',
    status: 'active',
  },
  {
    icon: GraduationCap,
    title: '学业',
    description: '课程成绩追踪、GPA 计算与学业进度管理',
    href: '/dashboard/academic',
    status: 'active',
  },
  {
    icon: FileText,
    title: '简历',
    description: 'AI 辅助生成专业简历，支持智能填充与在线预览',
    href: '/dashboard/resume',
    status: 'active',
  },
  {
    icon: Briefcase,
    title: '实习',
    description: '管理实习经历，积累实践经验',
    href: '/dashboard/internship',
    status: 'active',
  },
  {
    icon: Microscope,
    title: '科研',
    description: '管理科研项目，追踪学术进展',
    href: '/dashboard/research',
    status: 'active',
  },
  {
    icon: BookMarked,
    title: '日记',
    description: '记录每日成长，AI 智能总结与洞察',
    href: '/dashboard/diary',
    status: 'active',
  },
  {
    icon: StickyNote,
    title: '备忘',
    description: '待办事项管理，重要日程提醒',
    href: '/dashboard/memo',
    status: 'active',
  },
  {
    icon: Clock,
    title: '时间',
    description: '时间追踪与分析，优化学习效率',
    href: '/dashboard/time',
    status: 'active',
  },
  {
    icon: Wallet,
    title: '财务',
    description: '收支记录与预算管理，培养理财习惯',
    href: '/dashboard/finance',
    status: 'active',
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
          onClick={() => router.push('/dashboard/career')}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          <Compass className="h-4 w-4" />
          <span>生涯规划</span>
          <Badge color="blue">新</Badge>
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
        <button
          onClick={() => router.push('/dashboard/resume')}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          <FileText className="h-4 w-4" />
          <span>创建简历</span>
          <Badge color="blue">新</Badge>
        </button>
        <button
          onClick={() => router.push('/dashboard/finance')}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          <Wallet className="h-4 w-4" />
          <span>记录收支</span>
        </button>
        <button
          onClick={() => router.push('/dashboard/academic')}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          <GraduationCap className="h-4 w-4" />
          <span>添加课程</span>
          <Badge color="blue">新</Badge>
        </button>
      </div>
    </div>
  );
}
