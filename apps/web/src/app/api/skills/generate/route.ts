// API: 技能树生成 — LLM 生成 + 存入数据库
// POST /api/skills/generate
// Body: { major: string, careerDirection?: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLLMService, buildSkillTreePrompt } from '@zhidu/ai/llm-service';
import type { SkillTreeAIResult, SkillTreeAINode } from '@zhidu/ai/llm-service';
import { createSkillTree, batchCreateSkillNodes } from '@zhidu/db/repository';

/**
 * 递归展平树形节点为平面数组，建立 parent 引用关系
 */
function flattenNodes(
  nodes: SkillTreeAINode[],
  skillTreeId: string,
  parentNodeId?: string,
  depth = 0,
): Array<{
  skillTreeId: string;
  title: string;
  description?: string;
  parentNodeId?: string;
  difficulty?: string;
  prerequisites?: string[];
  resources?: string[];
  estimatedHours?: number;
  sortOrder: number;
}> {
  const result: Array<{
    skillTreeId: string;
    title: string;
    description?: string;
    parentNodeId?: string;
    difficulty?: string;
    prerequisites?: string[];
    resources?: string[];
    estimatedHours?: number;
    sortOrder: number;
  }> = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const flatNode = {
      skillTreeId,
      title: node.title,
      description: node.description,
      parentNodeId,
      difficulty: node.difficulty,
      prerequisites: node.prerequisites,
      resources: node.resources,
      estimatedHours: node.estimatedHours,
      sortOrder: depth * 1000 + i,
    };
    result.push(flatNode);

    // 递归处理子节点（子节点引用当前节点作为 parent）
    // 注意：此处 parentNodeId 使用占位符索引，实际插入后需由 DB 层映射
    if (node.children && node.children.length > 0) {
      const childNodes = flattenNodes(node.children, skillTreeId, undefined, depth + 1);
      result.push(...childNodes);
    }
  }

  return result;
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

    if (!result?.tree || !result.tree.nodes || !Array.isArray(result.tree.nodes) || result.tree.nodes.length === 0) {
      return NextResponse.json(
        { error: 'LLM 返回数据格式异常' },
        { status: 502 },
      );
    }

    // 创建技能树
    const tree = await createSkillTree({
      userId: user.id,
      name: result.tree.name,
      description: result.tree.description,
      category: result.tree.category,
      sourceMajor: major,
      sourceCareer: careerDirection,
      aiGenerated: true,
    });

    if (!tree) {
      return NextResponse.json({ error: '创建技能树失败' }, { status: 500 });
    }

    // 递归展平节点并批量创建
    const flatNodes = flattenNodes(result.tree.nodes, tree.id);
    const createdNodes = flatNodes.length > 0
      ? await batchCreateSkillNodes(flatNodes)
      : [];

    return NextResponse.json({
      success: true,
      data: {
        tree,
        nodes: createdNodes,
      },
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
