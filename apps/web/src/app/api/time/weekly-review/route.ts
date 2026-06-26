// API: AI 周回顾
// POST /api/time/weekly-review  — 生成本周时间利用分析报告

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserTodos, getUserPomodoroSessions, getUserScheduleEvents } from '@zhidu/db/repository';
import { createLLMService, buildWeeklyReviewPrompt } from '@zhidu/ai';
import type { WeeklyReviewResult } from '@zhidu/ai';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json();
    const weekStart = body.weekStart;
    const weekEnd = body.weekEnd;

    if (!weekStart || !weekEnd) {
      return NextResponse.json({ error: '缺少参数: weekStart, weekEnd' }, { status: 400 });
    }

    // 并行获取本周数据
    const [todos, pomodoroSessions, events] = await Promise.all([
      getUserTodos(user.id),
      getUserPomodoroSessions(user.id, { startDate: weekStart, endDate: weekEnd }),
      getUserScheduleEvents(user.id, { startTime: weekStart, endTime: weekEnd }),
    ]);

    const completedPomodoros = pomodoroSessions.filter(s => s.completed);
    const pomodoroMinutes = completedPomodoros.reduce((sum, s) => sum + s.durationMinutes, 0);

    const eventDurations = events.map(e => {
      const start = new Date(e.startTime).getTime();
      const end = e.endTime ? new Date(e.endTime).getTime() : start + 60 * 60 * 1000;
      return {
        title: e.title,
        eventType: e.eventType,
        duration: Math.round((end - start) / 60000),
      };
    });

    const messages = buildWeeklyReviewPrompt({
      weekStart,
      weekEnd,
      todos: todos.map(t => ({
        title: t.title,
        completed: t.completed,
        category: t.category,
        priority: t.priority ?? 3,
      })),
      pomodoroCount: completedPomodoros.length,
      pomodoroMinutes,
      events: eventDurations,
    });

    const llm = createLLMService();
    const result = await llm.chatJSON<WeeklyReviewResult>({
      messages,
      options: { temperature: 0.6, maxTokens: 2048 },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[time/weekly-review POST]', err);
    return NextResponse.json({ error: '生成失败' }, { status: 500 });
  }
}
