// API: 专业结构化查询
// GET /api/data/majors
// Query: name, category, discipline_category, degree, page, pageSize

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const name = searchParams.get('name');
    const category = searchParams.get('category');
    const disciplineCategory = searchParams.get('discipline_category');
    const degree = searchParams.get('degree');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));

    const supabase = await createClient();

    let query = supabase
      .from('majors')
      .select('*', { count: 'exact' });

    if (name) {
      query = query.ilike('name', `%${name}%`);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (disciplineCategory) {
      query = query.eq('discipline_category', disciplineCategory);
    }
    if (degree) {
      query = query.eq('degree', degree);
    }

    // 分页
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('[Majors] query error:', error.message);
      return NextResponse.json(
        { error: '专业数据查询失败，请稍后重试' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        majors: data ?? [],
        total: count ?? 0,
        page,
        pageSize,
      },
    });
  } catch (err: any) {
    console.error('[API] majors error:', err);
    return NextResponse.json(
      { error: err.message || '专业数据服务暂时不可用' },
      { status: 500 },
    );
  }
}
