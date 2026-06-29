// API: 学期管理
// GET  /api/semesters  — 获取学期列表
// POST /api/semesters  — 创建学期

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSemesters, createSemester } from '@zhidu/db/repository';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const semesters = await getUserSemesters(user.id);
    return NextResponse.json({ success: true, data: semesters, count: semesters.length });
  } catch (err) {
    console.error('[semesters GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, startDate, endDate, isCurrent } = body;

    if (!name) {
      return NextResponse.json({ error: '缺少必填参数: name' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const semester = await createSemester(user.id, { name, startDate, endDate, isCurrent });
    if (!semester) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: semester });
  } catch (err) {
    console.error('[semesters POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
