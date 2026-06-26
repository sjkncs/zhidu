'use client';

import React from 'react';
import {
  TreePine,
  Code,
  BarChart3,
  Palette,
  Languages,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  BookOpen,
  Target,
  Loader2,
  Sparkles,
} from 'lucide-react';
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

interface SkillNodeRow {
  id: string;
  skillTreeId: string;
  parentNodeId: string | null;
  title: string;
  description: string | null;
  difficulty: number;
  progress: number;
  prerequisites: string[];
  resources: any[];
  estimatedHours: number | null;
  completed: boolean;
  completedAt: string | null;
  depth: number;
  sortOrder: number;
}

interface SkillTreeExplorerProps {
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

const DIFFICULTY_DOT_COLORS: Record<number, string> = {
  1: 'bg-green-500',
  2: 'bg-blue',
  3: 'bg-yellow-500',
  4: 'bg-orange-500',
  5: 'bg-red-500',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildNodeTree(
  nodes: SkillNodeRow[],
  parentId: string | null = null,
): SkillNodeRow[] {
  return nodes
    .filter((n) => n.parentNodeId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((node) => node);
}

function countDescendants(nodes: SkillNodeRow[], nodeId: string): SkillNodeRow[] {
  const children = nodes.filter((n) => n.parentNodeId === nodeId);
  const all: SkillNodeRow[] = [...children];
  for (const child of children) {
    all.push(...countDescendants(nodes, child.id));
  }
  return all;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SkillTreeExplorer({ onTreeCreated }: SkillTreeExplorerProps) {
  /* ---- State ---- */
  const [trees, setTrees] = React.useState<SkillTreeRow[]>([]);
  const [treesLoading, setTreesLoading] = React.useState(true);
  const [treesError, setTreesError] = React.useState<string | null>(null);

  const [selectedTreeId, setSelectedTreeId] = React.useState<string | null>(null);
  const [nodes, setNodes] = React.useState<SkillNodeRow[]>([]);
  const [nodesLoading, setNodesLoading] = React.useState(false);
  const [nodesError, setNodesError] = React.useState<string | null>(null);

  const [expandedNodeIds, setExpandedNodeIds] = React.useState<Set<string>>(new Set());
  const [deletingTreeId, setDeletingTreeId] = React.useState<string | null>(null);
  const [deletingNodeId, setDeletingNodeId] = React.useState<string | null>(null);
  const [updatingProgressId, setUpdatingProgressId] = React.useState<string | null>(null);
  const [addingChildParentId, setAddingChildParentId] = React.useState<string | null>(null);

  /* ---- Fetch trees ---- */
  React.useEffect(() => {
    fetchTrees();
  }, []);

  async function fetchTrees() {
    setTreesLoading(true);
    setTreesError(null);
    try {
      const res = await fetch('/api/skills/trees');
      if (!res.ok) throw new Error('获取技能树列表失败');
      const json = await res.json();
      const list: SkillTreeRow[] = Array.isArray(json) ? json : json.data ?? [];
      setTrees(list);
    } catch (err) {
      setTreesError(err instanceof Error ? err.message : '获取技能树列表失败');
    } finally {
      setTreesLoading(false);
    }
  }

  /* ---- Fetch nodes for selected tree ---- */
  React.useEffect(() => {
    if (!selectedTreeId) return;
    fetchNodes(selectedTreeId);
  }, [selectedTreeId]);

  async function fetchNodes(treeId: string) {
    setNodesLoading(true);
    setNodesError(null);
    try {
      const res = await fetch(`/api/skills/trees/${treeId}`);
      if (!res.ok) throw new Error('获取节点数据失败');
      const json = await res.json();
      const nodeList: SkillNodeRow[] = Array.isArray(json.nodes) ? json.nodes : [];
      setNodes(nodeList);
    } catch (err) {
      setNodesError(err instanceof Error ? err.message : '获取节点数据失败');
    } finally {
      setNodesLoading(false);
    }
  }

  /* ---- Delete tree ---- */
  async function handleDeleteTree(treeId: string) {
    if (!confirm('确定要删除这棵技能树吗？所有节点和进度将被永久删除。')) return;
    setDeletingTreeId(treeId);
    try {
      const res = await fetch(`/api/skills/trees/${treeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      setTrees((prev) => prev.filter((t) => t.id !== treeId));
      if (selectedTreeId === treeId) {
        setSelectedTreeId(null);
        setNodes([]);
      }
    } catch {
      alert('删除技能树失败，请稍后重试');
    } finally {
      setDeletingTreeId(null);
    }
  }

  /* ---- Delete node ---- */
  async function handleDeleteNode(nodeId: string) {
    if (!confirm('确定要删除此节点吗？子节点也将被一同删除。')) return;
    setDeletingNodeId(nodeId);
    try {
      const res = await fetch(`/api/skills/nodes/${nodeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除节点失败');
      const descendants = countDescendants(nodes, nodeId);
      const removeIds = new Set([nodeId, ...descendants.map((d) => d.id)]);
      setNodes((prev) => prev.filter((n) => !removeIds.has(n.id)));
    } catch {
      alert('删除节点失败，请稍后重试');
    } finally {
      setDeletingNodeId(null);
    }
  }

  /* ---- Update progress ---- */
  async function handleProgressChange(nodeId: string, progress: number) {
    // Optimistic update
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, progress, completed: progress >= 100 } : n,
      ),
    );
    setUpdatingProgressId(nodeId);
    try {
      const res = await fetch(`/api/skills/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress }),
      });
      if (!res.ok) throw new Error('更新进度失败');
    } catch {
      // Revert on failure
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, progress: n.progress, completed: n.progress >= 100 } : n,
        ),
      );
    } finally {
      setUpdatingProgressId(null);
    }
  }

  /* ---- Add child node ---- */
  async function handleAddChild(parentId: string | null) {
    const title = prompt('请输入新节点名称：');
    if (!title?.trim()) return;
    setAddingChildParentId(parentId ?? '__root__');
    try {
      const res = await fetch('/api/skills/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillTreeId: selectedTreeId,
          title: title.trim(),
          parentNodeId: parentId,
        }),
      });
      if (!res.ok) throw new Error('添加节点失败');
      const newNode = await res.json();
      setNodes((prev) => [...prev, newNode.data ?? newNode]);
      if (parentId) {
        setExpandedNodeIds((prev) => new Set([...prev, parentId]));
      }
    } catch {
      alert('添加节点失败，请稍后重试');
    } finally {
      setAddingChildParentId(null);
    }
  }

  /* ---- Toggle node expand ---- */
  function toggleNode(nodeId: string) {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  /* ---- Stats ---- */
  const selectedTree = trees.find((t) => t.id === selectedTreeId) ?? null;
  const totalNodes = nodes.length;
  const completedNodes = nodes.filter((n) => n.completed).length;
  const totalHours = nodes.reduce((sum, n) => sum + (n.estimatedHours ?? 0), 0);
  const overallProgress = totalNodes > 0 ? Math.round(nodes.reduce((sum, n) => sum + n.progress, 0) / totalNodes) : 0;

  /* ---- Tree progress helpers ---- */
  function getTreeStats(treeId: string) {
    // We only have detailed nodes for the selected tree, so for other trees show basic info
    if (treeId === selectedTreeId) {
      const total = nodes.length;
      const avgProgress = total > 0 ? Math.round(nodes.reduce((s, n) => s + n.progress, 0) / total) : 0;
      return { total, avgProgress };
    }
    return { total: 0, avgProgress: 0 };
  }

  /* ================================================================== */
  /*  Render                                                             */
  /* ================================================================== */

  /* ---- Empty state ---- */
  if (!treesLoading && trees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue/10 mb-5">
          <TreePine className="h-8 w-8 text-blue" />
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-2">
          还没有技能树
        </h3>
        <p className="text-sm text-text-tertiary max-w-sm leading-relaxed">
          前往「AI 生成」标签页，通过 AI 智能生成或使用预设模板快速创建你的第一棵技能树
        </p>
      </div>
    );
  }

  /* ---- Root nodes for the selected tree ---- */
  const rootNodes = buildNodeTree(nodes, null);

  return (
    <div className="flex gap-5 h-full min-h-[500px]">
      {/* ============================================================ */}
      {/*  LEFT SIDEBAR: Tree List                                      */}
      {/* ============================================================ */}
      <div className="w-72 shrink-0 flex flex-col rounded-xl border border-border bg-surface overflow-hidden">
        {/* sidebar header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">我的技能树</h3>
          <button
            type="button"
            onClick={fetchTrees}
            disabled={treesLoading}
            className="rounded-lg border border-border px-2 py-1 text-xs text-text-tertiary hover:bg-surface-elevated transition-colors"
            title="刷新"
          >
            {treesLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              '刷新'
            )}
          </button>
        </div>

        {/* tree list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {treesError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {treesError}
            </div>
          )}

          {trees.map((tree) => {
            const isSelected = tree.id === selectedTreeId;
            const IconComp = ICON_MAP[tree.category] ?? Target;
            const stats = getTreeStats(tree.id);
            const isDeleting = deletingTreeId === tree.id;

            return (
              <div
                key={tree.id}
                className={`group relative rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-blue bg-blue/5'
                    : 'border-transparent hover:border-border hover:bg-surface-elevated'
                }`}
                onClick={() => setSelectedTreeId(tree.id)}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isSelected ? 'bg-blue/10' : 'bg-surface-elevated'
                    }`}
                  >
                    <IconComp className={`h-4 w-4 ${isSelected ? 'text-blue' : 'text-text-tertiary'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {tree.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          CATEGORY_COLORS[tree.category] ?? 'bg-gray-500/10 text-gray-500'
                        }`}
                      >
                        {CATEGORY_LABELS[tree.category] ?? tree.category}
                      </span>
                      {stats.total > 0 && (
                        <span className="text-[10px] text-text-tertiary">{stats.total} 个节点</span>
                      )}
                    </div>
                    {/* mini progress bar */}
                    {isSelected && stats.total > 0 && (
                      <div className="mt-1.5 h-1 w-full rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue transition-all duration-300"
                          style={{ width: `${stats.avgProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* delete button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTree(tree.id);
                  }}
                  disabled={isDeleting}
                  className="absolute top-2 right-2 rounded p-1 text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="删除技能树"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  RIGHT PANEL: Node Tree                                       */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedTree ? (
          /* placeholder */
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Target className="h-12 w-12 text-text-tertiary mb-4" />
            <p className="text-sm font-medium text-text-secondary mb-1">
              选择一棵技能树
            </p>
            <p className="text-xs text-text-tertiary">
              从左侧列表中选择要查看的技能树
            </p>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="rounded-xl border border-border bg-surface p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-text-primary">
                    {selectedTree.name}
                  </h2>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      CATEGORY_COLORS[selectedTree.category] ?? 'bg-gray-500/10 text-gray-500'
                    }`}
                  >
                    {CATEGORY_LABELS[selectedTree.category] ?? selectedTree.category}
                  </span>
                  {selectedTree.aiGenerated && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue/10 px-2 py-0.5 text-xs font-medium text-blue">
                      <Sparkles className="h-3 w-3" />
                      AI 生成
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleAddChild(null)}
                  disabled={addingChildParentId === '__root__'}
                  className="rounded-lg bg-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-dark disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {addingChildParentId === '__root__' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  添加根节点
                </button>
              </div>

              {/* stats row */}
              <div className="flex items-center gap-6 text-xs text-text-secondary">
                <span>
                  总节点 <strong className="text-text-primary">{totalNodes}</strong>
                </span>
                <span>
                  已完成 <strong className="text-text-primary">{completedNodes}</strong>
                </span>
                <span>
                  总学时 <strong className="text-text-primary">{totalHours}h</strong>
                </span>
                <span>
                  总进度 <strong className="text-text-primary">{overallProgress}%</strong>
                </span>
              </div>

              {/* overall progress bar */}
              <div className="mt-2.5 h-2 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            {/* Nodes loading / error */}
            {nodesLoading && (
              <div className="flex items-center justify-center py-16">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue border-t-transparent" />
                <span className="ml-2 text-sm text-text-tertiary">加载节点中...</span>
              </div>
            )}

            {nodesError && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
                {nodesError}
              </div>
            )}

            {/* Node tree */}
            {!nodesLoading && !nodesError && (
              <div className="flex-1 overflow-y-auto space-y-2">
                {rootNodes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <BookOpen className="h-10 w-10 text-text-tertiary mb-3" />
                    <p className="text-sm text-text-secondary mb-1">暂无节点</p>
                    <p className="text-xs text-text-tertiary">点击上方「添加根节点」开始构建技能树</p>
                  </div>
                ) : (
                  rootNodes.map((node) => (
                    <NodeItem
                      key={node.id}
                      node={node}
                      allNodes={nodes}
                      expandedNodeIds={expandedNodeIds}
                      deletingNodeId={deletingNodeId}
                      updatingProgressId={updatingProgressId}
                      addingChildParentId={addingChildParentId}
                      depth={0}
                      onToggle={toggleNode}
                      onDelete={handleDeleteNode}
                      onProgressChange={handleProgressChange}
                      onAddChild={handleAddChild}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NodeItem sub-component                                             */
/* ------------------------------------------------------------------ */

interface NodeItemProps {
  node: SkillNodeRow;
  allNodes: SkillNodeRow[];
  expandedNodeIds: Set<string>;
  deletingNodeId: string | null;
  updatingProgressId: string | null;
  addingChildParentId: string | null;
  depth: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onProgressChange: (id: string, progress: number) => void;
  onAddChild: (parentId: string | null) => void;
}

function NodeItem({
  node,
  allNodes,
  expandedNodeIds,
  deletingNodeId,
  updatingProgressId,
  addingChildParentId,
  depth,
  onToggle,
  onDelete,
  onProgressChange,
  onAddChild,
}: NodeItemProps) {
  const isExpanded = expandedNodeIds.has(node.id);
  const isDeleting = deletingNodeId === node.id;
  const isUpdating = updatingProgressId === node.id;
  const isAddingChild = addingChildParentId === node.id;
  const children = buildNodeTree(allNodes, node.id);
  const canAddChild = depth < 2; // depth 0, 1, 2 → max 3 levels

  const paddingLeft = depth * 20;

  return (
    <div style={{ paddingLeft }}>
      <div
        className={`rounded-xl border bg-surface transition-colors ${
          node.completed ? 'border-green-300 bg-green-50/50' : 'border-border hover:border-blue/20'
        }`}
      >
        {/* Node header */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
          onClick={() => onToggle(node.id)}
        >
          {/* expand/collapse icon */}
          {children.length > 0 ? (
            isExpanded ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-text-tertiary" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />
            )
          ) : (
            <span className="w-4" />
          )}

          {/* completed checkmark */}
          {node.completed ? (
            <Check className="h-4 w-4 shrink-0 text-green-500" />
          ) : (
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-border" />
          )}

          {/* title + meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-medium ${
                  node.completed ? 'text-text-tertiary line-through' : 'text-text-primary'
                }`}
              >
                {node.title}
              </span>
              {/* difficulty dots */}
              <span className="flex items-center gap-0.5" title={`难度 ${node.difficulty}/5`}>
                {[1, 2, 3, 4, 5].map((d) => (
                  <span
                    key={d}
                    className={`h-1.5 w-1.5 rounded-full ${
                      d <= node.difficulty
                        ? DIFFICULTY_DOT_COLORS[d] ?? 'bg-gray-400'
                        : 'bg-border'
                    }`}
                  />
                ))}
              </span>
            </div>

            {/* progress bar */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    node.completed ? 'bg-green-500' : 'bg-blue'
                  }`}
                  style={{ width: `${node.progress}%` }}
                />
              </div>
              <span className="text-[10px] text-text-tertiary shrink-0 tabular-nums">
                {node.progress}%
              </span>
            </div>
          </div>

          {/* hours badge */}
          {node.estimatedHours != null && node.estimatedHours > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-medium text-navy shrink-0">
              <Clock className="h-3 w-3" />
              {node.estimatedHours}h
            </span>
          )}
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="border-t border-border px-4 py-3 space-y-3">
            {/* description */}
            {node.description && (
              <p className="text-sm text-text-secondary leading-relaxed">
                {node.description}
              </p>
            )}

            {/* prerequisites */}
            {node.prerequisites.length > 0 && (
              <div>
                <p className="text-xs font-medium text-text-tertiary mb-1.5">前置要求</p>
                <div className="flex flex-wrap gap-1.5">
                  {node.prerequisites.map((pre, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-600"
                    >
                      {pre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* resources */}
            {node.resources.length > 0 && (
              <div>
                <p className="text-xs font-medium text-text-tertiary mb-1.5">学习资源</p>
                <ul className="space-y-1">
                  {node.resources.map((res: any, idx: number) => (
                    <li key={idx} className="flex items-center gap-2 text-xs">
                      <BookOpen className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                      {res.url ? (
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {res.title}
                        </a>
                      ) : (
                        <span className="text-text-secondary">{res.title}</span>
                      )}
                      {res.type && (
                        <span className="rounded bg-surface-elevated px-1 py-0.5 text-[10px] text-text-tertiary">
                          {res.type}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* progress slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-text-tertiary">更新进度</p>
                <span className="text-xs text-text-secondary tabular-nums">{node.progress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={node.progress}
                onChange={(e) => onProgressChange(node.id, Number(e.target.value))}
                disabled={isUpdating}
                className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-blue disabled:opacity-50"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* action buttons */}
            <div className="flex items-center gap-2 pt-1">
              {canAddChild && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChild(node.id);
                  }}
                  disabled={isAddingChild}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-elevated inline-flex items-center gap-1"
                >
                  {isAddingChild ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  添加子节点
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node.id);
                }}
                disabled={isDeleting}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-red-500 hover:border-red-300 hover:bg-red-50 inline-flex items-center gap-1"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                删除
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Children with left border line */}
      {isExpanded && children.length > 0 && (
        <div className="mt-1.5 ml-2.5 pl-3 border-l-2 border-border/60 space-y-1.5">
          {children.map((child) => (
            <NodeItem
              key={child.id}
              node={child}
              allNodes={allNodes}
              expandedNodeIds={expandedNodeIds}
              deletingNodeId={deletingNodeId}
              updatingProgressId={updatingProgressId}
              addingChildParentId={addingChildParentId}
              depth={depth + 1}
              onToggle={onToggle}
              onDelete={onDelete}
              onProgressChange={onProgressChange}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}
