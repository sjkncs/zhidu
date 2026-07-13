// @zhidu/ai — Agent 工具注册（P3: run_tasks Function Calling 工具）
// 让 LLM 通过 Function Calling 调用 Planner/Executor 执行多步骤任务
// LLM 自主决定何时需要任务分解，Executor 通过回调推送进度

import type { ToolDefinition as FCToolDefinition } from './index';
import type { AgentTask, AgentStep, AgentPlan } from './agent';
import { ToolRegistry, createDefaultRegistry, Executor } from './agent';

// ─────────────────────────────────────────────────────────────────────────────
// Function Calling 工具定义
// ─────────────────────────────────────────────────────────────────────────────

export const VOLUNTEER_RECOMMEND_TOOL: FCToolDefinition = {
  type: 'function',
  function: {
    name: 'volunteer_recommend',
    description: '根据考生分数、省份、科类生成冲稳保志愿推荐方案。当用户询问志愿推荐、选校建议、录取概率时调用此工具。需要用户提供分数和省份信息。',
    parameters: {
      type: 'object',
      properties: {
        score: { type: 'number', description: '考生高考分数' },
        province: { type: 'string', description: '考生省份（如"广东"）' },
        subjectType: { type: 'string', description: '科类：物理类/历史类/理科/文科', default: '物理类' },
        preferredCities: { type: 'array', items: { type: 'string' }, description: '偏好城市列表' },
        tierFilter: { type: 'array', items: { type: 'string', enum: ['985', '211', '双一流'] }, description: '院校层级筛选' },
      },
      required: ['score', 'province'],
    },
  },
};

export const INVESTMENT_ANALYZE_TOOL: FCToolDefinition = {
  type: 'function',
  function: {
    name: 'investment_analyze',
    description: 'AI驱动的投资分析工具。支持个股/币种分析、组合诊断、选股筛选、DeFi收益评估。当用户询问投资建议、持仓分析、市场判断时调用。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['analyze_asset', 'analyze_portfolio', 'screen_stocks', 'defi_yield'],
          description: '分析类型：analyze_asset=个股/币种分析, analyze_portfolio=组合诊断, screen_stocks=选股筛选, defi_yield=DeFi收益',
        },
        symbol: { type: 'string', description: '资产代码（如 600519, AAPL, BTC）' },
        market: { type: 'string', enum: ['A股', '港股', '美股', 'BTC', 'ETH', 'SOL', 'DeFi', 'other'], description: '市场类型' },
        portfolioId: { type: 'string', description: '投资组合ID（用于 analyze_portfolio）' },
        criteria: { type: 'string', description: '选股条件描述（用于 screen_stocks）' },
      },
      required: ['action'],
    },
  },
};

export const RUN_TASKS_TOOL: FCToolDefinition = {
  type: 'function',
  function: {
    name: 'run_tasks',
    description: '将复杂请求分解为多个子任务并行或顺序执行。适用于需要同时查询多个数据源、创建多条记录、或执行多步分析的场景。简单问题（单一查询/闲聊）不需要使用此工具。',
    parameters: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: '任务总目标描述',
        },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: '任务唯一标识（如 t1, t2, t3）' },
              tool: {
                type: 'string',
                enum: [
                  'knowledge_search',
                  'university_query',
                  'todo_create',
                  'memo_create',
                  'schedule_create',
                  'analysis_run',
                  'volunteer_recommend',
                ],
                description: '要调用的工具名称',
              },
              description: { type: 'string', description: '任务描述' },
              params: {
                type: 'object',
                description: '工具参数',
              },
              dependsOn: {
                type: 'array',
                items: { type: 'string' },
                description: '依赖的任务ID列表（这些任务完成后才执行本任务）',
              },
            },
            required: ['id', 'tool', 'description', 'params'],
          },
          description: '2-6个子任务列表',
        },
      },
      required: ['goal', 'tasks'],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 工具描述（用于 LLM 理解可用工具）
// ─────────────────────────────────────────────────────────────────────────────

export const AVAILABLE_AGENT_TOOLS = `可用工具列表：
- knowledge_search: 搜索知识库中的参考资料（参数: query 搜索关键词, topK 返回数量）
- university_query: 查询院校信息（参数: name 院校名称）
- todo_create: 创建待办事项（参数: title 标题, priority 优先级, due_date 截止日期）
- memo_create: 创建备忘（参数: title 标题, content 内容）
- schedule_create: 创建日程（参数: title 标题, start_time 开始时间, end_time 结束时间）
- analysis_run: 运行数据分析（参数: analysis 类型"gpa"或"finance"）`;

// ─────────────────────────────────────────────────────────────────────────────
// 执行引擎
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskUpdateEvent {
  taskId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  error?: string;
  durationMs?: number;
}

/**
 * 执行 run_tasks 工具调用
 *
 * @param args - LLM 传入的 { goal, tasks } 参数
 * @param userId - 用户ID
 * @param db - Supabase 客户端
 * @param onTaskUpdate - 任务状态变更回调（用于 SSE 推送）
 * @returns 格式化的任务执行结果文本
 */
export async function executeRunTasks(
  args: { goal: string; tasks: Array<Record<string, unknown>> },
  userId: string,
  db: any,
  onTaskUpdate?: (event: TaskUpdateEvent) => void,
): Promise<string> {
  const registry = createDefaultRegistry();

  // 将 LLM 输出的任务转为 AgentTask 格式
  const agentTasks: AgentTask[] = args.tasks.map((t: any) => ({
    id: t.id,
    type: inferTaskType(t.tool),
    description: t.description,
    tool: t.tool,
    params: t.params ?? {},
    dependsOn: t.dependsOn,
  }));

  // 构建 AgentPlan
  const plan: AgentPlan = {
    goal: args.goal,
    tasks: agentTasks,
    steps: agentTasks.map((t) => ({
      taskId: t.id,
      status: 'pending' as const,
    })),
  };

  // 发送初始 pending 事件
  for (const task of agentTasks) {
    onTaskUpdate?.({
      taskId: task.id,
      description: task.description,
      status: 'pending',
    });
  }

  // 执行
  const executor = new Executor(registry);
  const completedPlan = await executor.execute(
    plan,
    userId,
    db,
    (step: AgentStep) => {
      const task = agentTasks.find((t) => t.id === step.taskId);
      const statusMap: Record<string, TaskUpdateEvent['status']> = {
        pending: 'pending',
        running: 'in_progress',
        completed: 'completed',
        failed: 'failed',
      };
      onTaskUpdate?.({
        taskId: step.taskId,
        description: task?.description ?? step.taskId,
        status: statusMap[step.status] ?? 'pending',
        result: step.result,
        error: step.error,
        durationMs: step.durationMs,
      });
    },
  );

  // 格式化结果
  const results = completedPlan.steps
    .map((step) => {
      const task = agentTasks.find((t) => t.id === step.taskId);
      const status = step.status === 'completed' ? 'OK' : 'FAIL';
      const time = step.durationMs ? ` (${step.durationMs}ms)` : '';
      const detail = step.result
        ? `\n    ${step.result.slice(0, 500)}`
        : step.error
          ? `\n    错误: ${step.error}`
          : '';
      return `[${status}] ${task?.description ?? step.taskId}${time}${detail}`;
    })
    .join('\n\n');

  return `## 任务执行结果（"${args.goal}"）\n\n${results}`;
}

export async function executeVolunteerRecommend(
  args: {
    score: number;
    province: string;
    subjectType?: string;
    preferredCities?: string[];
    tierFilter?: Array<'985' | '211' | '双一流'>;
  },
  userId: string,
  db: any,
): Promise<string> {
  const {
    VolunteerMatchingEngine,
    DecisionNodeEngine,
    ContinuityGuard,
    RecommendationValidator,
    buildDecisionTreeSystemPrompt,
    buildVolunteerUserPrompt,
    buildNoRecommendationResponse,
  } = await import('./index');

  // 1. 确定性引擎：计算冲稳保
  const engine = new VolunteerMatchingEngine();
  const recommendation = await engine.recommend({
    score: args.score,
    province: args.province,
    subjectType: args.subjectType ?? '物理类',
    year: 2025,
    preferredCities: args.preferredCities,
    tierFilter: args.tierFilter,
  });

  // 2. 决策节点引擎：门禁检查 + 决策追踪
  const decisionEngine = new DecisionNodeEngine();
  const gateCheck = decisionEngine.runGateCheck(recommendation);

  // 门禁不通过：返回合成响应
  if (gateCheck.result !== 'proceed') {
    return buildNoRecommendationResponse(gateCheck, {
      score: args.score,
      province: args.province,
      subjectType: args.subjectType ?? '物理类',
    });
  }

  const trace = decisionEngine.buildDecisionTrace(recommendation, gateCheck);

  // 3. 一致性验证
  const consistency = decisionEngine.validateConsistency(recommendation);
  if (!consistency.valid) {
    console.warn('[Volunteer] Consistency issues:', consistency.issues.slice(0, 3));
  }

  // 4. 验证器
  const validator = new RecommendationValidator();
  const validation = validator.validate(recommendation, trace);
  if (!validation.valid) {
    console.warn('[Volunteer] Validation errors:', validation.errors.slice(0, 3));
  }

  // 5. 连续性守卫（查询用户上次推荐）
  const guard = new ContinuityGuard();
  let continuityHint: string | undefined;

  try {
    const { data: lastPlan } = await db
      .from('application_plans')
      .select('id, created_at, items')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPlan) {
      const previousPlan = {
        id: lastPlan.id,
        userId,
        timestamp: lastPlan.created_at,
        query: { score: args.score, province: args.province, subjectType: args.subjectType ?? '物理类', year: 2025 },
        rush: [],
        stable: [],
        safe: [],
      };
      const continuityResult = guard.check(recommendation, previousPlan as any);
      continuityHint = continuityResult.hintForLLM;
    }
  } catch {
    // 无历史记录，正常继续
  }

  // 6. 构建结构化 prompt（供 LLM 使用）
  const userPrompt = buildVolunteerUserPrompt(recommendation, trace, gateCheck, continuityHint);
  const systemPrompt = buildDecisionTreeSystemPrompt();

  // 7. 返回结构化数据 + prompt（chat route 会将其注入下一轮 LLM 调用）
  const summary = {
    rushCount: recommendation.rush.length,
    stableCount: recommendation.stable.length,
    safeCount: recommendation.safe.length,
    totalMatched: recommendation.summary.totalMatched,
    confidence: recommendation.summary.confidence,
    overallConfidence: trace.overallConfidence,
    dataYears: recommendation.summary.dataYears,
    gateResult: gateCheck.result,
  };

  // 构建简洁的用户可见结果
  const topRush = recommendation.rush.slice(0, 3).map((r: any) => `${r.universityName}(${r.probability}%)`).join('、');
  const topStable = recommendation.stable.slice(0, 3).map((r: any) => `${r.universityName}(${r.probability}%)`).join('、');
  const topSafe = recommendation.safe.slice(0, 3).map((r: any) => `${r.universityName}(${r.probability}%)`).join('、');

  return [
    `## 志愿推荐方案（${args.score}分 / ${args.province} / ${args.subjectType ?? '物理类'}）`,
    '',
    `数据覆盖 ${summary.dataYears.join('、')} 年，共匹配 ${summary.totalMatched} 个院校专业组合`,
    `整体置信度: ${(summary.overallConfidence * 100).toFixed(0)}%`,
    '',
    `### 冲（${summary.rushCount} 所）`,
    topRush || '_无匹配_',
    '',
    `### 稳（${summary.stableCount} 所）`,
    topStable || '_无匹配_',
    '',
    `### 保（${summary.safeCount} 所）`,
    topSafe || '_无匹配_',
    '',
    '请基于以上数据为用户提供详细分析和个性化建议。',
  ].join('\n');
}

/** 根据工具名推断任务类型 */
function inferTaskType(tool: string): AgentTask['type'] {
  switch (tool) {
    case 'knowledge_search':
    case 'university_query':
    case 'analysis_run':
    case 'investment_analyze':
      return 'query';
    case 'todo_create':
    case 'memo_create':
    case 'schedule_create':
      return 'create';
    default:
      return 'query';
  }
}

/**
 * 执行 investment_analyze 工具调用
 * PA_Agent 模式：确定性引擎 + LLM 分析层
 */
export async function executeInvestmentAnalyze(
  args: {
    action: string;
    symbol?: string;
    market?: string;
    portfolioId?: string;
    criteria?: string;
  },
  userId: string,
  db: any,
): Promise<string> {
  const { InvestmentAnalysisEngine } = await import('./investment-engine');
  const engine = new InvestmentAnalysisEngine();

  switch (args.action) {
    case 'analyze_asset': {
      if (!args.symbol || !args.market) {
        return '请提供资产代码和市场类型（如 symbol="600519", market="A股"）';
      }
      const signal = await engine.analyzeAsset({
        symbol: args.symbol,
        market: args.market as any,
      });
      const scoreLabel = signal.signalScore >= 3 ? '看多' : signal.signalScore <= -3 ? '看空' : '中性';
      const signalDetails = Object.entries(signal.signals)
        .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`)
        .join(' | ');
      return [
        `## ${args.symbol}（${args.market}）AI 分析`,
        '',
        `**信号方向**: ${signal.direction}（综合评分: ${signal.signalScore > 0 ? '+' : ''}${signal.signalScore}）`,
        `**操作建议**: ${signal.tier}`,
        `**置信度**: ${(signal.confidence * 100).toFixed(0)}%`,
        '',
        '### 五信号投票',
        signalDetails,
        '',
        '请基于以上分析为用户提供投资建议和风险提示。',
      ].join('\n');
    }

    case 'analyze_portfolio': {
      // 从 DB 查询用户持仓
      const portfolioId = args.portfolioId;
      let positions: any[] = [];
      try {
        const query = portfolioId
          ? db.from('positions').select('*').eq('portfolio_id', portfolioId).eq('user_id', userId)
          : db.from('positions').select('*, portfolios!inner(id)').eq('user_id', userId).limit(50);
        const { data } = await query;
        positions = data ?? [];
      } catch {
        positions = [];
      }

      if (positions.length === 0) {
        return '用户暂无持仓数据。请先在资管页面添加持仓，或告诉我您目前持有哪些资产。';
      }

      // 逐个分析持仓
      const results: string[] = [`## 投资组合 AI 诊断（${positions.length} 个持仓）`, ''];
      for (const pos of positions.slice(0, 10)) {
        try {
          const signal = await engine.analyzeAsset({
            symbol: pos.symbol,
            market: pos.market as any,
          });
          results.push(`- **${pos.name || pos.symbol}**（${pos.market}）: ${signal.tier} | 信号 ${signal.signalScore > 0 ? '+' : ''}${signal.signalScore} | 置信度 ${(signal.confidence * 100).toFixed(0)}%`);
        } catch {
          results.push(`- **${pos.name || pos.symbol}**（${pos.market}）: 分析失败`);
        }
      }
      results.push('', '请基于以上组合诊断为用户提供调仓建议。');
      return results.join('\n');
    }

    case 'screen_stocks': {
      const signals = await engine.screenStocks({
        market: (args.market as any) ?? 'A股',
        limit: 10,
      });
      if (signals.length === 0) {
        return '未找到符合条件的标的。';
      }
      const lines = [`## AI 选股结果（${args.criteria ?? '综合筛选'}）`, ''];
      for (const s of signals) {
        lines.push(`- **${s.symbol}**（${s.market}）: ${s.tier} | 信号 ${s.signalScore > 0 ? '+' : ''}${s.signalScore} | ${s.direction}`);
      }
      lines.push('', '请为用户解读以上选股结果并给出配置建议。');
      return lines.join('\n');
    }

    case 'defi_yield': {
      if (!args.symbol) {
        return '请提供 DeFi 池子地址或名称（如 ETH/USDC Uniswap V3）';
      }
      const yieldAnalysis = await engine.analyzeDefiYield(args.symbol, args.market ?? 'ETH');
      return [
        `## DeFi 收益分析: ${args.symbol}`,
        '',
        `- 总 APY: ${(yieldAnalysis.grossApy * 100).toFixed(2)}%`,
        `- 无常损失: ${(yieldAnalysis.impermanentLossEst * 100).toFixed(2)}%`,
        `- Gas 成本: $${yieldAnalysis.gasCostAnnual.toFixed(2)}/年`,
        `- 净 APY: ${(yieldAnalysis.netApy * 100).toFixed(2)}%`,
        `- 风险评级: ${yieldAnalysis.recommendation}`,
        '',
        '请为用户解读以上 DeFi 收益数据并提示风险。',
      ].join('\n');
    }

    default:
      return `不支持的分析类型: ${args.action}。可选: analyze_asset, analyze_portfolio, screen_stocks, defi_yield`;
  }
}
