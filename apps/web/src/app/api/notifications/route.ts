// API: 通知管理
// GET  /api/notifications — 获取用户通知列表 + 未读数量
// POST /api/notifications — 标记已读 / 全部已读

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@zhidu/db/repository';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '30');

    const [notifications, unreadCount] = await Promise.all([
      getUserNotifications(user.id, { unreadOnly, limit }),
      getUnreadNotificationCount(user.id),
    ]);

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (err) {
    console.error('[notifications GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json();
    const { action, notificationId } = body;

    if (action === 'markRead' && notificationId) {
      const ok = await markNotificationRead(notificationId);
      return ok
        ? NextResponse.json({ success: true })
        : NextResponse.json({ error: '标记失败' }, { status: 500 });
    }

    if (action === 'markAllRead') {
      const ok = await markAllNotificationsRead(user.id);
      return ok
        ? NextResponse.json({ success: true })
        : NextResponse.json({ error: '标记失败' }, { status: 500 });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (err) {
    console.error('[notifications POST]', err);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
