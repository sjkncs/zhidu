'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  User,
  Crown,
  Coins,
  Settings,
  LogOut,
  Loader2,
  AlertCircle,
  RefreshCw,
  Check,
  ArrowRight,
  Edit3,
  MapPin,
  GraduationCap,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Subscription {
  planName: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'free';
  expiresAt: string | null;
  features: string[];
}

interface Credits {
  monthlyUsed: number;
  monthlyQuota: number;
  available: number;
  breakdown: {
    free: number;
    purchased: number;
    bonus: number;
  };
}

interface BillingOverview {
  subscription: Subscription;
  credits: Credits;
}

interface Profile {
  province: string | null;
  grade: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUB_STATUS_TEXT: Record<string, string> = {
  trial: '试用中',
  active: '已激活',
  expired: '已过期',
  cancelled: '已取消',
  free: '免费版',
};

const SUB_STATUS_STYLE: Record<string, string> = {
  trial: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  active: 'bg-green-500/10 text-green-600 border-green-500/30',
  expired: 'bg-red-500/10 text-red-500 border-red-500/30',
  cancelled: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
  free: 'bg-blue/10 text-blue border-blue/30',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function daysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
}

// ---------------------------------------------------------------------------
// Section: User Info Card
// ---------------------------------------------------------------------------

function UserInfoCard({
  email,
  createdAt,
}: {
  email: string;
  createdAt: string;
}) {
  const initial = email ? email[0].toUpperCase() : '?';

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        {/* Avatar */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy text-2xl font-bold text-white flex-shrink-0">
          {initial}
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xl font-bold text-text-primary">{email}</p>
          <p className="text-sm text-text-tertiary mt-1">
            注册于 {formatDate(createdAt)}
          </p>
        </div>

        {/* Edit button */}
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-blue/30 hover:text-blue"
        >
          <Edit3 className="h-4 w-4" />
          编辑资料
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Subscription Status Card
// ---------------------------------------------------------------------------

function SubscriptionStatusCard({ subscription }: { subscription: Subscription }) {
  const statusLabel = SUB_STATUS_TEXT[subscription.status] || subscription.status;
  const statusStyle =
    SUB_STATUS_STYLE[subscription.status] ||
    'bg-gray-500/10 text-gray-500 border-gray-500/30';
  const isTrial = subscription.status === 'trial';
  const remaining = isTrial ? daysRemaining(subscription.expiresAt) : null;

  return (
    <div className="rounded-xl border border-border bg-surface p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue/10">
            <Crown className="h-4.5 w-4.5 text-blue" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">订阅状态</h2>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mb-4">
        <p className="text-xl font-bold text-text-primary mb-1">
          {subscription.planName}
        </p>
        {subscription.expiresAt && (
          <p className="text-sm text-text-tertiary">
            到期时间：{formatDate(subscription.expiresAt)}
          </p>
        )}
        {isTrial && remaining !== null && remaining > 0 && (
          <p className="text-sm text-yellow-600 mt-1">
            试用剩余 {remaining} 天
          </p>
        )}
        {isTrial && remaining !== null && remaining <= 0 && (
          <p className="text-sm text-red-500 mt-1">试用已到期</p>
        )}
      </div>

      {subscription.features.length > 0 && (
        <ul className="space-y-2 mb-5 flex-1">
          {subscription.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-sm text-text-secondary"
            >
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto">
        <a
          href="/dashboard/billing"
          className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue text-white font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Crown className="w-4 h-4" />
          管理订阅
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: AI Credits Card
// ---------------------------------------------------------------------------

function AICreditsCard({ credits }: { credits: Credits }) {
  const usedPercent =
    credits.monthlyQuota > 0
      ? Math.min((credits.monthlyUsed / credits.monthlyQuota) * 100, 100)
      : 0;
  const barColor =
    usedPercent > 90 ? 'bg-red-500' : usedPercent > 70 ? 'bg-amber-500' : 'bg-blue';

  return (
    <div className="rounded-xl border border-border bg-surface p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
            <Coins className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">AI 额度</h2>
        </div>
      </div>

      {/* Large available number */}
      <div className="mb-4">
        <p className="text-3xl font-bold text-blue">
          {credits.available.toLocaleString()}
        </p>
        <p className="text-sm text-text-tertiary mt-1">可用额度</p>
      </div>

      {/* Monthly usage progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">本月用量</span>
          <span className="text-sm font-semibold text-text-primary">
            {credits.monthlyUsed.toLocaleString()} /{' '}
            {credits.monthlyQuota.toLocaleString()}
          </span>
        </div>
        <div
          className="h-3 w-full rounded-full bg-border/50 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(usedPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`本月已使用 ${usedPercent.toFixed(1)}%`}
        >
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <p className="text-xs text-text-tertiary mt-1.5">
          已使用 {usedPercent.toFixed(1)}%
        </p>
      </div>

      {/* Breakdown */}
      <div className="rounded-lg bg-surface-elevated border border-border p-4 flex-1">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-tertiary">免费额度</span>
            <span className="text-sm font-medium text-text-primary">
              {credits.breakdown.free.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-tertiary">购买额度</span>
            <span className="text-sm font-medium text-text-primary">
              {credits.breakdown.purchased.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-tertiary">赠送额度</span>
            <span className="text-sm font-medium text-text-primary">
              {credits.breakdown.bonus.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="flex gap-2 mt-4">
        <a
          href="/dashboard/billing/pay"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue text-white font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Coins className="w-4 h-4" />
          购买额度
        </a>
        <a
          href="/dashboard/billing/llm"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-surface-elevated text-text-secondary text-sm font-medium hover:border-blue/30 hover:text-blue transition-colors"
        >
          使用详情
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Account Settings Card
// ---------------------------------------------------------------------------

function AccountSettingsCard({ profile }: { profile: Profile | null }) {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'system', label: '跟随系统', icon: Monitor },
  ] as const;

  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue/10">
          <Settings className="h-4.5 w-4.5 text-blue" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">账户设置</h2>
      </div>

      <div className="space-y-5">
        {/* Province */}
        <div className="flex items-center justify-between py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm text-text-secondary">所在省份</span>
          </div>
          <span className="text-sm font-medium text-text-primary">
            {profile?.province || '未设置'}
          </span>
        </div>

        {/* Grade */}
        <div className="flex items-center justify-between py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm text-text-secondary">年级</span>
          </div>
          <span className="text-sm font-medium text-text-primary">
            {profile?.grade || '未设置'}
          </span>
        </div>

        {/* Theme toggle */}
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-text-secondary">主题</span>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-elevated p-1">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  theme === value
                    ? 'bg-blue text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Danger Zone
// ---------------------------------------------------------------------------

function DangerZone() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/login');
    } catch {
      setSigningOut(false);
    }
  }, [signOut, router]);

  return (
    <section className="rounded-xl border border-red-500/30 bg-red-500/[0.04] p-6">
      <h2 className="text-lg font-semibold text-red-500 mb-2">危险操作</h2>
      <p className="text-sm text-text-tertiary mb-4">
        退出登录后需要重新登录才能使用平台功能。
      </p>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="flex items-center gap-2 rounded-lg bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-500/20 disabled:opacity-50"
      >
        {signingOut ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        退出登录
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  const [billingData, setBillingData] = useState<BillingOverview | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch billing overview
      const billingRes = await fetch('/api/billing/overview');
      if (!billingRes.ok) {
        const body = await billingRes.json().catch(() => null);
        throw new Error(body?.error || `获取账单数据失败 (${billingRes.status})`);
      }
      const billingJson = await billingRes.json();
      const overview: BillingOverview = billingJson.data ?? billingJson;
      setBillingData(overview);

      // Fetch profile from Supabase
      if (user?.id) {
        const supabase = createClient();
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
        } else {
          setProfile({
            province: profileData?.province ?? null,
            grade: profileData?.grade ?? null,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载数据失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [fetchData, user]);

  const handleRetry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <User className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">个人中心</h1>
            <p className="text-sm text-text-secondary">管理个人信息与账户设置</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <User className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">个人中心</h1>
            <p className="text-sm text-text-secondary">管理个人信息与账户设置</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <AlertCircle className="w-10 h-10 mb-3 text-red-500 opacity-60" />
          <p className="text-sm text-text-secondary mb-1">请先登录</p>
          <a
            href="/login"
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-blue/10 px-4 py-2 text-sm font-medium text-blue transition hover:bg-blue/20"
          >
            前往登录
          </a>
        </div>
      </div>
    );
  }

  // Error state with no data
  if (error && !billingData) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <User className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">个人中心</h1>
            <p className="text-sm text-text-secondary">管理个人信息与账户设置</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-20 text-text-tertiary">
          <AlertCircle className="w-10 h-10 mb-3 text-red-500 opacity-60" />
          <p className="text-sm text-text-secondary mb-1">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      </div>
    );
  }

  // Data available
  const { subscription, credits } = billingData!;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
          <User className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">个人中心</h1>
          <p className="text-sm text-text-secondary">管理个人信息与账户设置</p>
        </div>
      </div>

      {/* Error banner (when data is also available) */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.04] px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span className="text-sm text-text-secondary">{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      )}

      {/* User info card */}
      <UserInfoCard
        email={user.email ?? ''}
        createdAt={user.created_at ?? new Date().toISOString()}
      />

      {/* Subscription + Credits grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SubscriptionStatusCard subscription={subscription} />
        <AICreditsCard credits={credits} />
      </div>

      {/* Account settings */}
      <AccountSettingsCard profile={profile} />

      {/* Danger zone */}
      <DangerZone />
    </div>
  );
}
