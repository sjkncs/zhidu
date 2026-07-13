// @zhidu/ai — Agent 框架（P3: Planner/Executor 多步骤任务执行）
// 提供工具注册、任务规划、DAG 执行的完整 Agent 架构

/** RAG 检索结果（本地定义避免循环依赖） */
interface RetrievalResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

/** 工具定义（与 Function Calling 格式兼容） */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** 工具处理器 */
export type ToolHandler = (
  params: Record<string, unknown>,
  userId: string,
  db: any,
) => Promise<string>;

/** Agent 任务 */
export interface AgentTask {
  id: string;
  type: 'query' | 'create' | 'analyze';
  description: string;
  tool?: string;
  params: Record<string, unknown>;
  dependsOn?: string[];
}

/** Agent 步骤（执行中的任务状态） */
export interface AgentStep {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  durationMs?: number;
}

/** Agent 计划 */
export interface AgentPlan {
  goal: string;
  tasks: AgentTask[];
  steps: AgentStep[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具注册表
// ─────────────────────────────────────────────────────────────────────────────

/** 工具注册表 — 管理可用工具及其处理器 */
export class ToolRegistry {
  private tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>();

  /** 注册工具 */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  /** 获取工具定义列表 */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /** 执行工具 */
  async execute(
    toolName: string,
    params: Record<string, unknown>,
    userId: string,
    db: any,
  ): Promise<string> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return tool.handler(params, userId, db);
  }

  /** 检查工具是否存在 */
  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }
}

/** 创建默认工具注册表（含内置工具） */
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // 内置工具：knowledge_search
  registry.register(
    {
      name: 'knowledge_search',
      description: '搜索知识库中的参考资料',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词' },
          topK: { type: 'number', description: '返回结果数量' },
        },
        required: ['query'],
      },
    },
    async (params, userId, db) => {
      // 占位实现：返回提示文本
      return `[knowledge_search] 查询: ${params.query}（知识库检索占位实现）`;
    },
  );

  // 内置工具：university_query
  registry.register(
    {
      name: 'university_query',
      description: '查询院校信息',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '院校名称' },
        },
        required: ['name'],
      },
    },
    async (params, userId, db) => {
      try {
        const { data } = await db
          .from('universities')
          .select('name, province, tier, is_985, is_211, description')
          .ilike('name', `%${params.name}%`)
          .limit(1)
          .single();

        if (!data) return `[university_query] 未找到: ${params.name}`;

        const meta = [
          data.province,
          data.tier,
          data.is_985 && '985',
          data.is_211 && '211',
        ]
          .filter(Boolean)
          .join(' · ');

        return `[university_query] ${data.name}\n${meta}\n${data.description?.slice(0, 200) ?? ''}`;
      } catch {
        return `[university_query] 查询失败: ${params.name}`;
      }
    },
  );

  // 内置工具：todo_create
  registry.register(
    {
      name: 'todo_create',
      description: '创建待办事项',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '标题' },
          priority: { type: 'string', description: '优先级' },
          due_date: { type: 'string', description: '截止日期' },
        },
        required: ['title'],
      },
    },
    async (params, userId, db) => {
      try {
        await db.from('todos').insert({
          user_id: userId,
          title: params.title,
          priority: params.priority ?? 'medium',
          due_date: params.due_date,
          completed: false,
        });
        return `[todo_create] 已创建: ${params.title}`;
      } catch {
        return `[todo_create] 创建失败: ${params.title}`;
      }
    },
  );

  // 内置工具：memo_create
  registry.register(
    {
      name: 'memo_create',
      description: '创建备忘',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '标题' },
          content: { type: 'string', description: '内容' },
        },
        required: ['title', 'content'],
      },
    },
    async (params, userId, db) => {
      return `[memo_create] 已创建备忘: ${params.title}`;
    },
  );

  // 内置工具：schedule_create
  registry.register(
    {
      name: 'schedule_create',
      description: '创建日程',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '标题' },
          start_time: { type: 'string', description: '开始时间' },
          end_time: { type: 'string', description: '结束时间' },
        },
        required: ['title', 'start_time'],
      },
    },
    async (params, userId, db) => {
      return `[schedule_create] 已创建日程: ${params.title}`;
    },
  );

  // 内置工具：analysis_run
  registry.register(
    {
      name: 'analysis_run',
      description: '运行数据分析',
      parameters: {
        type: 'object',
        properties: {
          analysis: { type: 'string', description: '分析类型: gpa 或 finance' },
        },
        required: ['analysis'],
      },
    },
    async (params, userId, db) => {
      return `[analysis_run] 分析类型: ${params.analysis}（占位实现）`;
    },
  );

  return registry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Planner — 将用户请求分解为任务 DAG
// ─────────────────────────────────────────────────────────────────────────────

/** Planner — 任务规划器（当前为占位实现，后续可接入 LLM） */
export class Planner {
  constructor(private registry: ToolRegistry) {}

  /** 将目标分解为任务计划 */
  async plan(goal: string, userId: string): Promise<AgentPlan> {
    // 占位实现：创建单任务计划
    const task: AgentTask = {
      id: 't1',
      type: 'query',
      description: goal,
      tool: 'knowledge_search',
      params: { query: goal, topK: 5 },
    };

    return {
      goal,
      tasks: [task],
      steps: [{ taskId: task.id, status: 'pending' }],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Executor — 按 DAG 依赖顺序执行任务
// ─────────────────────────────────────────────────────────────────────────────

/** Executor — 任务执行器 */
export class Executor {
  constructor(private registry: ToolRegistry) {}

  /** 执行计划 */
  async execute(
    plan: AgentPlan,
    userId: string,
    db: any,
    onStepUpdate?: (step: AgentStep) => void,
  ): Promise<AgentPlan> {
    const completedSteps: AgentStep[] = [];
    const completedTaskIds = new Set<string>();

    // 按依赖关系排序（简单拓扑排序）
    const sortedTasks = this.topologicalSort(plan.tasks);

    for (const task of sortedTasks) {
      // 检查依赖是否完成
      const depsReady = (task.dependsOn ?? []).every((dep) => completedTaskIds.has(dep));
      if (!depsReady) {
        const failedStep: AgentStep = {
          taskId: task.id,
          status: 'failed',
          error: '依赖任务未完成',
        };
        completedSteps.push(failedStep);
        onStepUpdate?.(failedStep);
        continue;
      }

      // 标记为 running
      const runningStep: AgentStep = { taskId: task.id, status: 'running' };
      onStepUpdate?.(runningStep);

      const startTime = Date.now();

      try {
        // 执行工具
        let result = '';
        if (task.tool && this.registry.has(task.tool)) {
          result = await this.registry.execute(task.tool, task.params, userId, db);
        } else {
          result = `[${task.tool ?? 'unknown'}] 工具不可用`;
        }

        const completedStep: AgentStep = {
          taskId: task.id,
          status: 'completed',
          result,
          durationMs: Date.now() - startTime,
        };
        completedSteps.push(completedStep);
        completedTaskIds.add(task.id);
        onStepUpdate?.(completedStep);
      } catch (err) {
        const failedStep: AgentStep = {
          taskId: task.id,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startTime,
        };
        completedSteps.push(failedStep);
        onStepUpdate?.(failedStep);
      }
    }

    return {
      ...plan,
      steps: completedSteps,
    };
  }

  /** 简单拓扑排序 */
  private topologicalSort(tasks: AgentTask[]): AgentTask[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const visited = new Set<string>();
    const sorted: AgentTask[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const task = taskMap.get(id);
      if (!task) return;

      // 先访问依赖
      for (const dep of task.dependsOn ?? []) {
        visit(dep);
      }

      sorted.push(task);
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return sorted;
  }
}
