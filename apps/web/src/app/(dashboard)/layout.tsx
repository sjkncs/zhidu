'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/stores/auth-store';
import {
  LayoutDashboard,
  MessageSquare,
  Target,
  Compass,
  BookOpen,
  Building2,
  Layers,
  TreePine,
  GraduationCap,
  FileText,
  Briefcase,
  Microscope,
  Satellite,
  BookMarked,
  StickyNote,
  Clock,
  Wallet,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  Sun,
  Moon,
  Menu,
  LogOut,
  User,
  Database,
  BarChart3,
  Megaphone,
  ClipboardCheck,
  Flag,
  Headphones,
  Truck,
  Users,
  Newspaper,
  ChevronDown,
} from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

type IconComponent = React.ComponentType<{ className?: string }>;

interface NavItem {
  icon: IconComponent;
  label: string;
  href: string;
  stub?: boolean;
  group?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: '仪表盘', href: '/dashboard' },
  { icon: MessageSquare, label: 'AI 助手', href: '/dashboard/chat' },
  { icon: Target, label: '志愿填报', href: '/dashboard/volunteer' },
  { icon: Compass, label: '生涯规划', href: '/dashboard/career' },
  { icon: BookOpen, label: '知识库', href: '/dashboard/knowledge' },
  { icon: Building2, label: '院校库', href: '/dashboard/universities' },
  { icon: Layers, label: '专业库', href: '/dashboard/majors' },
  { icon: TreePine, label: '技能树', href: '/dashboard/skills' },
  { icon: GraduationCap, label: '学业', href: '/dashboard/academic' },
  { icon: FileText, label: '简历', href: '/dashboard/resume' },
  { icon: Briefcase, label: '实习', href: '/dashboard/internship' },
  { icon: Microscope, label: '科研', href: '/dashboard/research' },
  { icon: Satellite, label: '学术', href: '/dashboard/papers' },
  { icon: BookMarked, label: '日记', href: '/dashboard/diary' },
  { icon: StickyNote, label: '备忘', href: '/dashboard/memo' },
  { icon: Clock, label: '时间', href: '/dashboard/time' },
  { icon: Wallet, label: '财务', href: '/dashboard/finance' },
  { icon: TrendingUp, label: '资管', href: '/dashboard/portfolio' },
  { icon: CreditCard, label: '账单中心', href: '/dashboard/billing' },
  { icon: ShoppingBag, label: '订单记录', href: '/dashboard/orders' },
  // ── 企业管理 ──
  { icon: Database, label: '数据平台', href: '/dashboard/data-platform', group: '企业管理' },
  { icon: BarChart3, label: '财务管理', href: '/dashboard/finance-pro', group: '企业管理' },
  { icon: Megaphone, label: '品牌运营', href: '/dashboard/brand-ops', group: '企业管理' },
  { icon: ClipboardCheck, label: '营运支持', href: '/dashboard/ops-support', group: '企业管理' },
  { icon: Flag, label: '战略中心', href: '/dashboard/strategy', group: '企业管理' },
  { icon: Headphones, label: '客服中心', href: '/dashboard/support', group: '企业管理' },
  { icon: Truck, label: '供应链', href: '/dashboard/supply-chain', group: '企业管理' },
  { icon: Users, label: '用户运营', href: '/dashboard/user-ops', group: '企业管理' },
  { icon: Newspaper, label: '信息中心', href: '/dashboard/info-center', group: '企业管理' },
];

function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const userEmail = user?.email ?? '未登录';
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-surface transition-transform duration-200 lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-base font-bold text-white">
            知
          </div>
          <span className="text-lg font-bold text-text-primary">知渡</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {navItems.map((item, index) => {
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);

              const Icon = item.icon;
              const showGroupHeader = item.group && (!index || navItems[index - 1].group !== item.group);

              return (
                <li key={item.href}>
                  {showGroupHeader && (
                    <div className="mt-4 mb-2 flex items-center gap-2 px-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                        {item.group}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={[
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue/10 text-blue'
                        : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.stub && (
                      <span className="bg-amber-500/10 text-amber-600 text-[10px] px-1.5 py-0.5 rounded">
                        即将
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="border-t border-border px-4 py-4">
          <Link href="/dashboard/profile" onClick={onClose} className="flex items-center gap-3 mb-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-light text-sm font-semibold text-white">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary group-hover:text-blue transition-colors">
                {userEmail}
              </p>
              <p className="text-xs text-text-tertiary">个人中心</p>
            </div>
            <User className="h-4 w-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <button
            onClick={() => { useAuthStore.getState().signOut(); router.push('/login'); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-elevated hover:text-red-500 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>
    </>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-9" />;
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="rounded-lg p-2 text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors"
      aria-label="切换主题"
      title={isDark ? '切换到浅色模式' : '切换到深色模式'}
    >
      {isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();

  // Build breadcrumbs from pathname
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const labelMap: Record<string, string> = {
      dashboard: '仪表盘',
      chat: 'AI 助手',
      volunteer: '志愿填报',
      career: '生涯规划',
      knowledge: '知识库',
      universities: '院校库',
      majors: '专业库',
      skills: '技能树',
      academic: '学业',
      resume: '简历',
      internship: '实习',
      research: '科研',
      papers: '学术',
      diary: '日记',
      memo: '备忘',
      time: '时间',
      finance: '财务',
      portfolio: '资管',
      billing: '账单中心',
      llm: 'AI 服务管理',
      orders: '订单记录',
      pay: '充值中心',
      profile: '个人中心',
      'data-platform': '数据平台',
      'finance-pro': '财务管理',
      'brand-ops': '品牌运营',
      'ops-support': '营运支持',
      strategy: '战略中心',
      support: '客服中心',
      'supply-chain': '供应链',
      'user-ops': '用户运营',
      'info-center': '信息中心',
    };
    return {
      href,
      label: labelMap[seg] ?? seg,
      isLast: i === segments.length - 1,
    };
  });

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-surface px-4 lg:px-6">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-2 text-text-secondary hover:bg-surface-elevated hover:text-text-primary lg:hidden"
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm" aria-label="面包屑">
        {breadcrumbs.map((crumb) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {!crumb.isLast ? (
              <>
                <Link
                  href={crumb.href}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  {crumb.label}
                </Link>
                <span className="text-text-tertiary" aria-hidden="true">
                  /
                </span>
              </>
            ) : (
              <span className="font-medium text-text-primary">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notifications */}
      <NotificationBell />

      {/* Theme toggle */}
      <ThemeToggle />
    </header>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
