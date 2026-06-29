// API: 课程详情 / 编辑 / 删除
// PUT    /api/courses/[id]  — 更新课程
// DELETE /api/courses/[id]  — 删除课程

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateCourse, deleteCourse } from '@zhidu/db/repository';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json();
    const { name, credit, grade, gradePoint, semester, category, teacher, notes } = body;

    const course = await updateCourse(id, {
      name, credit, grade, gradePoint, semester, category, teacher, notes,
    });

    if (!course) return NextResponse.json({ error: '更新失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: course });
  } catch (err) {
    console.error('[courses PUT]', err);
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

    const ok = await deleteCourse(id);
    if (!ok) return NextResponse.json({ error: '删除失败' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[courses DELETE]', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
