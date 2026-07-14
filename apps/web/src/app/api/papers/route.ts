// API: 论文列表 — 搜索、过滤、分页
// GET /api/papers?q=keyword&category=cs.AI&author=Smith&from=2024-01-01&to=2024-12-31&summarized=true&page=1&limit=20

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const url = request.nextUrl;
    const query = url.searchParams.get('q');
    const category = url.searchParams.get('category');
    const author = url.searchParams.get('author');
    const dateFrom = url.searchParams.get('from');
    const dateTo = url.searchParams.get('to');
    const hasSummary = url.searchParams.get('summarized') === 'true';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 使用 search_papers RPC
    const categoryFilter = category ? category.split(',') : null;

    const { data, error } = await supabase.rpc('search_papers', {
      query_text: query || null,
      category_filter: categoryFilter,
      author_filter: author || null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      has_summary: hasSummary || null,
      match_limit: limit,
      offset_count: offset,
    });

    if (error) {
      console.error('[Papers API] search_papers error:', error.message);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    const papers = data || [];
    const totalCount = papers.length > 0 ? (papers[0] as any).total_count : 0;

    // 如果用户已登录，获取用户的交互状态（收藏、阅读等）
    let userInteractions: Map<string, any> = new Map();
    if (user && papers.length > 0) {
      const paperIds = papers.map((p: any) => p.paper_id);
      const { data: interactions } = await supabase
        .from('paper_interactions')
        .select('paper_id, interaction_type, note, rating, created_at')
        .in('paper_id', paperIds)
        .eq('user_id', user.id);

      if (interactions) {
        for (const inter of interactions) {
          const key = `${inter.paper_id}:${inter.interaction_type}`;
          userInteractions.set(key, inter);
        }
      }
    }

    // 组装响应
    const enrichedPapers = papers.map((p: any) => ({
      id: p.paper_id,
      arxivId: p.arxiv_id,
      title: p.title,
      abstract: p.abstract,
      authors: p.authors,
      categories: p.categories,
      primaryCategory: p.primary_category,
      publishedAt: p.published_at,
      aiSummary: p.ai_summary,
      aiTags: p.ai_tags,
      relevanceScores: p.relevance_scores,
      pdfUrl: p.pdf_url,
      absUrl: p.abs_url,
      userInteraction: user ? {
        bookmarked: !!userInteractions.get(`${p.paper_id}:bookmark`),
        read: !!userInteractions.get(`${p.paper_id}:read`),
        note: userInteractions.get(`${p.paper_id}:note`)?.note || null,
        rating: userInteractions.get(`${p.paper_id}:note`)?.rating || null,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      data: enrichedPapers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    console.error('[Papers API] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
