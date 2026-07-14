// Agent 工具注册表 — 管理和调用各类工具

import type { ToolDefinition, ToolHandler } from './types';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  listDescriptions(): string {
    return this.list()
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');
  }
}

// 内置工具处理器

const knowledgeSearch: ToolHandler = async (params, userId, db) => {
  const query = params.query as string;
  const limit = (params.limit as number) || 5;
  const { data, error } = await db.rpc('search_knowledge', {
    query_text: query,
    collection_filter: null,
    match_limit: limit,
    similarity_threshold: 0.05,
  });
  if (error || !data?.length) return '未找到相关资料';
  return data.map((r: any) => `[${r.doc_title}] ${r.chunk_content.slice(0, 200)}`).join('\n\n');
};

const universityQuery: ToolHandler = async (params, userId, db) => {
  const name = params.name as string;
  if (!name) return '请提供大学名称';
  const { data, error } = await db
    .from('universities')
    .select('name, province, city, tier, school_type, description')
    .ilike('name', `%${name}%`)
    .limit(3);
  if (error || !data?.length) return `未找到 "${name}" 相关院校`;
  return data.map((u: any) => `${u.name} | ${u.province} ${u.city} | ${u.tier} | ${u.school_type}`).join('\n');
};

const todoCreate: ToolHandler = async (params, userId, db) => {
  const title = params.title as string;
  const priority = (params.priority as number) || 2;
  const dueDate = params.dueDate as string | undefined;
  const { data, error } = await db
    .from('todos')
    .insert({ user_id: userId, title, priority, due_date: dueDate, completed: false })
    .select('id, title')
    .single();
  if (error) return `创建待办失败: ${error.message}`;
  return `已创建待办: ${data.title}`;
};

const memoCreate: ToolHandler = async (params, userId, db) => {
  const title = params.title as string;
  const content = params.content as string;
  const { data, error } = await db
    .from('memos')
    .insert({ user_id: userId, title, content, is_pinned: false, is_archived: false })
    .select('id, title')
    .single();
  if (error) return `创建备忘失败: ${error.message}`;
  return `已创建备忘: ${data.title}`;
};

const scheduleCreate: ToolHandler = async (params, userId, db) => {
  const title = params.title as string;
  const startTime = params.startTime as string;
  const endTime = params.endTime as string;
  const { data, error } = await db
    .from('schedule_events')
    .insert({ user_id: userId, title, start_time: startTime, end_time: endTime, all_day: false, event_type: 'GENERAL' })
    .select('id, title')
    .single();
  if (error) return `创建日程失败: ${error.message}`;
  return `已创建日程: ${data.title}`;
};

const analysisRun: ToolHandler = async (params, userId, db) => {
  const type = params.analysis as string;
  switch (type) {
    case 'gpa': {
      const { data } = await db.from('courses').select('grade_point, credit').eq('user_id', userId);
      if (!data?.length) return '暂无课程数据';
      const totalCredits = data.reduce((s: number, c: any) => s + (c.credit || 0), 0);
      const weightedGpa = data.reduce((s: number, c: any) => s + (c.grade_point || 0) * (c.credit || 0), 0) / totalCredits;
      return `当前 GPA: ${weightedGpa.toFixed(2)}，总学分: ${totalCredits}`;
    }
    case 'finance': {
      const { data } = await db.from('transactions').select('amount, type').eq('user_id', userId);
      if (!data?.length) return '暂无财务数据';
      const income = data.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + t.amount, 0);
      const expense = data.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + t.amount, 0);
      return `总收入: ¥${income.toFixed(0)}，总支出: ¥${expense.toFixed(0)}，结余: ¥${(income - expense).toFixed(0)}`;
    }
    default:
      return `未知分析类型: ${type}`;
  }
};

const volunteerRecommend: ToolHandler = async (params, userId, db) => {
  const score = params.score as number;
  const province = params.province as string;
  if (!score || !province) return '志愿推荐需要分数和省份信息';
  try {
    const { executeVolunteerRecommend } = await import('../agent-tools');
    return await executeVolunteerRecommend(
      { score, province, subjectType: (params.subjectType as string) ?? '物理类' },
      userId,
      db,
    );
  } catch (e) {
    return `志愿推荐执行失败: ${e instanceof Error ? e.message : String(e)}`;
  }
};

const investmentAnalyze: ToolHandler = async (params, userId, db) => {
  const action = params.action as string;
  if (!action) return '请提供分析类型 (analyze_asset / analyze_portfolio / screen_stocks)';
  try {
    const { executeInvestmentAnalyze } = await import('../agent-tools');
    return await executeInvestmentAnalyze(
      { action, symbol: params.symbol as string, market: params.market as string },
      userId,
      db,
    );
  } catch (e) {
    return `投资分析执行失败: ${e instanceof Error ? e.message : String(e)}`;
  }
};

const webSearchTool: ToolHandler = async (params) => {
  const query = params.query as string;
  if (!query) return '请提供搜索关键词';
  try {
    const { searchWeb } = await import('../web-search');
    const results = await searchWeb({ query, maxResults: 5 });
    if (!results.length) return '未找到相关网页结果';
    return results.map((r, i) => `[${i + 1}] ${r.title}\n    ${r.snippet}\n    来源: ${r.url}`).join('\n\n');
  } catch (e) {
    return `网页搜索失败: ${e instanceof Error ? e.message : String(e)}`;
  }
};

const calculateTool: ToolHandler = async (params) => {
  try {
    const { executeCalculate } = await import('../agent-tools');
    return await executeCalculate(params);
  } catch (e) {
    return `计算执行失败: ${e instanceof Error ? e.message : String(e)}`;
  }
};

// 创建预注册工具注册表
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register({ name: 'knowledge_search', description: '搜索知识库中的参考资料', handler: knowledgeSearch });
  registry.register({ name: 'university_query', description: '查询院校信息（名称、省份、层次）', handler: universityQuery });
  registry.register({ name: 'todo_create', description: '为用户创建待办事项', handler: todoCreate });
  registry.register({ name: 'memo_create', description: '为用户创建备忘', handler: memoCreate });
  registry.register({ name: 'schedule_create', description: '为用户创建日程', handler: scheduleCreate });
  registry.register({ name: 'analysis_run', description: '运行数据分析（GPA/财务等）', handler: analysisRun });
  registry.register({ name: 'volunteer_recommend', description: '根据分数和省份生成冲稳保志愿方案', handler: volunteerRecommend });
  registry.register({ name: 'investment_analyze', description: 'AI投资分析（个股/组合/选股）', handler: investmentAnalyze });
  registry.register({ name: 'web_search', description: '搜索互联网获取最新信息', handler: webSearchTool });
  registry.register({ name: 'calculate', description: '执行数学计算（四则运算、复利、百分比等）', handler: calculateTool });
  return registry;
}
