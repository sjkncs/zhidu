'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Mail } from 'lucide-react';
import { Button, Input } from '@zhidu/ui';
import { createClient } from '@/lib/supabase/client';

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, '请输入邮箱地址')
    .email('请输入有效的邮箱地址'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(data.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (resetError) throw resetError;

      setIsSubmitted(true);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('User not found')) {
          setError('该邮箱地址尚未注册');
        } else {
          setError('发送失败，请稍后重试');
        }
      } else {
        setError('发送失败，请稍后重试');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-blue-50/30 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
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
          {isSubmitted ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
                <CheckCircle className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="mb-2 text-lg font-semibold text-text-primary">
                邮件已发送
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-text-secondary">
                我们已向你的邮箱发送了密码重置链接，请查收并按照邮件中的指引重置密码。如未收到，请检查垃圾邮件文件夹。
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue transition hover:text-blue-dark"
              >
                <ArrowLeft className="h-4 w-4" />
                返回登录
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
                  <Mail className="h-5 w-5 text-blue" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    找回密码
                  </h2>
                  <p className="text-sm text-text-secondary">
                    输入注册邮箱，我们将发送重置链接
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex flex-col gap-5"
              >
                <Input
                  label="邮箱"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <Button
                  type="submit"
                  loading={isSubmitting}
                  fullWidth
                  size="lg"
                  className="bg-blue hover:bg-blue-dark"
                >
                  发送重置链接
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition hover:text-text-primary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回登录
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
