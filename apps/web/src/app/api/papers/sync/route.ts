// API: 论文同步 — 从 arXiv 抓取最新论文
// POST /api/papers/sync
// Body: { categories?, keywords?, maxResults? }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchArxivPapers, upsertPapers, DEFAULT_CATEGORIES } from '@zhidu/ai';

// 速率限制：每用户每小时最多同步 5 次
const SYNC_LIMIT_PER_HOUR = 5;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    // 简单速率限制（基于数据库记录）
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentSyncs } = await supabase
      .from('paper_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('interaction_type', 'investigate')
      .gte('created_at', oneHourAgo);

    if ((recentSyncs || 0) >= SYNC_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: `同步频率过高，每小时最多 ${SYNC_LIMIT_PER_HOUR} 次，请稍后再试` },
        { status: 429 },
      );
    }

    // 解析请求参数
    const body = await request.json().catch(() => ({}));
    const categories: string[] = body.categories || DEFAULT_CATEGORIES.slice(0, 10);
    const keywords: string[] = body.keywords || [];
    const maxResults = Math.min(100, Math.max(10, body.maxResults || 50));

    // 从 arXiv 抓取
    const papers = await fetchArxivPapers({
      categories,
      keywords,
      maxResults,
      sortBy: 'lastUpdatedDate',
      sortOrder: 'descending',
    });

    if (papers.length === 0) {
      return NextResponse.json({
        success: true,
        data: { inserted: 0, updated: 0, errors: 0, message: '未找到新论文' },
      });
    }

    // 入库
    const result = await upsertPapers(supabase, papers);

    // 记录同步操作（用于速率限制）
    await supabase.from('paper_interactions').insert({
      user_id: user.id,
      paper_id: papers[0] ? (await supabase.from('papers').select('id').eq('arxiv_id', papers[0].arxivId).single()).data?.id : null,
      interaction_type: 'investigate',
      note: `Sync: ${papers.length} papers fetched, ${result.inserted} new, ${result.updated} updated`,
    }).catch(() => {});  // 非关键操作，忽略错误

    return NextResponse.json({
      success: true,
      data: {
        fetched: papers.length,
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors,
        categories: categories,
        keywords: keywords,
      },
    });
  } catch (err) {
    console.error('[Papers Sync] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 },
    );
  }
}
