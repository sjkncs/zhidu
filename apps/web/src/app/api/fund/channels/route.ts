// API: 资金渠道管理
// GET  /api/fund/channels — 获取用户的支付/投资渠道
// POST /api/fund/channels — 添加渠道

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse, AuthError } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();

    const { data: channels, error } = await supabase
      .from('fund_channels')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      channels: channels ?? [],
    });
  } catch (err) {
    console.error('[fund/channels GET]', err);
    if (err instanceof AuthError) return authErrorResponse(err);
    return NextResponse.json({ error: '查询渠道失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const body = await request.json();

    const { name, channelType, provider, accountHint, dailyLimit, metadata } = body;

    if (!name || !channelType || !provider) {
      return NextResponse.json(
        { error: '缺少必填参数: name, channelType, provider' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('fund_channels')
      .insert({
        user_id: auth.user.id,
        name: name.trim(),
        channel_type: channelType,
        provider: provider.trim(),
        account_hint: accountHint ?? null,
        daily_limit: dailyLimit ?? null,
        metadata: metadata ?? {},
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, channel: data },
      { status: 201 },
    );
  } catch (err) {
    console.error('[fund/channels POST]', err);
    if (err instanceof AuthError) return authErrorResponse(err);
    return NextResponse.json({ error: '添加渠道失败' }, { status: 500 });
  }
}
