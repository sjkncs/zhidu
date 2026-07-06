// Agent 核心类型定义

export interface AgentTask {
  id: string;
  type: 'query' | 'create' | 'update' | 'analyze' | 'plan';
  description: string;
  tool: string;
  params: Record<string, unknown>;
  dependsOn?: string[];
}

export interface AgentStep {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  durationMs?: number;
}

export interface AgentPlan {
  goal: string;
  tasks: AgentTask[];
  steps: AgentStep[];
}

export type ToolHandler = (params: Record<string, unknown>, userId: string, db: any) => Promise<string>;

export interface ToolDefinition {
  name: string;
  description: string;
  handler: ToolHandler;
}
