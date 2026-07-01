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
      // 双一流是 985/211 的超集：点击"双一流"应显示所有 985+211+双一流院校
      if (tier === '双一流') {
        query = query.in('tier', ['985', '211', '双一流']);
      } else {
        query = query.eq('tier', tier);
      }
    }
    // 985/211 兼容筛选：同时匹配布尔列和 tier 文本列
    // 当 is_985/is_211 布尔列未被 migration 回填时，回退到 tier 列
    if (is985 === 'true') {
      query = query.or('is_985.eq.true,tier.eq.985');
    }
    if (is211 === 'true') {
      query = query.or('is_211.eq.true,tier.in.(985,211)');
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
