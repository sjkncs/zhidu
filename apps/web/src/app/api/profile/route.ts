// API: 用户资料
// GET  /api/profile — 获取当前用户资料
// PATCH /api/profile — 更新用户资料

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', auth.user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

    return NextResponse.json({
      success: true,
      profile: profile ?? null,
      email: auth.user.email ?? null,
      createdAt: auth.user.created_at ?? null,
    });
  } catch (err) {
    console.error('[profile GET]', err);
    if (err instanceof AuthError) return authErrorResponse(err);
    return NextResponse.json({ error: '查询资料失败' }, { status: 500 });
  }
}

// 允许更新的字段白名单
const ALLOWED_FIELDS = [
  'province', 'grade', 'total_score', 'subject_scores',
  'subject_combination', 'track', 'rank',
  'interests', 'target_cities', 'notes',
] as const;

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const body = await request.json();

    // 只取白名单字段
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: '没有可更新的字段' },
        { status: 400 },
      );
    }

    // 基本校验
    if (updates.total_score != null) {
      const score = Number(updates.total_score);
      if (isNaN(score) || score < 0 || score > 750) {
        return NextResponse.json(
          { error: '总分必须在 0-750 之间' },
          { status: 400 },
        );
      }
      updates.total_score = score;
    }

    if (updates.rank != null) {
      const rank = Number(updates.rank);
      if (isNaN(rank) || rank < 1) {
        return NextResponse.json(
          { error: '位次必须为正整数' },
          { status: 400 },
        );
      }
      updates.rank = rank;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', auth.user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      profile: data,
    });
  } catch (err) {
    console.error('[profile PATCH]', err);
    if (err instanceof AuthError) return authErrorResponse(err);
    return NextResponse.json({ error: '更新资料失败' }, { status: 500 });
  }
}
