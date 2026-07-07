// API: 品牌管理
// GET  /api/brand — 获取渠道列表、营销活动、近期内容
// POST /api/brand — 创建渠道或营销活动

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;

    const [channelsResult, campaignsResult, contentResult] = await Promise.allSettled([
      // Brand channels
      supabase
        .from('brand_channels')
        .select('id, channel_name, platform, channel_type, status, followers, engagement_rate, content_count, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Campaigns
      supabase
        .from('brand_campaigns')
        .select('id, name, campaign_type, channel_ids, status, budget, spent, start_date, end_date, kpi_targets, kpi_actuals, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Recent content
      supabase
        .from('brand_content')
        .select('id, title, channel_id, campaign_id, content_type, status, publish_date, metrics, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const channels =
      channelsResult.status === 'fulfilled' ? channelsResult.value.data ?? [] : [];
    const campaigns =
      campaignsResult.status === 'fulfilled' ? campaignsResult.value.data ?? [] : [];
    const recentContent =
      contentResult.status === 'fulfilled' ? contentResult.value.data ?? [] : [];

    return NextResponse.json({
      success: true,
      data: { channels, campaigns, recentContent },
    });
  } catch (err) {
    console.error('[brand GET]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询品牌数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;
    const body = await request.json();

    const { entity_type } = body;

    if (!entity_type || !['channel', 'campaign'].includes(entity_type)) {
      return NextResponse.json(
        { error: 'entity_type 必须为 channel 或 campaign' },
        { status: 400 },
      );
    }

    if (entity_type === 'channel') {
      const { name, platform } = body;
      if (!name || !platform) {
        return NextResponse.json(
          { error: '缺少必填参数: name, platform' },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from('brand_channels')
        .insert({
          user_id: userId,
          channel_name: name,
          platform,
          channel_type: body.channel_type ?? 'social',
          status: 'active',
          followers: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // entity_type === 'campaign'
    const { name, channel_id, start_date, end_date, budget } = body;
    if (!name) {
      return NextResponse.json(
        { error: '缺少必填参数: name' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('brand_campaigns')
      .insert({
        user_id: userId,
        name,
        campaign_type: body.campaign_type ?? 'content',
        status: 'planning',
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        budget: budget != null ? Number(budget) : 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[brand POST]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
