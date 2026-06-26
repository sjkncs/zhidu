// API: 志愿方案列表 — 查看 / 创建
// GET  /api/volunteer/plans           → 获取当前用户所有志愿方案
// POST /api/volunteer/plans           → 创建新志愿方案（可选附带志愿条目）

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getUserPlans,
  createPlan,
  addPlanItems,
} from '@zhidu/db/repository';
import type { PlanItemRow } from '@zhidu/db';

/**
 * GET — 获取当前用户的所有志愿方案（按创建时间倒序）
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const plans = await getUserPlans(user.id);

    return NextResponse.json({ success: true, data: plans });
  } catch (err) {
    console.error('[API] volunteer/plans GET error:', err);
    return NextResponse.json(
      { error: '获取志愿方案失败，请稍后重试' },
      { status: 500 },
    );
  }
}

/**
 * POST — 创建新的志愿方案
 * Body: { name: string, year: number, province: string, items?: PlanItemRow[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { name, year, province, items } = body;

    // ── 参数校验 ──
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: name（须为非空字符串）' },
        { status: 400 },
      );
    }

    if (!year || typeof year !== 'number') {
      return NextResponse.json(
        { error: '缺少必填参数: year（须为数字）' },
        { status: 400 },
      );
    }

    if (!province || typeof province !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: province（须为非空字符串）' },
        { status: 400 },
      );
    }

    if (items !== undefined && !Array.isArray(items)) {
      return NextResponse.json(
        { error: '参数错误: items 须为数组' },
        { status: 400 },
      );
    }

    // ── 创建方案 ──
    const plan = await createPlan({
      userId: user.id,
      name,
      year,
      province,
    });

    if (!plan) {
      return NextResponse.json(
        { error: '创建志愿方案失败，请稍后重试' },
        { status: 500 },
      );
    }

    // ── 可选：批量添加志愿条目 ──
    let savedItems: Partial<PlanItemRow>[] = [];

    if (items && items.length > 0) {
      savedItems = await addPlanItems(plan.id, items);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...plan,
        items: savedItems,
      },
    });
  } catch (err) {
    console.error('[API] volunteer/plans POST error:', err);
    return NextResponse.json(
      { error: '创建志愿方案失败，请稍后重试' },
      { status: 500 },
    );
  }
}
