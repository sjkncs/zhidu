// API: 批量创建技能节点
// POST /api/skills/nodes/batch
// Body: { nodes: Array<{ skillTreeId, title, description?, parentNodeId?, difficulty?, prerequisites?, resources?, estimatedHours?, sortOrder? }> }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { batchCreateSkillNodes } from '@zhidu/db/repository';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodes } = body;

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        { error: '缺少必填参数: nodes (非空数组)' },
        { status: 400 },
      );
    }

    if (nodes.length > 100) {
      return NextResponse.json(
        { error: '单次最多创建 100 个节点' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const created = await batchCreateSkillNodes(nodes);

    return NextResponse.json({
      success: true,
      data: created,
      count: created.length,
    });
  } catch (err) {
    console.error('[skills/nodes/batch]', err);
    return NextResponse.json({ error: '批量创建失败' }, { status: 500 });
  }
}
