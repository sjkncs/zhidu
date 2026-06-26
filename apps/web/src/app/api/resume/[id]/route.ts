// API: 单份简历
// GET    /api/resume/[id]  — 获取简历
// PATCH  /api/resume/[id]  — 更新简历
// DELETE /api/resume/[id]  — 删除简历

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getResumeById, updateResume, deleteResume } from '@zhidu/db/repository';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const resume = await getResumeById(id);
    if (!resume) return NextResponse.json({ error: '简历不存在' }, { status: 404 });
    if (resume.userId !== user.id) return NextResponse.json({ error: '无权访问' }, { status: 403 });

    return NextResponse.json({ success: true, data: resume });
  } catch (err) {
    console.error('[resume GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const existing = await getResumeById(id);
    if (!existing) return NextResponse.json({ error: '简历不存在' }, { status: 404 });
    if (existing.userId !== user.id) return NextResponse.json({ error: '无权操作' }, { status: 403 });

    const body = await request.json();
    const resume = await updateResume(id, body);

    if (!resume) return NextResponse.json({ error: '更新失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: resume });
  } catch (err) {
    console.error('[resume PATCH]', err);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const existing = await getResumeById(id);
    if (!existing) return NextResponse.json({ error: '简历不存在' }, { status: 404 });
    if (existing.userId !== user.id) return NextResponse.json({ error: '无权操作' }, { status: 403 });

    const ok = await deleteResume(id);
    if (!ok) return NextResponse.json({ error: '删除失败' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[resume DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
