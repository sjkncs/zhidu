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
        .from('supply_data_sources')
        .select('id, name, type, connection_status, last_sync_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Inventory
      supabase
        .from('inventory')
        .select('id, sku, name, quantity, warehouse, unit_cost, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),

      // Procurement items
      supabase
        .from('procurement_items')
        .select('id, name, supplier, quantity, unit_price, status, order_date, expected_delivery, created_at')
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

    const { name, supplier, quantity, unit_price, expected_delivery } = body;

    if (!name || quantity == null) {
      return NextResponse.json(
        { error: '缺少必填参数: name, quantity' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('procurement_items')
      .upsert({
        user_id: userId,
        name,
        supplier: supplier ?? null,
        quantity: Number(quantity),
        unit_price: unit_price != null ? Number(unit_price) : null,
        status: 'pending',
        order_date: new Date().toISOString(),
        expected_delivery: expected_delivery ?? null,
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
