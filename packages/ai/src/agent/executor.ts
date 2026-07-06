// Agent 执行器 — DAG 调度执行 AgentPlan 中的任务

import type { AgentPlan, AgentStep } from './types';
import type { ToolRegistry } from './tool-registry';

export class Executor {
  constructor(private readonly registry: ToolRegistry) {}

  async execute(
    plan: AgentPlan,
    userId: string,
    db: any,
    onStepUpdate?: (step: AgentStep) => void,
  ): Promise<AgentPlan> {
    const completed = new Set<string>();
    const steps = [...plan.steps];

    while (completed.size < plan.tasks.length) {
      // 找出所有依赖已满足的任务
      const ready = plan.tasks.filter(t =>
        !completed.has(t.id) &&
        (!t.dependsOn || t.dependsOn.every(d => completed.has(d)))
      );

      if (ready.length === 0) break; // 无更多可执行任务

      // 并行执行就绪任务
      await Promise.all(ready.map(async (task) => {
        const step = steps.find(s => s.taskId === task.id)!;
        step.status = 'running';
        onStepUpdate?.({ ...step });

        const start = Date.now();
        try {
          const tool = this.registry.get(task.tool);
          if (!tool) throw new Error(`未知工具: ${task.tool}`);
          step.result = await tool.handler(task.params, userId, db);
          step.status = 'completed';
        } catch (err) {
          step.error = err instanceof Error ? err.message : '执行失败';
          step.status = 'failed';
        }
        step.durationMs = Date.now() - start;
        completed.add(task.id);
        onStepUpdate?.({ ...step });
      }));
    }

    return { ...plan, steps };
  }
}
