'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { Button, Input } from '@zhidu/ui';
import { signIn } from '@/lib/supabase/actions';

const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱地址').email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码').min(6, '密码至少 6 个字符'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn({ email: data.email, password: data.password });
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Invalid login credentials')) {
          setError('邮箱或密码错误，请重试');
        } else if (err.message.includes('Email not confirmed')) {
          setError('请先验证邮箱后再登录');
        } else {
          setError('登录失败，请稍后重试');
        }
      } else {
        setError('登录失败，请稍后重试');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo + branding */}
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-2xl text-white">
          知
        </div>
        <h1 className="text-2xl font-bold text-text-primary">知渡</h1>
        <p className="mt-1 text-sm text-text-secondary">
          AI 志愿填报与大学生成长平台
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-text-primary">
          登录账号
        </h2>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <Input
            label="邮箱"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="密码"
            type="password"
            placeholder="输入密码"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue accent-blue"
              />
              记住我
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-blue hover:text-blue-dark transition-colors"
            >
              忘记密码？
            </Link>
          </div>

          <Button
            type="submit"
            loading={isSubmitting}
            fullWidth
            size="lg"
            className="bg-blue hover:bg-blue-dark"
          >
            登录
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-text-secondary">
          还没有账号？{' '}
          <Link
            href="/register"
            className="font-medium text-blue hover:text-blue-dark transition-colors"
          >
            立即注册
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-text-tertiary">
        登录即表示同意知渡的{' '}
        <Link href="/terms" className="underline hover:text-text-secondary">
          服务条款
        </Link>{' '}
        和{' '}
        <Link href="/privacy" className="underline hover:text-text-secondary">
          隐私政策
        </Link>
      </p>
    </div>
  );
}
