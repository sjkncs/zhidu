// Agent 规划器 — 用 LLM 将用户指令分解为可执行的任务序列

import type { LLMService } from '../index';
import type { AgentPlan, AgentTask } from './types';
import type { ToolRegistry } from './tool-registry';

const PLANNER_SYSTEM_PROMPT = `你是一个任务规划代理。将用户的自然语言指令分解为可执行的步骤序列。

输出格式（JSON）：
{
  "goal": "目标描述",
  "tasks": [
    { "id": "t1", "type": "query", "description": "描述", "tool": "工具名", "params": {...} },
    { "id": "t2", "type": "create", "description": "描述", "tool": "工具名", "params": {...}, "dependsOn": ["t1"] }
  ]
}

规则：
1. 每个任务只使用一个工具
2. 用 dependsOn 表示依赖关系
3. 尽量让独立任务并行执行
4. 如果只需要简单回答，创建一个 knowledge_search 任务即可`;

export class Planner {
  constructor(
    private readonly llm: LLMService,
    private readonly registry: ToolRegistry,
  ) {}

  async plan(userId: string, query: string): Promise<AgentPlan> {
    const toolsDesc = this.registry.listDescriptions();
    const systemPrompt = `${PLANNER_SYSTEM_PROMPT}\n\n可用工具：\n${toolsDesc}`;

    try {
      const result = await this.llm.chatJSON<{ goal: string; tasks: AgentTask[] }>({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        options: { temperature: 0.3, maxTokens: 1024 },
      });

      const tasks = result.tasks || [];
      const steps = tasks.map(t => ({
        taskId: t.id,
        status: 'pending' as const,
      }));

      return { goal: result.goal || query, tasks, steps };
    } catch {
      // 规划失败时回退到单任务
      return {
        goal: query,
        tasks: [{
          id: 't1',
          type: 'query',
          description: '搜索知识库',
          tool: 'knowledge_search',
          params: { query },
        }],
        steps: [{ taskId: 't1', status: 'pending' }],
      };
    }
  }
}
