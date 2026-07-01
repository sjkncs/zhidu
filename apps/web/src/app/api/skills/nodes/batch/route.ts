// API: 批量创建技能节点（两趟插入，支持 parent-child 层级）
// POST /api/skills/nodes/batch
// Body: { nodes: Array<{ skillTreeId, title, description?, parentTitle?, difficulty?, prerequisites?, resources?, estimatedHours?, sortOrder? }> }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // 第一趟：批量插入所有节点（parent_node_id 全部为 null）
    // 剥离 parentTitle 字段（非 DB 列），保留用于第二趟映射
    const parentTitles = new Map<number, string | null>(); // index → parentTitle
    const insertPayload = nodes.map((n: any, idx: number) => {
      parentTitles.set(idx, n.parentTitle ?? null);
      return {
        skill_tree_id: n.skillTreeId,
        title: n.title,
        description: n.description ?? null,
        parent_node_id: n.parentNodeId ?? null, // 兼容直接传 parentNodeId 的场景
        difficulty: n.difficulty ?? 3,
        prerequisites: n.prerequisites ?? [],
        resources: n.resources ?? [],
        estimated_hours: n.estimatedHours ?? null,
        sort_order: n.sortOrder ?? 0,
      };
    });

    const { data: created, error: insertError } = await supabase
      .from('skill_nodes')
      .insert(insertPayload)
      .select('id, title');

    if (insertError || !created) {
      console.error('[skills/nodes/batch] insert error:', insertError?.message);
      return NextResponse.json({ error: '批量创建失败' }, { status: 500 });
    }

    // 第二趟：根据 parentTitle 映射补回 parent_node_id
    const titleToId = new Map<string, string>();
    for (const n of created) {
      titleToId.set(n.title, n.id);
    }

    // 按 parentTitle 分组，批量 UPDATE
    const groups = new Map<string, string[]>();
    nodes.forEach((n: any, idx: number) => {
      const pt = parentTitles.get(idx);
      if (pt) {
        const parentId = titleToId.get(pt);
        const nodeId = created[idx]?.id;
        if (parentId && nodeId) {
          const ids = groups.get(parentId) ?? [];
          ids.push(nodeId);
          groups.set(parentId, ids);
        }
      }
    });

    for (const [parentId, childIds] of groups) {
      if (childIds.length === 0) continue;
      const { error } = await supabase
        .from('skill_nodes')
        .update({ parent_node_id: parentId })
        .in('id', childIds);
      if (error) {
        console.error(`[skills/nodes/batch] link parent ${parentId} failed:`, error.message);
      }
    }

    // 返回含正确 parent_node_id 和 depth 的完整数据
    // 从第一个节点取 skillTreeId
    const treeId = nodes[0]?.skillTreeId;
    if (treeId) {
      const { data: fullNodes } = await supabase
        .from('skill_nodes')
        .select('*')
        .eq('skill_tree_id', treeId)
        .order('sort_order');
      return NextResponse.json({
        success: true,
        data: fullNodes ?? created,
        count: created.length,
      });
    }

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
