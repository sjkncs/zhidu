// API: 院校结构化查询
// GET /api/data/universities
// Query: name, province, tier, is_985, is_211, school_type, page, pageSize

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const name = searchParams.get('name');
    const province = searchParams.get('province');
    const tier = searchParams.get('tier');
    const is985 = searchParams.get('is_985');
    const is211 = searchParams.get('is_211');
    const schoolType = searchParams.get('school_type');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));

    const supabase = await createClient();

    // 构建查询
    let query = supabase
      .from('universities')
      .select('*', { count: 'exact' });

    // 应用筛选条件
    if (name) {
      query = query.ilike('name', `%${name}%`);
    }
    if (province) {
      query = query.eq('province', province);
    }
    if (tier) {
      query = query.eq('tier', tier);
    }
    if (is985 !== null && is985 !== undefined && is985 !== '') {
      query = query.eq('is_985', is985 === 'true');
    }
    if (is211 !== null && is211 !== undefined && is211 !== '') {
      query = query.eq('is_211', is211 === 'true');
    }
    if (schoolType) {
      query = query.eq('school_type', schoolType);
    }

    // 分页
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('[Universities] query error:', error.message);
      return NextResponse.json(
        { error: '院校数据查询失败，请稍后重试' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        universities: data ?? [],
        total: count ?? 0,
        page,
        pageSize,
      },
    });
  } catch (err: any) {
    console.error('[API] universities error:', err);
    return NextResponse.json(
      { error: err.message || '院校数据服务暂时不可用' },
      { status: 500 },
    );
  }
}
