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
    description: 'AI驱动的投资分析工具。支持个股/币种分析、组合诊断、选股筛选、DeFi收益评估、量化因子挖掘。当用户询问投资建议、持仓分析、市场判断、因子分析时调用。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['analyze_asset', 'analyze_portfolio', 'screen_stocks', 'defi_yield', 'mine_factors'],
          description: '分析类型：analyze_asset=个股/币种分析, analyze_portfolio=组合诊断, screen_stocks=选股筛选, defi_yield=DeFi收益, mine_factors=量化因子挖掘',
        },
        symbol: { type: 'string', description: '资产代码（如 600519, AAPL, BTC）' },
        market: { type: 'string', enum: ['A股', '港股', '美股', 'BTC', 'ETH', 'SOL', 'DeFi', 'other'], description: '市场类型' },
        portfolioId: { type: 'string', description: '投资组合ID（用于 analyze_portfolio）' },
        criteria: { type: 'string', description: '选股条件描述（用于 screen_stocks）' },
        topN: { type: 'number', description: '返回前N个因子（用于 mine_factors，默认10）' },
      },
      required: ['action'],
    },
  },
};

export const CALCULATE_TOOL: FCToolDefinition = {
  type: 'function',
  function: {
    name: 'calculate',
    description: '数学与物理计算引擎。支持：四则运算、方程求解、方程组、微积分（求导/定积分/不定积分）、极限、泰勒展开、矩阵运算（行列式/逆矩阵/特征值）、物理公式（运动学/能量/电路/光学/气体定律）。',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: [
            'evaluate', 'solve', 'solve_system',
            'derivative', 'integral', 'limit', 'series',
            'matrix', 'physics',
          ],
          description: '计算类型。evaluate=数值计算, solve=方程求解, solve_system=方程组, derivative=求导, integral=积分, limit=极限, series=泰勒展开, matrix=矩阵运算, physics=物理公式',
          default: 'evaluate',
        },
        expression: { type: 'string', description: '数学表达式（evaluate/derivative/integral/limit/series 时使用）' },
        equation: { type: 'string', description: '方程（solve 时用），如 "x**2 - 5*x + 6"' },
        equations: { type: 'array', items: { type: 'string' }, description: '方程组（solve_system 时用）' },
        variable: { type: 'string', description: '变量名（默认 x）' },
        variables: { type: 'array', items: { type: 'string' }, description: '变量列表（solve_system 时用）' },
        lower: { type: 'string', description: '积分下限（integral 时用）' },
        upper: { type: 'string', description: '积分上限（integral 时用）' },
        point: { type: 'string', description: '极限/展开点（limit/series 时用）' },
        order: { type: 'number', description: '展开阶数（series 时用，默认 6）' },
        matrix_operation: { type: 'string', enum: ['det', 'inv', 'eigenvalues', 'multiply', 'add', 'rref'], description: '矩阵操作类型' },
        matrices: { type: 'object', description: '矩阵数据，如 {"A": [[1,2],[3,4]]}' },
        formula: {
          type: 'string',
          enum: ['kinematics_v', 'kinematics_s', 'kinetic_energy', 'potential_energy', 'ohms_law', 'power', 'coulomb', 'lens', 'ideal_gas', 'snell'],
          description: '物理公式类型',
        },
        params: { type: 'object', description: '物理公式参数，如 {"m": 2, "v": 10}' },
        description: { type: 'string', description: '计算目的说明（可选）' },
      },
    },
  },
};

export const PORTFOLIO_MANAGE_TOOL: FCToolDefinition = {
  type: 'function',
  function: {
    name: 'portfolio_manage',
    description: '高级投资组合管理工具。支持组合诊断优化、行为偏差检测、策略模板匹配。当用户需要深度组合分析、仓位优化建议、行为偏差纠正时调用。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['diagnose', 'optimize', 'behavioral_check', 'strategy_match'],
          description: '操作类型：diagnose=组合诊断, optimize=仓位优化, behavioral_check=行为偏差检测, strategy_match=策略模板匹配',
        },
        portfolioId: { type: 'string', description: '投资组合ID' },
        positions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              symbol: { type: 'string', description: '资产代码' },
              name: { type: 'string', description: '资产名称' },
              market: { type: 'string', description: '市场' },
              quantity: { type: 'number', description: '持仓数量' },
              avgCost: { type: 'number', description: '平均成本' },
              currentPrice: { type: 'number', description: '当前价格' },
            },
          },
          description: '持仓列表（如未提供portfolioId则使用）',
        },
        riskTolerance: { type: 'string', enum: ['conservative', 'moderate', 'aggressive'], description: '风险偏好' },
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
                  'investment_analyze',
                  'portfolio_manage',
                  'web_search',
                  'calculate',
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
- analysis_run: 运行数据分析（参数: analysis 类型"gpa"或"finance"）
- volunteer_recommend: 生成冲稳保志愿方案（参数: score 分数, province 省份, subjectType 科类）
- investment_analyze: AI投资分析（参数: action 类型, symbol 代码, market 市场）
- portfolio_manage: 高级组合管理（参数: action 类型, positions 持仓, riskTolerance 风险偏好）
- web_search: 搜索互联网获取最新信息（参数: query 搜索关键词）
- calculate: 数学计算（参数: operation 类型, expression 表达式）`;

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

/**
 * 执行 calculate 工具调用
 * 策略：简单算术本地求值（快速），复杂运算调用 Python 计算引擎（SymPy/SciPy）
 */
export async function executeCalculate(args: Record<string, any>): Promise<string> {
  const operation = (args.operation as string) || 'evaluate';
  const desc = args.description ? `（${args.description}）` : '';

  // 简单算术：本地快速求值（不需要 Python 服务）
  if (operation === 'evaluate' && args.expression) {
    const expr = (args.expression as string).trim();
    try {
      const sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/（/g, '(')
        .replace(/）/g, ')')
        .replace(/\^/g, '**');

      if (/^[\d\s+\-*/().%]+$/.test(sanitized)) {
        const result = safeEval(sanitized);
        if (typeof result === 'number' && isFinite(result)) {
          const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(4).replace(/\.?0+$/, '');
          return `## 计算结果${desc}\n\n\`${expr}\` = **${formatted}**`;
        }
      }
    } catch {
      // 本地解析失败，fallback 到 Python 引擎
    }
  }

  // 复杂运算：调用 Python 计算引擎
  const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:5100';
  const mlKey = process.env.ML_API_KEY || '';

  try {
    const res = await fetch(`${mlUrl}/compute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(mlKey ? { 'X-API-Key': mlKey } : {}),
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text();
      // Python 服务不可用 → 对 evaluate 降级到本地简单计算
      if (operation === 'evaluate' && args.expression) {
        try {
          const result = safeEval((args.expression as string).replace(/\^/g, '**'));
          if (typeof result === 'number' && isFinite(result)) {
            const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(4).replace(/\.?0+$/, '');
            return `## 计算结果${desc}\n\n\`${args.expression}\` = **${formatted}**\n\n_(Python 计算引擎不可用，仅支持基础算术)_`;
          }
        } catch { /* ignore */ }
      }
      return `计算引擎错误 (HTTP ${res.status}): ${errText.slice(0, 200)}`;
    }

    const json = await res.json();
    const data = json.data;

    if (!data) return `计算引擎返回空结果`;

    // 格式化结果
    return formatComputeResult(operation, data, desc);
  } catch (e) {
    // 网络超时/不可达 → evaluate 降级
    if (operation === 'evaluate' && args.expression) {
      try {
        const result = safeEval((args.expression as string).replace(/\^/g, '**'));
        if (typeof result === 'number' && isFinite(result)) {
          const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(4).replace(/\.?0+$/, '');
          return `## 计算结果${desc}\n\n\`${args.expression}\` = **${formatted}**\n\n_(Python 计算引擎离线，仅支持基础算术)_`;
        }
      } catch { /* ignore */ }
    }
    return `计算引擎不可用: ${e instanceof Error ? e.message : '连接失败'}\n请确保 ML 微服务已启动 (ML_SERVICE_URL=${mlUrl})`;
  }
}

/** 格式化 Python 计算引擎返回的结果 */
function formatComputeResult(operation: string, data: any, desc: string): string {
  const header = desc ? `## 计算结果${desc}` : '## 计算结果';

  switch (data.type) {
    case 'value':
      return `${header}\n\n\`${data.expression}\` = **${data.result}**${data.latex ? `\n\nLaTeX: $${data.latex}$` : ''}`;

    case 'expression':
      return `${header}\n\n\`${data.expression}\` = ${data.result}${data.latex ? `\n\nLaTeX: $${data.latex}$` : ''}`;

    case 'solution':
      if (data.count === 0) return `${header}\n\n方程 \`${data.equation}\` 无实数解`;
      const sols = data.solutions.map((s: any) => `${s.exact}${s.approx != null ? ` ≈ ${s.approx}` : ''}`).join('，');
      return `${header}\n\n方程 \`${data.equation}\` 的解（关于 ${data.variable}）：\n\n**${sols}**`;

    case 'system_solution':
      if (data.solution) {
        const entries = Object.entries(data.solution).map(([k, v]: [string, any]) => `${k} = ${(v as any).exact ?? v}`).join('，');
        return `${header}\n\n方程组解：**${entries}**`;
      }
      return `${header}\n\n${JSON.stringify(data.solutions ?? data.solution ?? '无解')}`;

    case 'derivative':
      return `${header}\n\n$\\frac{d^{${data.order}}}{d${data.variable}^{${data.order}}}(${data.expression})$ = **${data.result}**\n\nLaTeX: $${data.latex}$`;

    case 'definite_integral':
      return `${header}\n\n$\\int_{${data.bounds}} ${data.expression} \\, d${data.variable}$ = **${data.result}**${data.approx != null ? ` ≈ ${data.approx}` : ''}\n\nLaTeX: $${data.latex}$`;

    case 'indefinite_integral':
      return `${header}\n\n$\\int ${data.expression} \\, d${data.variable}$ = **${data.result}** + C\n\nLaTeX: $${data.latex}$`;

    case 'limit':
      return `${header}\n\n$\\lim_{${data.variable} \\to ${data.point}} ${data.expression}$ = **${data.result}**${data.approx != null ? ` ≈ ${data.approx}` : ''}\n\nLaTeX: $${data.latex}$`;

    case 'series':
      return `${header}\n\n${data.expression} 在 ${data.variable}=${data.point} 处的 ${data.order} 阶展开：\n\n**${data.result}**\n\nLaTeX: $${data.latex}$`;

    case 'matrix':
      return `${header}\n\n矩阵 ${data.operation} 结果：**${data.result}**${data.latex ? `\n\nLaTeX: $${data.latex}$` : ''}${data.eigenvalues ? `\n\n特征值: ${JSON.stringify(data.eigenvalues)}` : ''}`;

    case 'physics':
      return `${header}\n\n${data.description}\n\n参数: ${JSON.stringify(data.params)}\n\n结果: **${data.result}** ${data.unit}`;

    default:
      return `${header}\n\n${JSON.stringify(data, null, 2)}`;
  }
}

/** 安全表达式求值（仅支持数字和基本四则运算） */
function safeEval(expr: string): number {
  // Tokenize
  const tokens: (number | string)[] = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === ' ') { i++; continue; }
    if (/[\d.]/.test(expr[i])) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) { num += expr[i]; i++; }
      tokens.push(parseFloat(num));
    } else if ('+-*/%'.includes(expr[i])) {
      tokens.push(expr[i]); i++;
    } else if (expr[i] === '(') {
      tokens.push('('); i++;
    } else if (expr[i] === ')') {
      tokens.push(')'); i++;
    } else if (expr[i] === '*' && expr[i + 1] === '*') {
      tokens.push('**'); i += 2;
    } else {
      throw new Error(`Unexpected character: ${expr[i]}`);
    }
  }

  // Recursive descent parser
  let pos = 0;
  function parseExpr(): number {
    let result = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }
  function parseTerm(): number {
    let result = parsePower();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/' || tokens[pos] === '%')) {
      const op = tokens[pos++];
      const right = parsePower();
      if (op === '*') result *= right;
      else if (op === '/') { if (right === 0) throw new Error('Division by zero'); result /= right; }
      else result %= right;
    }
    return result;
  }
  function parsePower(): number {
    let result = parseUnary();
    if (pos < tokens.length && tokens[pos] === '**') {
      pos++;
      const right = parsePower(); // right-associative
      result = Math.pow(result, right);
    }
    return result;
  }
  function parseUnary(): number {
    if (pos < tokens.length && tokens[pos] === '-') {
      pos++;
      return -parseAtom();
    }
    if (pos < tokens.length && tokens[pos] === '+') {
      pos++;
    }
    return parseAtom();
  }
  function parseAtom(): number {
    if (pos < tokens.length && tokens[pos] === '(') {
      pos++; // skip '('
      const result = parseExpr();
      if (pos < tokens.length && tokens[pos] === ')') pos++; // skip ')'
      return result;
    }
    const token = tokens[pos++];
    if (typeof token === 'number') return token;
    throw new Error(`Expected number, got: ${token}`);
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error(`Unexpected token: ${tokens[pos]}`);
  return result;
}

/** 根据工具名推断任务类型 */
function inferTaskType(tool: string): AgentTask['type'] {
  switch (tool) {
    case 'knowledge_search':
    case 'university_query':
    case 'analysis_run':
    case 'investment_analyze':
    case 'portfolio_manage':
    case 'web_search':
    case 'calculate':
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

    case 'mine_factors': {
      if (!args.symbol || !args.market) {
        return '请提供资产代码和市场类型（如 symbol="600519", market="A股"）';
      }
      const topN = args.topN ?? 10;
      const factors = await engine.mineFactors(args.symbol, args.market, topN);
      if (factors.length === 0) {
        return `未能为 ${args.symbol}（${args.market}）挖掘到有效因子。可能是数据不足或市场特征不明显。`;
      }
      const lines = [`## 量化因子挖掘结果: ${args.symbol}（${args.market}）`, '', `共挖掘 **${factors.length}** 个有效因子（按夏普比率排序）：`, ''];
      for (const f of factors) {
        lines.push(`- **${f.name}** | 夏普: ${f.sharpe.toFixed(3)} | 最大回撤: ${(f.maxDrawdown * 100).toFixed(1)}% | 胜率: ${(f.winRate * 100).toFixed(1)}%`);
      }
      lines.push('', '### 解读建议');
      lines.push('- 夏普比率 > 1.5 的因子具有较强预测能力');
      lines.push('- 关注因子之间的相关性，避免多重共线性');
      lines.push('- 高胜率 + 低回撤的因子适合稳健型策略');
      lines.push('', '请基于以上因子数据为用户提供量化策略建议和风险提示。');
      return lines.join('\n');
    }

    default:
      return `不支持的分析类型: ${args.action}。可选: analyze_asset, analyze_portfolio, screen_stocks, defi_yield, mine_factors`;
  }
}

/**
 * 执行 portfolio_manage 工具调用
 * 包装 PortfolioAgent 三阶段流水线：Gate Check → 信号分析 → 策略推荐
 */
export async function executePortfolioManage(
  args: {
    action: string;
    portfolioId?: string;
    positions?: Array<{ symbol: string; name: string; market: string; quantity: number; avgCost: number; currentPrice: number }>;
    riskTolerance?: string;
  },
  userId: string,
  db: any,
): Promise<string> {
  const { PortfolioAgent } = await import('./portfolio-agent');
  const agent = new PortfolioAgent();

  // 加载持仓数据
  let positions = args.positions;
  if (!positions || positions.length === 0) {
    try {
      const query = args.portfolioId
        ? db.from('positions').select('*').eq('portfolio_id', args.portfolioId).eq('user_id', userId)
        : db.from('positions').select('*, portfolios!inner(id)').eq('user_id', userId).limit(50);
      const { data } = await query;
      if (data?.length) {
        positions = data.map((p: any) => ({
          symbol: p.symbol,
          name: p.name || p.symbol,
          market: p.market,
          quantity: p.quantity,
          avgCost: p.avg_cost,
          currentPrice: p.current_price,
        }));
      }
    } catch {
      positions = [];
    }
  }

  if (!positions || positions.length === 0) {
    return '用户暂无持仓数据。请先在资管页面添加持仓，或提供 positions 参数。';
  }

  try {
    const result = await agent.analyze({
      userId,
      mode: args.action === 'optimize' ? 'rebalance_plan'
        : args.action === 'behavioral_check' ? 'full_diagnosis'
        : args.action === 'strategy_match' ? 'full_diagnosis'
        : 'quick_scan',
      db,
      portfolioId: args.portfolioId,
      positions: positions.map(p => ({
        symbol: p.symbol,
        name: p.name,
        market: p.market,
        quantity: p.quantity,
        avgCost: p.avgCost,
        currentPrice: p.currentPrice,
        marketValue: p.quantity * p.currentPrice,
        pnl: (p.currentPrice - p.avgCost) * p.quantity,
        pnlPercent: p.avgCost > 0 ? ((p.currentPrice - p.avgCost) / p.avgCost) * 100 : 0,
      })),
    });

    // 格式化结果
    const assessment = result.portfolioAssessment;
    const lines = [
      `## 组合${args.action === 'optimize' ? '优化' : args.action === 'behavioral_check' ? '行为诊断' : args.action === 'strategy_match' ? '策略匹配' : '诊断'}报告`,
      '',
      `### 组合概览`,
      `- 总市值: ¥${assessment.totalValue.toLocaleString()}`,
      `- 总收益: ¥${assessment.totalReturn.toLocaleString()}（${assessment.returnPct.toFixed(2)}%）`,
      `- 夏普比率: ${assessment.sharpeRatio.toFixed(3)}`,
      `- 最大回撤: ${(assessment.maxDrawdown * 100).toFixed(2)}%`,
      `- 分散度: ${(assessment.diversification * 100).toFixed(1)}%`,
      `- 风险等级: ${assessment.riskLevel}`,
      '',
    ];

    // 个股信号
    if (result.positionSignals.length > 0) {
      lines.push('### 持仓信号');
      for (const ps of result.positionSignals) {
        lines.push(`- **${ps.name}**（${ps.symbol}）: ${ps.signal.tier} | 综合信号 ${ps.signal.signalScore > 0 ? '+' : ''}${ps.signal.signalScore} | 建议: ${ps.action}`);
      }
      lines.push('');
    }

    // 推荐操作
    if (result.recommendations.length > 0) {
      lines.push('### 操作建议');
      for (const rec of result.recommendations) {
        lines.push(`- [${rec.urgency.toUpperCase()}] **${rec.type}** ${rec.name}: ${rec.reason}（置信度 ${(rec.confidence * 100).toFixed(0)}%）`);
      }
      lines.push('');
    }

    // 行为偏差
    if (result.behavioralBiases.length > 0) {
      lines.push('### 行为偏差检测');
      for (const bias of result.behavioralBiases) {
        lines.push(`- **${bias.biasNameCN}**（严重度 ${(bias.severity * 100).toFixed(0)}%）: ${bias.evidence}`);
        lines.push(`  - 缓解建议: ${bias.mitigation}`);
      }
      lines.push('');
    }

    // 匹配策略
    if (result.matchedStrategies.length > 0) {
      lines.push('### 匹配策略模板');
      for (const strat of result.matchedStrategies) {
        lines.push(`- **${strat.nameCN}**（${strat.regime}）: ${strat.rules.join('；')}`);
      }
      lines.push('');
    }

    lines.push(`整体置信度: ${(result.overallConfidence * 100).toFixed(0)}%`);
    lines.push('', '请基于以上分析为用户提供详细的投资建议和风险提示。');

    return lines.join('\n');
  } catch (e) {
    return `组合分析执行失败: ${e instanceof Error ? e.message : '未知错误'}`;
  }
}
