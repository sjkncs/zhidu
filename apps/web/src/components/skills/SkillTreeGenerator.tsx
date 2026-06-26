'use client';

import React from 'react';
import {
  Code,
  BarChart3,
  Palette,
  Languages,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  Target,
  TreePine,
} from 'lucide-react';
import { skillTreeTemplates } from '@/data/skill-tree-templates';
import type { SkillTemplate, SkillTemplateNode } from '@/data/skill-tree-templates';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SkillTreeRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  aiGenerated: boolean;
  createdAt: string;
}

interface SkillTreeGeneratorProps {
  onTreeCreated?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  TECH: '技术',
  SOFT: '软技能',
  LANGUAGE: '语言',
  CERTIFICATE: '证书',
};

const CATEGORY_COLORS: Record<string, string> = {
  TECH: 'bg-blue/10 text-blue',
  SOFT: 'bg-purple-500/10 text-purple-600',
  LANGUAGE: 'bg-green-500/10 text-green-600',
  CERTIFICATE: 'bg-orange-500/10 text-orange-600',
};

const ICON_MAP: Record<string, React.ElementType> = {
  Code,
  BarChart3,
  Palette,
  Languages,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function countAllNodes(nodes: SkillTemplateNode[]): number {
  let count = nodes.length;
  for (const node of nodes) {
    count += countAllNodes(node.children);
  }
  return count;
}

function flattenNodes(
  nodes: SkillTemplateNode[],
  parentId: string | null = null,
  depth: number = 0,
): Array<{
  title: string;
  description: string;
  difficulty: number;
  estimatedHours: number;
  prerequisites: string[];
  resources: any[];
  parentNodeId: string | null;
  depth: number;
  sortOrder: number;
}> {
  const result: Array<{
    title: string;
    description: string;
    difficulty: number;
    estimatedHours: number;
    prerequisites: string[];
    resources: any[];
    parentNodeId: string | null;
    depth: number;
    sortOrder: number;
  }> = [];

  nodes.forEach((node, idx) => {
    result.push({
      title: node.title,
      description: node.description,
      difficulty: node.difficulty,
      estimatedHours: node.estimatedHours,
      prerequisites: node.prerequisites,
      resources: node.resources,
      parentNodeId: parentId,
      depth,
      sortOrder: idx,
    });
    result.push(...flattenNodes(node.children, null, depth + 1));
  });
  return result;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SkillTreeGenerator({ onTreeCreated }: SkillTreeGeneratorProps) {
  /* ---- AI generation state ---- */
  const [major, setMajor] = React.useState('');
  const [careerDirection, setCareerDirection] = React.useState('');
  const [showCareerDirection, setShowCareerDirection] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [aiResult, setAiResult] = React.useState<{
    name: string;
    nodeCount: number;
  } | null>(null);

  /* ---- Template state ---- */
  const [importingTemplateId, setImportingTemplateId] = React.useState<string | null>(null);
  const [importedTemplateId, setImportedTemplateId] = React.useState<string | null>(null);
  const [templateError, setTemplateError] = React.useState<string | null>(null);

  /* ---- History state ---- */
  const [historyTrees, setHistoryTrees] = React.useState<SkillTreeRow[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  /* ---- Fetch AI-generated history ---- */
  React.useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/skills/trees');
      if (!res.ok) throw new Error('获取历史记录失败');
      const json = await res.json();
      const all: SkillTreeRow[] = Array.isArray(json) ? json : json.data ?? [];
      setHistoryTrees(all.filter((t) => t.aiGenerated));
    } catch {
      // silently fail — history is supplementary
    } finally {
      setHistoryLoading(false);
    }
  }

  /* ---- AI generate ---- */
  async function handleAiGenerate() {
    if (!major.trim()) {
      setAiError('请输入你的专业方向');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const res = await fetch('/api/skills/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          major: major.trim(),
          careerDirection: careerDirection.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message ?? 'AI 生成失败，请稍后重试');
      }
      const data = await res.json();
      setAiResult({
        name: data.data?.name ?? data.name ?? 'AI 技能树',
        nodeCount: data.data?.nodeCount ?? data.nodeCount ?? 0,
      });
      fetchHistory();
      onTreeCreated?.();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 生成失败，请稍后重试');
    } finally {
      setAiLoading(false);
    }
  }

  /* ---- Import template ---- */
  async function handleImportTemplate(template: SkillTemplate) {
    setImportingTemplateId(template.id);
    setTemplateError(null);
    setImportedTemplateId(null);
    try {
      // Step 1: Create the skill tree
      const treeRes = await fetch('/api/skills/trees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          category: template.category,
        }),
      });
      if (!treeRes.ok) throw new Error('创建技能树失败');
      const treeData = await treeRes.json();
      const treeId: string = treeData.data?.id ?? treeData.id;

      // Step 2: Batch create nodes
      const flatNodes = flattenNodes(template.nodes);
      const batchNodes = flatNodes.map((n) => ({
        skillTreeId: treeId,
        title: n.title,
        description: n.description,
        difficulty: n.difficulty,
        estimatedHours: n.estimatedHours,
        prerequisites: n.prerequisites,
        resources: n.resources,
        parentNodeId: n.parentNodeId,
        depth: n.depth,
        sortOrder: n.sortOrder,
      }));

      const nodesRes = await fetch('/api/skills/nodes/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: batchNodes }),
      });
      if (!nodesRes.ok) throw new Error('导入节点失败');

      setImportedTemplateId(template.id);
      fetchHistory();
      onTreeCreated?.();
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : '导入模板失败，请重试');
    } finally {
      setImportingTemplateId(null);
    }
  }

  /* ================================================================== */
  /*  Render                                                             */
  /* ================================================================== */

  return (
    <div className="space-y-8">
      {/* ============================================================== */}
      {/*  SECTION 1: AI Generate                                         */}
      {/* ============================================================== */}
      <section className="rounded-xl border border-border bg-surface p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <Sparkles className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">AI 智能生成</h2>
            <p className="text-sm text-text-tertiary">
              输入你的专业方向，AI 将为你量身定制一棵完整的技能树
            </p>
          </div>
        </div>

        {/* Major input */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              专业方向 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="例如：计算机科学与技术、金融学、视觉传达设计..."
              className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue"
            />
          </div>

          {/* Optional career direction */}
          <div>
            <button
              type="button"
              onClick={() => setShowCareerDirection((prev) => !prev)}
              className="flex items-center gap-1 text-xs font-medium text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {showCareerDirection ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              添加职业方向（可选，使生成结果更精准）
            </button>

            {showCareerDirection && (
              <input
                type="text"
                value={careerDirection}
                onChange={(e) => setCareerDirection(e.target.value)}
                placeholder="例如：前端工程师、数据分析师、UI设计师..."
                className="mt-2 w-full rounded-xl border border-border bg-surface py-3 px-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue"
              />
            )}
          </div>
        </div>

        {/* Error */}
        {aiError && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
            {aiError}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setAiError(null)}
            >
              关闭
            </button>
          </div>
        )}

        {/* Generate button */}
        <button
          type="button"
          onClick={handleAiGenerate}
          disabled={aiLoading || !major.trim()}
          className="rounded-lg bg-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-dark disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
        >
          {aiLoading ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              AI 正在生成技能树...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              AI 生成技能树
            </>
          )}
        </button>

        {/* Loading skeleton */}
        {aiLoading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-2/3 rounded bg-border" />
            <div className="h-4 w-1/2 rounded bg-border" />
            <div className="h-4 w-3/4 rounded bg-border" />
            <div className="h-32 w-full rounded-xl bg-border" />
          </div>
        )}

        {/* Success result */}
        {aiResult && (
          <div className="rounded-xl border border-green-300 bg-green-50 px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span className="text-sm font-semibold text-green-700">
                技能树生成成功
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <span>名称：<strong className="text-text-primary">{aiResult.name}</strong></span>
              {aiResult.nodeCount > 0 && (
                <span>节点数：<strong className="text-text-primary">{aiResult.nodeCount}</strong></span>
              )}
            </div>
            <button
              type="button"
              onClick={onTreeCreated}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-elevated inline-flex items-center gap-1"
            >
              <TreePine className="h-3.5 w-3.5" />
              查看技能树
            </button>
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/*  SECTION 2: Template Gallery                                    */}
      {/* ============================================================== */}
      <section className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-text-primary">预设模板</h2>
          <p className="mt-1 text-sm text-text-tertiary">
            从精心设计的技能树模板中选择，快速创建你的学习路线
          </p>
        </div>

        {/* Template error */}
        {templateError && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
            {templateError}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setTemplateError(null)}
            >
              关闭
            </button>
          </div>
        )}

        {/* Template grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {skillTreeTemplates.map((template) => {
            const IconComponent = ICON_MAP[template.icon] ?? Target;
            const nodeCount = countAllNodes(template.nodes);
            const isImporting = importingTemplateId === template.id;
            const isImported = importedTemplateId === template.id;

            return (
              <div
                key={template.id}
                className="rounded-xl border border-border bg-surface hover:border-blue/20 transition-colors"
              >
                <div className="p-5 space-y-3">
                  {/* header row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
                        <IconComponent className="h-5 w-5 text-blue" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">
                          {template.name}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            CATEGORY_COLORS[template.category] ?? 'bg-gray-500/10 text-gray-500'
                          }`}
                        >
                          {CATEGORY_LABELS[template.category] ?? template.category}
                        </span>
                      </div>
                    </div>

                    {/* node count badge */}
                    <span className="inline-flex items-center rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-medium text-navy">
                      {nodeCount} 个节点
                    </span>
                  </div>

                  {/* description */}
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {template.description}
                  </p>

                  {/* root node preview */}
                  <div className="flex flex-wrap gap-1.5">
                    {template.nodes.map((node, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] text-text-tertiary"
                      >
                        {node.title}
                      </span>
                    ))}
                  </div>

                  {/* import button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleImportTemplate(template)}
                      disabled={isImporting || isImported}
                      className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-dark disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
                    >
                      {isImporting ? (
                        <>
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          导入中...
                        </>
                      ) : isImported ? (
                        <>
                          <Check className="h-4 w-4" />
                          已导入
                        </>
                      ) : (
                        '使用此模板'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================== */}
      {/*  SECTION 3: History                                             */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-text-primary">AI 生成记录</h2>

        {historyLoading ? (
          <div className="flex items-center justify-center py-10">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue border-t-transparent" />
            <span className="ml-2 text-sm text-text-tertiary">加载中...</span>
          </div>
        ) : historyTrees.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <Sparkles className="h-8 w-8 text-text-tertiary mx-auto mb-3" />
            <p className="text-sm text-text-secondary mb-1">暂无 AI 生成记录</p>
            <p className="text-xs text-text-tertiary">
              使用上方 AI 智能生成功能创建你的第一棵技能树
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {historyTrees.map((tree) => (
              <div
                key={tree.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-blue/20 transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue/10">
                  <Sparkles className="h-4 w-4 text-blue" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {tree.name}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        CATEGORY_COLORS[tree.category] ?? 'bg-gray-500/10 text-gray-500'
                      }`}
                    >
                      {CATEGORY_LABELS[tree.category] ?? tree.category}
                    </span>
                  </div>
                  {tree.description && (
                    <p className="text-xs text-text-tertiary mt-0.5 truncate">
                      {tree.description}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-text-tertiary shrink-0">
                  {new Date(tree.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
