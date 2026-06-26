// API: AI 成长洞察
// POST /api/diary/insights  — 基于日记数据生成成长洞察报告

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserDiaryEntries } from '@zhidu/db/repository';
import { createLLMService, buildGrowthInsightsPrompt } from '@zhidu/ai';
import type { GrowthInsightResult } from '@zhidu/ai';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await request.json();
    const period = body.period || '近 30 天';
    const startDate = body.startDate;
    const endDate = body.endDate;

    const entries = await getUserDiaryEntries(user.id, {
      startDate,
      endDate,
      limit: 60,
    });

    if (entries.length === 0) {
      return NextResponse.json({
        error: '暂无日记数据，无法生成洞察报告。请先记录一些日记。',
      }, { status: 400 });
    }

    const messages = buildGrowthInsightsPrompt({
      period,
      entries: entries.map(e => ({
        date: e.entryDate,
        mood: e.mood ?? 5,
        moodTags: e.moodTags ?? [],
        title: e.title ?? '',
        contentPreview: e.content.slice(0, 120),
      })),
    });

    const llm = createLLMService();
    const result = await llm.chatJSON<GrowthInsightResult>({
      messages,
      options: { temperature: 0.6, maxTokens: 2048 },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[diary/insights POST]', err);
    return NextResponse.json({ error: '生成失败' }, { status: 500 });
  }
}
