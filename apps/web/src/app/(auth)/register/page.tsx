'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Button, Input } from '@zhidu/ui';
import { signUp } from '@/lib/supabase/actions';

const provinces = [
  '北京', '天津', '上海', '重庆',
  '河北', '山西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广东', '海南',
  '四川', '贵州', '云南', '陕西', '甘肃', '青海',
  '内蒙古', '广西', '西藏', '宁夏', '新疆',
  '香港', '澳门', '台湾',
];

const grades = [
  { value: '高二', label: '高二' },
  { value: '高三', label: '高三' },
  { value: '大一', label: '大一' },
  { value: '大二', label: '大二' },
  { value: '大三', label: '大三' },
  { value: '大四', label: '大四' },
];

const registerSchema = z
  .object({
    email: z.string().min(1, '请输入邮箱地址').email('请输入有效的邮箱地址'),
    password: z.string().min(6, '密码至少 6 个字符'),
    confirmPassword: z.string().min(1, '请确认密码'),
    province: z.string().min(1, '请选择省份'),
    grade: z.string().min(1, '请选择年级'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signUp({
        email: data.email,
        password: data.password,
        province: data.province,
        grade: data.grade,
      });
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('User already registered')) {
          setError('该邮箱已被注册，请直接登录');
        } else {
          setError('注册失败，请稍后重试');
        }
      } else {
        setError('注册失败，请稍后重试');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text-primary transition-colors focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20 focus:ring-offset-1';

  return (
    <div className="w-full max-w-md">
      {/* Logo + branding */}
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-2xl text-white">
          知
        </div>
        <h1 className="text-2xl font-bold text-text-primary">知渡</h1>
        <p className="mt-1 text-sm text-text-secondary">
          开启你的 AI 成长之旅
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-text-primary">
          注册账号
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
            placeholder="至少 6 个字符"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Input
            label="确认密码"
            type="password"
            placeholder="再次输入密码"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {/* Province select */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              所在省份
            </label>
            <select
              className={selectClass}
              {...register('province')}
            >
              <option value="">请选择省份</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {errors.province && (
              <p className="text-xs text-red-500">{errors.province.message}</p>
            )}
          </div>

          {/* Grade select */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              当前年级
            </label>
            <select
              className={selectClass}
              {...register('grade')}
            >
              <option value="">请选择年级</option>
              {grades.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            {errors.grade && (
              <p className="text-xs text-red-500">{errors.grade.message}</p>
            )}
          </div>

          <Button
            type="submit"
            loading={isSubmitting}
            fullWidth
            size="lg"
            className="bg-blue hover:bg-blue-dark"
          >
            注册
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-text-secondary">
          已有账号？{' '}
          <Link
            href="/login"
            className="font-medium text-blue hover:text-blue-dark transition-colors"
          >
            立即登录
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-text-tertiary">
        注册即表示同意知渡的{' '}
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
