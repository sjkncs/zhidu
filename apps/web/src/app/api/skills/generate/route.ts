// API: 技能树生成 — LLM 生成 + 存入数据库
// POST /api/skills/generate
// Body: { major: string, careerDirection?: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLLMService, buildSkillTreePrompt } from '@zhidu/ai/llm-service';
import type { SkillTreeAIResult, SkillTreeAINode } from '@zhidu/ai/llm-service';

/** 展平后的节点（含 parentTitle 占位，用于两趟插入） */
interface FlatNode {
  skill_tree_id: string;
  title: string;
  description: string | null;
  parent_node_id: null; // 初始插入时全部为 null，两趟插入后由 linkParentNodes 补回
  parentTitle: string | null; // 父节点标题，用于第二趟 title→id 映射
  difficulty: number;
  prerequisites: string[];
  resources: unknown[];
  estimated_hours: number | null;
  sort_order: number;
  depth: number;
}

/**
 * 递归展平树形节点为平面数组
 * 保留 parentTitle 占位字段，后续由 linkParentNodes() 建立真实 FK 引用
 */
function flattenNodes(
  nodes: SkillTreeAINode[],
  skillTreeId: string,
  parentTitle: string | null = null,
  depth = 0,
): FlatNode[] {
  const result: FlatNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    result.push({
      skill_tree_id: skillTreeId,
      title: node.title,
      description: node.description ?? null,
      parent_node_id: null,
      parentTitle,
      difficulty: typeof node.difficulty === 'number' ? node.difficulty : 3,
      prerequisites: node.prerequisites ?? [],
      resources: (node.resources ?? []) as unknown[],
      estimated_hours: node.estimatedHours ?? null,
      sort_order: depth * 1000 + i,
      depth,
    });

    if (node.children && node.children.length > 0) {
      const childNodes = flattenNodes(node.children, skillTreeId, node.title, depth + 1);
      result.push(...childNodes);
    }
  }

  return result;
}

/**
 * 第二趟：根据 parentTitle 映射补回 parent_node_id
 * 触发器 trg_skill_node_depth 会在 UPDATE parent_node_id 时自动重算 depth
 */
async function linkParentNodes(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  createdNodes: Array<{ id: string; title: string }>,
  flatNodes: FlatNode[],
) {
  // title → id 映射（同一棵技能树内 title 唯一）
  const titleToId = new Map<string, string>();
  for (const n of createdNodes) {
    titleToId.set(n.title, n.id);
  }

  // 按 parentTitle 分组，减少 DB 调用
  const groups = new Map<string, string[]>();
  for (const flat of flatNodes) {
    if (flat.parentTitle) {
      const parentId = titleToId.get(flat.parentTitle);
      if (parentId) {
        const ids = groups.get(parentId) ?? [];
        const nodeId = titleToId.get(flat.title);
        if (nodeId) ids.push(nodeId);
        groups.set(parentId, ids);
      }
    }
  }

  // 批量 UPDATE ... WHERE id IN (...)
  for (const [parentId, childIds] of groups) {
    if (childIds.length === 0) continue;
    const { error } = await supabase
      .from('skill_nodes')
      .update({ parent_node_id: parentId })
      .in('id', childIds);
    if (error) {
      console.error(`[linkParentNodes] failed for parent ${parentId}:`, error.message);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { major, careerDirection } = body;

    if (!major || typeof major !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: major' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 调用 LLM 生成结构化技能树
    const llm = createLLMService();
    const messages = buildSkillTreePrompt({ major, careerDirection });

    const result = await llm.chatJSON<SkillTreeAIResult>({
      messages,
      options: { temperature: 0.7, maxTokens: 4096 },
    });

    // SkillTreeAIResult 是扁平结构: { treeName, treeDescription, category, nodes }
    if (!result?.nodes || !Array.isArray(result.nodes) || result.nodes.length === 0) {
      return NextResponse.json(
        { error: 'LLM 返回数据格式异常' },
        { status: 502 },
      );
    }

    // 使用认证客户端直接写入（repository 层使用 anon client，会被 RLS 拦截）
    const { data: tree, error: treeError } = await supabase
      .from('skill_trees')
      .insert({
        user_id: user.id,
        name: result.treeName,
        description: result.treeDescription ?? null,
        category: result.category ?? 'CUSTOM',
        source_major: major,
        source_career: careerDirection ?? null,
        ai_generated: true,
      })
      .select()
      .single();

    if (treeError || !tree) {
      console.error('[skills/generate] createSkillTree error:', treeError?.message);
      return NextResponse.json({ error: '创建技能树失败' }, { status: 500 });
    }

    // 递归展平节点并批量创建
    const flatNodes = flattenNodes(result.nodes, tree.id);
    let createdNodes: any[] = [];

    if (flatNodes.length > 0) {
      // 第一趟：批量插入所有节点（parent_node_id 全部为 null）
      // 注意：剥离 parentTitle 字段，它不是 DB 列
      const insertPayload = flatNodes.map(({ parentTitle: _pt, ...dbRow }) => dbRow);

      const { data: nodes, error: nodesError } = await supabase
        .from('skill_nodes')
        .insert(insertPayload)
        .select('id, title');

      if (nodesError) {
        console.error('[skills/generate] batchCreateNodes error:', nodesError.message);
        return NextResponse.json(
          { error: '创建技能节点失败' },
          { status: 500 },
        );
      }

      // 第二趟：根据 parentTitle → id 映射，批量 UPDATE parent_node_id
      // 触发器 trg_skill_node_depth 会自动重算 depth
      if (nodes && nodes.length > 0) {
        await linkParentNodes(supabase, nodes, flatNodes);

        // 重新获取完整节点数据（含正确的 parent_node_id 和 depth）
        const { data: fullNodes } = await supabase
          .from('skill_nodes')
          .select('*')
          .eq('skill_tree_id', tree.id)
          .order('sort_order');
        createdNodes = fullNodes ?? [];
      }
    }

    return NextResponse.json({
      success: true,
      data: { tree, nodes: createdNodes },
      count: createdNodes.length,
    });
  } catch (err) {
    console.error('[skills/generate]', err);
    return NextResponse.json(
      { error: '生成失败，请稍后重试' },
      { status: 500 },
    );
  }
}
