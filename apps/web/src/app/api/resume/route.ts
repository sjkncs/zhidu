// API: 简历列表 / 创建
// GET  /api/resume  — 获取用户简历
// POST /api/resume  — 创建简历

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserResumes, createResume } from '@zhidu/db/repository';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const resumes = await getUserResumes(user.id);

    return NextResponse.json({ success: true, data: resumes, count: resumes.length });
  } catch (err) {
    console.error('[resume GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, data, targetRole } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: '缺少必填参数: title' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const resume = await createResume({
      userId: user.id,
      title,
      data: data ?? {},
      targetRole,
    });

    if (!resume) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: resume });
  } catch (err) {
    console.error('[resume POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
