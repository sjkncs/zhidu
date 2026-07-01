// @zhidu/db — 通知

import { getDb } from '../utils';
import type { NotificationRow } from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// Notification 通知
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<NotificationRow[]> {
  try {
    let query = getDb()
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(options.limit ?? 30);

    if (options.unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) { console.error('[getUserNotifications]', error.message); return []; }
    return (data ?? []).map(mapNotification);
  } catch (err) {
    console.error('[getUserNotifications]', err);
    return [];
  }
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const { count, error } = await getDb()
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) { console.error('[getUnreadNotificationCount]', error.message); return 0; }
    return count ?? 0;
  } catch (err) {
    console.error('[getUnreadNotificationCount]', err);
    return 0;
  }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    const { error } = await getDb()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) { console.error('[markNotificationRead]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[markNotificationRead]', err);
    return false;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  try {
    const { error } = await getDb()
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) { console.error('[markAllNotificationsRead]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[markAllNotificationsRead]', err);
    return false;
  }
}

export async function createNotification(notification: {
  userId: string;
  type?: 'info' | 'success' | 'warning' | 'reminder' | 'system';
  title: string;
  content?: string;
  href?: string;
}): Promise<NotificationRow | null> {
  try {
    const { data, error } = await getDb()
      .from('notifications')
      .insert({
        user_id: notification.userId,
        type: notification.type ?? 'info',
        title: notification.title,
        content: notification.content,
        href: notification.href,
      })
      .select()
      .single();
    if (error) { console.error('[createNotification]', error.message); return null; }
    return mapNotification(data);
  } catch (err) {
    console.error('[createNotification]', err);
    return null;
  }
}

function mapNotification(row: any): NotificationRow {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    content: row.content,
    href: row.href,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}
