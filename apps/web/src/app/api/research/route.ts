// API: 科研项目
// GET  /api/research  — 获取用户科研项目（可选 ?status=ONGOING|COMPLETED 筛选）
// POST /api/research  — 创建科研项目

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserResearchProjects, createResearchProject } from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'ONGOING' | 'COMPLETED' | null;

    const projects = await getUserResearchProjects(user.id, {
      status: status || undefined,
    });

    return NextResponse.json({ success: true, data: projects, count: projects.length });
  } catch (err) {
    console.error('[research GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, role, description, advisor, startDate, endDate, status } = body;

    if (!title || !role || !startDate) {
      return NextResponse.json(
        { error: '缺少必填参数: title, role, startDate' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const project = await createResearchProject({
      userId: user.id,
      title,
      role,
      description,
      advisor,
      startDate,
      endDate,
      status,
    });

    if (!project) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: project });
  } catch (err) {
    console.error('[research POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
