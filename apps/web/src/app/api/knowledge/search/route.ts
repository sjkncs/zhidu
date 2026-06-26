// API: 知识库检索 — 基于 pg_trgm 相似度搜索
// POST /api/knowledge/search
// Body: { query: string, collections?: string[], topK?: number }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, collections, topK = 10 } = body;

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

    // 调用 search_knowledge RPC 函数
    const { data, error } = await supabase.rpc('search_knowledge', {
      query_text: query,
      collection_filter: collections?.length ? collections : null,
      match_limit: Math.min(topK, 50),
      similarity_threshold: 0.05,
    });

    if (error) {
      console.error('[Knowledge Search] RPC error:', error.message);
      return NextResponse.json(
        { error: '知识库检索失败，请稍后重试' },
        { status: 500 },
      );
    }

    // 格式化返回结果
    const chunks = (data ?? []).map((row: any) => ({
      id: row.chunk_id,
      content: row.chunk_content,
      score: row.similarity_score,
      metadata: {
        title: row.doc_title,
        collection: row.doc_collection,
        sourceUrl: row.doc_source_url,
        documentMetadata: row.doc_metadata,
        chunkMetadata: row.chunk_metadata,
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        query,
        chunks,
        total: chunks.length,
      },
    });
  } catch (err: any) {
    console.error('[API] knowledge search error:', err);
    return NextResponse.json(
      { error: err.message || '知识库检索服务暂时不可用' },
      { status: 500 },
    );
  }
}
