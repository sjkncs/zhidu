// API: 信息中心
// GET  /api/info-center — 获取公告、书签、信息流
// POST /api/info-center — 创建书签

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;

    const [announcementsResult, bookmarksResult, feedsResult] = await Promise.allSettled([
      // Announcements
      supabase
        .from('ic_announcements')
        .select('id, title, content, category, priority, is_pinned, published_at, expires_at, view_count')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(10),

      // User bookmarks
      supabase
        .from('ic_bookmarks')
        .select('id, title, url, description, category, tags, is_favorite, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Feed items
      supabase
        .from('ic_feeds')
        .select('id, source, feed_url, title, category, last_fetched_at, is_active')
        .order('last_fetched_at', { ascending: false })
        .limit(20),
    ]);

    const announcements =
      announcementsResult.status === 'fulfilled' ? announcementsResult.value.data ?? [] : [];
    const bookmarks =
      bookmarksResult.status === 'fulfilled' ? bookmarksResult.value.data ?? [] : [];
    const feeds =
      feedsResult.status === 'fulfilled' ? feedsResult.value.data ?? [] : [];

    return NextResponse.json({
      success: true,
      data: { announcements, bookmarks, feeds },
    });
  } catch (err) {
    console.error('[info-center GET]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询信息中心失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;
    const body = await request.json();

    const { title, url, description, category } = body;

    if (!title || !url) {
      return NextResponse.json(
        { error: '缺少必填参数: title, url' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('ic_bookmarks')
      .insert({
        user_id: userId,
        title,
        url,
        description: description ?? null,
        category: category ?? null,
        tags: body.tags ?? [],
        is_favorite: body.is_favorite ?? false,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[info-center POST]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '创建书签失败' }, { status: 500 });
  }
}
