// API: 单个志愿方案 — 查看 / 更新状态 / 删除
// GET    /api/volunteer/plans/[id]  → 获取方案详情及其志愿条目
// PATCH  /api/volunteer/plans/[id]  → 更新方案状态
// DELETE /api/volunteer/plans/[id]  → 删除方案（依赖 FK 级联删除条目）

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getPlanById,
  getPlanItems,
  updatePlanStatus,
} from '@zhidu/db/repository';

const VALID_STATUSES = ['DRAFT', 'IN_PROGRESS', 'FINALIZED', 'SUBMITTED'] as const;

/**
 * GET — 获取方案详情及其所有志愿条目
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const plan = await getPlanById(id);

    if (!plan) {
      return NextResponse.json({ error: '方案不存在' }, { status: 404 });
    }

    // 权限校验：只允许查看自己的方案
    if (plan.userId !== user.id) {
      return NextResponse.json({ error: '无权访问该方案' }, { status: 403 });
    }

    const items = await getPlanItems(id);

    return NextResponse.json({
      success: true,
      data: {
        ...plan,
        items,
      },
    });
  } catch (err) {
    console.error('[volunteer/plans/[id] GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

/**
 * PATCH — 更新方案状态
 * Body: { status: 'DRAFT' | 'IN_PROGRESS' | 'FINALIZED' | 'SUBMITTED' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const plan = await getPlanById(id);

    if (!plan) {
      return NextResponse.json({ error: '方案不存在' }, { status: 404 });
    }

    if (plan.userId !== user.id) {
      return NextResponse.json({ error: '无权操作该方案' }, { status: 403 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `无效的 status 值，可选: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    await updatePlanStatus(id, status);

    const updated = await getPlanById(id);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('[volunteer/plans/[id] PATCH]', err);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

/**
 * DELETE — 删除方案（FK 级联删除关联的志愿条目）
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const plan = await getPlanById(id);

    if (!plan) {
      return NextResponse.json({ error: '方案不存在' }, { status: 404 });
    }

    if (plan.userId !== user.id) {
      return NextResponse.json({ error: '无权操作该方案' }, { status: 403 });
    }

    // 删除方案 — plan_items 通过 FK ON DELETE CASCADE 自动级联删除
    const { error } = await supabase
      .from('application_plans')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[volunteer/plans/[id] DELETE] DB error:', error.message);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[volunteer/plans/[id] DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
