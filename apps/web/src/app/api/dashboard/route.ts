// API: Dashboard 聚合数据
// GET /api/dashboard — 返回最近活动 + 即将到来的截止日期 + 汇总统计

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ActivityItem {
  id: string;
  type: 'course' | 'diary' | 'memo' | 'goal' | 'skill' | 'resume';
  title: string;
  subtitle?: string;
  href: string;
  createdAt: string;
}

interface DeadlineItem {
  id: string;
  type: 'todo' | 'memo';
  title: string;
  dueDate: string;
  href: string;
  isOverdue: boolean;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const userId = user.id;
    const now = new Date();
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    // Fetch all data in parallel
    const [
      recentCourses,
      recentDiaries,
      recentMemos,
      recentGoals,
      upcomingTodos,
      upcomingMemos,
    ] = await Promise.allSettled([
      // Recent courses
      supabase
        .from('courses')
        .select('id, name, grade, updated_at, created_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(3),
      // Recent diaries
      supabase
        .from('diary_entries')
        .select('id, title, entry_date, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3),
      // Recent memos
      supabase
        .from('memos')
        .select('id, title, content, created_at')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(3),
      // Recent goals
      supabase
        .from('goals')
        .select('id, title, status, updated_at, created_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(3),
      // Upcoming todos (due within 7 days, not completed)
      supabase
        .from('todos')
        .select('id, title, due_date, priority')
        .eq('user_id', userId)
        .eq('completed', false)
        .lte('due_date', sevenDaysLater.toISOString())
        .gte('due_date', now.toISOString())
        .order('due_date', { ascending: true })
        .limit(5),
      // Upcoming memos with remindAt
      supabase
        .from('memos')
        .select('id, title, remind_at')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .not('remind_at', 'is', null)
        .lte('remind_at', sevenDaysLater.toISOString())
        .gte('remind_at', now.toISOString())
        .order('remind_at', { ascending: true })
        .limit(5),
    ]);

    // Build activity items
    const activities: ActivityItem[] = [];

    if (recentCourses.status === 'fulfilled' && recentCourses.value.data) {
      for (const c of recentCourses.value.data) {
        activities.push({
          id: c.id,
          type: 'course',
          title: (c as any).name,
          subtitle: (c as any).grade != null ? `成绩: ${(c as any).grade}` : undefined,
          href: '/dashboard/academic',
          createdAt: (c as any).updated_at || (c as any).created_at,
        });
      }
    }

    if (recentDiaries.status === 'fulfilled' && recentDiaries.value.data) {
      for (const d of recentDiaries.value.data) {
        activities.push({
          id: d.id,
          type: 'diary',
          title: (d as any).title || '无标题日记',
          href: '/dashboard/diary',
          createdAt: (d as any).created_at,
        });
      }
    }

    if (recentMemos.status === 'fulfilled' && recentMemos.value.data) {
      for (const m of recentMemos.value.data) {
        const content = (m as any).content || '';
        activities.push({
          id: m.id,
          type: 'memo',
          title: (m as any).title || content.slice(0, 30),
          href: '/dashboard/memo',
          createdAt: (m as any).created_at,
        });
      }
    }

    if (recentGoals.status === 'fulfilled' && recentGoals.value.data) {
      for (const g of recentGoals.value.data) {
        activities.push({
          id: g.id,
          type: 'goal',
          title: (g as any).title,
          subtitle: (g as any).status === 'COMPLETED' ? '已完成' : '进行中',
          href: '/dashboard/career',
          createdAt: (g as any).updated_at || (g as any).created_at,
        });
      }
    }

    // Sort activities by date descending, take top 8
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const recentActivities = activities.slice(0, 8);

    // Build deadline items
    const deadlines: DeadlineItem[] = [];

    if (upcomingTodos.status === 'fulfilled' && upcomingTodos.value.data) {
      for (const t of upcomingTodos.value.data) {
        deadlines.push({
          id: t.id,
          type: 'todo',
          title: (t as any).title,
          dueDate: (t as any).due_date,
          href: '/dashboard/memo',
          isOverdue: new Date((t as any).due_date) < now,
        });
      }
    }

    if (upcomingMemos.status === 'fulfilled' && upcomingMemos.value.data) {
      for (const m of upcomingMemos.value.data) {
        deadlines.push({
          id: m.id,
          type: 'memo',
          title: (m as any).title || '提醒事项',
          dueDate: (m as any).remind_at,
          href: '/dashboard/memo',
          isOverdue: new Date((m as any).remind_at) < now,
        });
      }
    }

    // Sort deadlines by date ascending
    deadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return NextResponse.json({
      success: true,
      data: {
        recentActivities,
        upcomingDeadlines: deadlines.slice(0, 5),
      },
    });
  } catch (err) {
    console.error('[dashboard GET]', err);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
