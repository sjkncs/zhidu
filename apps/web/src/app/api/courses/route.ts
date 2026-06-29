// API: 课程管理
// GET  /api/courses  — 获取课程列表（支持 ?semester= 和 ?category= 过滤）
// POST /api/courses  — 创建课程

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserCourses, createCourse } from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const semester = searchParams.get('semester') || undefined;
    const category = searchParams.get('category') || undefined;

    const courses = await getUserCourses(user.id, { semester, category });
    return NextResponse.json({ success: true, data: courses, count: courses.length });
  } catch (err) {
    console.error('[courses GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, credit, grade, gradePoint, semester, category, teacher, notes } = body;

    if (!name || credit === undefined) {
      return NextResponse.json({ error: '缺少必填参数: name, credit' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const course = await createCourse(user.id, {
      name, credit, grade, gradePoint, semester, category, teacher, notes,
    });

    if (!course) return NextResponse.json({ error: '创建失败' }, { status: 500 });
    return NextResponse.json({ success: true, data: course });
  } catch (err) {
    console.error('[courses POST]', err);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
