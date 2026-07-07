// API: 供应链管理
// GET  /api/supply-chain — 获取数据源、库存、采购列表
// POST /api/supply-chain — 创建或更新采购项目

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';

export async function GET() {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;

    const [sourcesResult, inventoryResult, procurementResult] = await Promise.allSettled([
      // Data sources
      supabase
        .from('sc_data_sources')
        .select('id, name, source_type, url, status, last_sync_at, sync_frequency, records_count, error_count, created_at')
        .order('created_at', { ascending: false }),

      // Inventory
      supabase
        .from('sc_inventory')
        .select('id, data_type, total_records, valid_records, last_updated, coverage_rate, quality_score, notes')
        .order('last_updated', { ascending: false }),

      // Procurement items
      supabase
        .from('sc_procurement')
        .select('id, item_name, vendor, amount, status, order_date, delivery_date, notes, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    const dataSources =
      sourcesResult.status === 'fulfilled' ? sourcesResult.value.data ?? [] : [];
    const inventory =
      inventoryResult.status === 'fulfilled' ? inventoryResult.value.data ?? [] : [];
    const procurementItems =
      procurementResult.status === 'fulfilled' ? procurementResult.value.data ?? [] : [];

    return NextResponse.json({
      success: true,
      data: { dataSources, inventory, procurementItems },
    });
  } catch (err) {
    console.error('[supply-chain GET]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '查询供应链数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const supabase = await createClient();
    const userId = auth.user.id;
    const body = await request.json();

    const { name, supplier, expected_delivery } = body;

    if (!name) {
      return NextResponse.json(
        { error: '缺少必填参数: name' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('sc_procurement')
      .upsert({
        user_id: userId,
        item_name: name,
        vendor: supplier ?? null,
        amount: body.amount != null ? Number(body.amount) : 0,
        status: 'pending',
        order_date: new Date().toISOString(),
        delivery_date: expected_delivery ?? null,
        notes: body.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[supply-chain POST]', err);
    if (err instanceof Error && err.name === 'AuthError') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: '创建采购项目失败' }, { status: 500 });
  }
}
