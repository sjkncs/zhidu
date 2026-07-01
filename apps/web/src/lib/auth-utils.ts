/**
 * API 鉴权工具
 *
 * 统一的 Supabase Auth 检查 + 管理员角色验证。
 * 用于 API Routes 中快速鉴权。
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface AuthResult {
  user: { id: string; email?: string; role?: string };
  isAdmin: boolean;
}

/**
 * 验证用户是否已登录
 * @returns AuthResult 或 null（未登录）
 */
export async function requireAuth(): Promise<AuthResult | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // 从 user_metadata 获取角色信息
  const role = (user.user_metadata as any)?.role ?? 'user';

  return {
    user: { id: user.id, email: user.email, role },
    isAdmin: role === 'admin',
  };
}

/**
 * 要求用户已登录，否则返回 401 Response
 */
export async function requireUser(): Promise<AuthResult> {
  const auth = await requireAuth();
  if (!auth) {
    throw new AuthError('请先登录', 401);
  }
  return auth;
}

/**
 * 要求用户为管理员角色，否则返回 403 Response
 */
export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireUser();
  if (!auth.isAdmin) {
    throw new AuthError('需要管理员权限', 403);
  }
  return auth;
}

/**
 * 鉴权错误类
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * 将 AuthError 转为 NextResponse
 */
export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: '鉴权失败' }, { status: 401 });
}
