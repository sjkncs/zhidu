// API: 实习经历
// GET  /api/internship  — 获取用户实习经历
// POST /api/internship  — 创建实习经历

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserInternships, createInternship } from '@zhidu/db/repository';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const internships = await getUserInternships(user.id);

    return NextResponse.json({ success: true, data: internships, count: internships.length });
  } catch (err) {
    console.error('[internship GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company, role, description, startDate, endDate, current } = body;

    if (!company || !role || !startDate) {
      return NextResponse.json(
        { error: '缺少必填参数: company, role, startDate' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const internship = await createInternship({
      userId: user.id,
      company,
      role,
      description,
      startDate,
      endDate,
      current,
    });

    if (!internship) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: internship });
  } catch (err) {
    console.error('[internship POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
