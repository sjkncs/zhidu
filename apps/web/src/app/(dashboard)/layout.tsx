'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

interface NavItem {
  icon: string;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: '📊', label: '仪表盘', href: '/dashboard' },
  { icon: '🎯', label: '志愿填报', href: '/dashboard/volunteer' },
  { icon: '🧭', label: '生涯规划', href: '/dashboard/career' },
  { icon: '📚', label: '知识库', href: '/dashboard/knowledge' },
  { icon: '🌳', label: '技能树', href: '/dashboard/skills' },
  { icon: '📄', label: '简历', href: '/dashboard/resume' },
  { icon: '💼', label: '实习', href: '/dashboard/internship' },
  { icon: '🔬', label: '科研', href: '/dashboard/research' },
  { icon: '📔', label: '日记', href: '/dashboard/diary' },
  { icon: '📝', label: '备忘', href: '/dashboard/memo' },
  { icon: '⏰', label: '时间', href: '/dashboard/time' },
  { icon: '💰', label: '财务', href: '/dashboard/finance' },
];

function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
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
            {navItems.map((item) => {
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
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
                    <span className="text-base leading-none" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="border-t border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-light text-sm font-semibold text-white">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {userEmail}
              </p>
              <p className="text-xs text-text-tertiary">个人中心</p>
            </div>
          </div>
        </div>
      </aside>
    </>
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
      volunteer: '志愿填报',
      career: '生涯规划',
      knowledge: '知识库',
      skills: '技能树',
      resume: '简历',
      internship: '实习',
      research: '科研',
      diary: '日记',
      memo: '备忘',
      time: '时间',
      finance: '财务',
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
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
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

      {/* Theme toggle placeholder */}
      <button
        type="button"
        className="rounded-lg p-2 text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors"
        aria-label="切换主题"
        title="切换主题"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      </button>
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
