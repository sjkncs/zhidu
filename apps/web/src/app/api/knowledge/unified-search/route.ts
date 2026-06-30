// API: 统一知识库检索 — 跨院校/专业/知识片段
// POST /api/knowledge/unified-search
// Body: { query, mode?, filters?, topK? }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type SearchMode = 'all' | 'structured' | 'knowledge';

interface SearchFilters {
  province?: string;
  tier?: string;
  category?: string;
  collection?: string;
  is_985?: boolean;
  is_211?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      mode = 'all',
      filters,
      topK = 20,
    } = body as {
      query: string;
      mode?: SearchMode;
      filters?: SearchFilters;
      topK?: number;
    };

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: query' },
        { status: 400 },
      );
    }

    if (query.length < 2) {
      return NextResponse.json(
        { error: '查询内容至少需要 2 个字符' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // 构建 filters JSONB 对象
    const filtersObj: Record<string, string | boolean> = {};
    if (filters?.province) filtersObj.province = filters.province;
    if (filters?.tier) filtersObj.tier = filters.tier;
    if (filters?.category) filtersObj.category = filters.category;
    if (filters?.collection) filtersObj.collection = filters.collection;
    if (filters?.is_985 !== undefined) filtersObj.is_985 = filters.is_985;
    if (filters?.is_211 !== undefined) filtersObj.is_211 = filters.is_211;

    // 调用 unified_search RPC 函数
    const { data, error } = await supabase.rpc('unified_search', {
      query_text: query,
      search_mode: mode,
      filters: filtersObj,
      match_limit: Math.min(topK, 50),
    });

    if (error) {
      console.error('[Unified Search] RPC error:', error.message);
      return NextResponse.json(
        { error: '知识库检索失败，请稍后重试' },
        { status: 500 },
      );
    }

    // 格式化返回结果
    const results = (data ?? []).map((row: any) => ({
      type: row.result_type,
      id: row.result_id,
      title: row.title,
      content: row.content,
      metadata: row.metadata ?? {},
      score: row.relevance_score,
    }));

    return NextResponse.json({
      success: true,
      data: {
        query,
        results,
        total: results.length,
      },
    });
  } catch (err: any) {
    console.error('[API] unified search error:', err);
    return NextResponse.json(
      { error: err.message || '知识库检索服务暂时不可用' },
      { status: 500 },
    );
  }
}
