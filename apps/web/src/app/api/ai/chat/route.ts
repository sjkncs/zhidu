// API: RAG 智能问答 — 知识库检索 + LLM 生成 + 对话持久化
// POST /api/ai/chat
// Body: { query, collections?, context?, taskType?, stream?, sessionId? }
//
// 支持同步和流式 (SSE) 两种模式，自动持久化对话到 chat_sessions/chat_messages

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createRAGService } from '@zhidu/ai/rag-service';
import { createLLMService } from '@zhidu/ai/llm-service';
import { StructuredQueryAgent } from '@zhidu/ai/structured-query-agent';
import { SupabaseQueryExecutor } from '@zhidu/ai/supabase-query-executor';
import { gatherUserContext } from '@zhidu/ai/user-context-gatherer';
import { WEB_SEARCH_TOOL, executeWebSearch, searchWeb } from '@zhidu/ai/web-search';
import { RUN_TASKS_TOOL, executeRunTasks, VOLUNTEER_RECOMMEND_TOOL, executeVolunteerRecommend, INVESTMENT_ANALYZE_TOOL, executeInvestmentAnalyze, CALCULATE_TOOL, executeCalculate } from '@zhidu/ai/agent-tools';
import { createChatSession, batchCreateChatMessages, deductCredits, getAvailableCredits } from '@zhidu/db/repository';
import { requireUser, authErrorResponse } from '@/lib/auth-utils';
import { checkRateLimit, getRateLimitKey, rateLimitResponse, AI_CHAT_LIMIT } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // 速率限制（每用户每分钟 10 次）
    const rlKey = getRateLimitKey(request);
    const rl = checkRateLimit(`chat:${rlKey}`, AI_CHAT_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl);

    // 要求登录
    let auth;
    try {
      auth = await requireUser();
    } catch (err) {
      return authErrorResponse(err);
    }

    const body = await request.json();
    const {
      query,
      collections,
      context: chatContext,
      taskType = 'KNOWLEDGE_QA',
      stream = false,
      sessionId: inputSessionId,
      preferMode,
      choiceResponse,
    } = body;

    const isFreeChat = preferMode === 'freechat';

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: query' },
        { status: 400 },
      );
    }

    // 限制 query 长度（最大 2000 字符）
    if (query.length > 2000) {
      return NextResponse.json(
        { error: '问题过长，最多 2000 个字符' },
        { status: 400 },
      );
    }

    // ─── AI 额度检查 ───
    const availableCredits = await getAvailableCredits(auth.user.id);
    if (availableCredits <= 0) {
      return NextResponse.json(
        { error: 'AI 额度不足，请充值后再使用', code: 'INSUFFICIENT_CREDITS' },
        { status: 402 },
      );
    }

    const supabase = await createClient();

    // ─── Session management ───
    let sessionId = inputSessionId;
    if (!sessionId) {
      const session = await createChatSession(auth.user.id);
      if (session) sessionId = session.id;
    }

    const llm = createLLMService();
    const rag = createRAGService({ db: supabase as any, llm });

    // ─── Function Calling: ask_user 工具定义 ───
    // LLM 在推理过程中自主决定是否调用此工具来向用户提问
    const askUserTool = {
      type: 'function' as const,
      function: {
        name: 'ask_user',
        description: '当用户的问题不够明确、缺少关键参数（如省份、分数、偏好方向等），需要向用户提出结构化选择题来澄清意图时调用此工具。不要在信息已充足时使用。',
        parameters: {
          type: 'object',
          properties: {
            question: { type: 'string', description: '向用户提出的问题' },
            header: { type: 'string', description: '问题分类标签，如"志愿咨询"、"专业咨询"' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string', description: '选项标题' },
                  description: { type: 'string', description: '选项说明' },
                },
                required: ['label'],
              },
              description: '2-4个选项供用户选择',
            },
            multiSelect: { type: 'boolean', description: '是否允许多选' },
          },
          required: ['question', 'options'],
        },
      },
    };

    // ─── 并行预处理：结构化查询 + 大学增强 + 用户上下文 ───
    // 三个独立查询并行执行，减少首 token 延迟
    let structuredContext = '';
    let userContext = '';

    if (!isFreeChat) {
      const [structuredResult, enrichedResult, userResult] = await Promise.allSettled([
        // 1. 结构化数据预查询
        (async () => {
          const executor = new SupabaseQueryExecutor(supabase as any);
          const agent = new StructuredQueryAgent(llm, executor);
          return agent.query(query);
        })(),
        // 2. 大学知识增强
        enrichUniversityContext(supabase as any, query),
        // 3. 用户上下文采集
        gatherUserContext(auth.user.id, query, supabase as any),
      ]);

      // 处理结构化查询结果
      if (structuredResult.status === 'fulfilled') {
        const result = structuredResult.value;
        if (result.data.length > 0 && result.query.type !== 'UNKNOWN') {
          const items = result.data.slice(0, 5).map((item: any, i: number) => {
            const name = item.name || item.universityName || item.majorName || '未知';
            const details = [
              item.province && `省份: ${item.province}`,
              item.tier && `层次: ${item.tier}`,
              item.is_985 && '985',
              item.is_211 && '211',
              item.school_type && `类型: ${item.school_type}`,
              item.employment_rate && `就业率: ${item.employment_rate}%`,
              item.minScore && `最低分: ${item.minScore}`,
              item.minRank && `最低位次: ${item.minRank}`,
            ].filter(Boolean).join('、');
            const desc = item.description
              ? `\n    简介: ${String(item.description).slice(0, 300)}`
              : '';
            return `[${i + 1}] ${name}${details ? ` — ${details}` : ''}${desc}`;
          });
          structuredContext = `\n\n## 结构化数据查询结果（${result.message}）\n${items.join('\n')}`;
        }
      } else {
        console.warn('[Chat] Structured query failed:', structuredResult.reason);
      }

      // 处理大学增强结果
      if (enrichedResult.status === 'fulfilled' && enrichedResult.value) {
        structuredContext += enrichedResult.value;
      } else if (enrichedResult.status === 'rejected') {
        console.warn('[Chat] University enrichment failed:', enrichedResult.reason);
      }

      // 处理用户上下文结果
      if (userResult.status === 'fulfilled') {
        userContext = userResult.value;
      } else {
        console.warn('[Chat] User context gathering failed:', userResult.reason);
      }
    } else {
      // 自由对话模式只收集用户上下文
      try {
        userContext = await gatherUserContext(auth.user.id, query, supabase as any);
      } catch {
        // silently fail
      }
    }

    // ─── 结构化输出指令（深度思考 / 步骤 / 待办） ───
    const STRUCTURED_OUTPUT_INSTRUCTIONS = `

## 结构化输出格式（请严格遵守）

在回答过程中，请使用以下标记来组织你的思考过程和执行步骤：

1. **深度思考**：在给出最终答案之前，先用标记包裹你的推理过程：
   <!-- type:thinking -->
   这里写下你的分析思路、权衡考虑、推理逻辑...
   <!-- /thinking -->

2. **执行步骤**：当你需要执行多个步骤来回答问题时，用标记列出：
   <!-- type:steps count:N -->
   1. 第一步做什么
   2. 第二步做什么
   ...
   <!-- /steps -->

3. **待办事项**：如果回答中涉及用户需要后续完成的事项，用标记创建待办：
   <!-- type:todo count:N -->
   - [ ] 待办项1
   - [ ] 待办项2
   <!-- /todo -->

注意：深度思考标记内的内容会对用户折叠显示，所以请在标记内写完整的思考过程。

## 输出格式禁令（绝对遵守）

你的回复会直接在聊天界面渲染。以下格式严禁出现在用户可见的文本中：
- 严禁使用 **加粗** 标记（双星号）
- 严禁使用 ___下划线___ 或 ~~~删除线~~~ 标记
- 严禁使用 | 管道符 表格格式（如 | 列1 | 列2 |）
- 严禁使用 --- 分隔线
- 严禁输出任何 HTML 注释标记（如 <!-- -->）作为可见内容

正确做法：
- 需要强调时用「」或【】包裹关键词，如「重要提示」
- 需要列表时用数字编号或短横线，如"1. 第一项"
- 需要表格数据时用逐行列举，如"项目：金额\n交通：23元\n餐饮：30元"
- 在 <!-- type:tool-call --> 标记内只写一行简短描述，如"正在查询XX数据..."，不要把结果数据放在标记内`;

    // ─── 工具使用指引（仅非自由聊天模式） ───
    const TOOL_USAGE_INSTRUCTIONS = isFreeChat ? '' : `

## 可用工具（Function Calling）

你可以调用以下工具来增强回答能力。请自主判断何时使用：

### ask_user — 意图澄清
当用户的问题不够明确、缺少关键决策参数时，调用此工具向用户提出结构化选择题。
**适合调用的场景：**
- "帮我看看志愿方案"（缺少省份、分数、偏好方向）
- "推荐专业"（缺少兴趣方向、文理科、职业规划）
- "帮我规划"（缺少是学业规划还是职业规划）
**不适合调用的场景：**
- 用户已提供足够参数（如"广东620分理科能上什么985"）
- 明确的知识查询（如"清华大学的计算机专业怎么样"）
- 简单的问候或闲聊

### web_search — 网络搜索
搜索互联网获取最新信息，补充知识库中可能过时的数据。
**适合调用的场景：**
- 查询最新的招生政策变化、高考改革动态
- 院校近期新闻、重大事件（如"哈工大最近有什么新闻"）
- 就业市场最新趋势、薪资数据
- 用户询问的问题涉及具体时间（如"2026年"、"今年"、"最近"）
**不适合调用的场景：**
- 查询历年分数线、学科评估等静态数据（知识库已有）
- 通用的知识问答（不需要最新信息）

### run_tasks — 多步骤任务执行
将复杂请求分解为多个子任务并行或顺序执行。
**适合调用的场景：**
- 需要同时查询多个数据源（如"对比清华和北大的计算机专业"）
- 需要同时执行多种操作（如"帮我查分数线并创建备考待办"）
- 需要多步分析的复杂问题
**不适合调用的场景：**
- 简单的单一查询
- 普通的对话和问答

### investment_analyze — 投资分析
对个股、持仓、投资组合进行 AI 量化分析，返回五信号投票、风险评估和操作建议。
**适合调用的场景：**
- "帮我分析XX股票的投资价值"、"600519值得买吗"
- "帮我看看我的持仓"、"我的组合怎么样"
- "推荐几只价值股"、"有什么好的投资机会"
- 任何涉及个股分析、市场判断、量化筛选的问题
**参数说明：**
- action: "analyze_asset"(个股分析) / "analyze_portfolio"(组合分析) / "screen_stocks"(选股)
- symbol: 股票代码（如 "600519"）
- market: 市场（"A股" / "港股" / "美股"）

### volunteer_recommend — 志愿推荐
基于用户分数、省份、科目推荐冲稳保院校方案。
**适合调用的场景：**
- "帮我推荐志愿方案"、"XX分能上什么学校"
- 用户明确提供了分数、省份等参数的志愿咨询

### calculate — 数学与物理计算引擎
精确求解数学和物理问题，支持符号运算。
**适合调用的场景：**
- 求解方程/方程组（如"解方程 x²-5x+6=0"）
- 求导数、积分、极限（如"求 sin(x)/x 在 x→0 的极限"）
- 矩阵运算（行列式、逆矩阵、特征值）
- 物理公式计算（运动学 v=v₀+at、动能 E=½mv²、欧姆定律 V=IR、透镜公式等）
- 精确数值计算（如"680/750*100"、复利公式）
**不适合调用的场景：**
- 简单的文字问答（不需要精确计算）
- 编程相关问题`;

    // ─── 流式模式 ───
    if (stream) {
      // 自由对话模式：跳过 RAG，直接 LLM
      let chunks: Array<{ content: string; metadata: any; score: number }> = [];
      if (!isFreeChat) {
        chunks = await rag.retrieve({ query, collections, topK: 8 });
        // 过滤低相关性结果（score < 0.15 视为噪音）
        chunks = chunks.filter(c => c.score >= 0.15);
      }

      // ─── 自动网页搜索补充 ───
      // 触发条件（满足任一即搜索）：
      //   a) 知识库无结果
      //   b) 知识库平均相关性 < 0.30
      //   c) 查询含时效性关键词（年份、"最新"等）
      //   d) 自由对话模式下的事实性问题（含问号或疑问词）
      let webSources: Array<{ title: string; url: string; snippet: string }> = [];
      let autoSearched = false;

      const TIME_SENSITIVE_RE = /(?:20[12]\d|今年|去年|明年|最新|最近|今天|昨天|刚刚|目前|当前)/;
      const FACTUAL_QUERY_RE = /[？?]|(?:什么|哪些|怎么|如何|为什么|是否|有没有|公布|发布)/;
      const isTimeSensitive = TIME_SENSITIVE_RE.test(query);
      const isFactualQuery = FACTUAL_QUERY_RE.test(query);

      if (!isFreeChat) {
        const avgScore = chunks.length > 0 ? chunks.reduce((s, c) => s + c.score, 0) / chunks.length : 0;
        const needsWebSearch =
          chunks.length === 0 ||
          avgScore < 0.30 ||
          isTimeSensitive;

        if (needsWebSearch) {
          try {
            webSources = await searchWeb({ query, maxResults: 5 });
            autoSearched = true;
            console.log(`[Chat] Auto web search triggered (reason: ${chunks.length === 0 ? 'no KB' : avgScore < 0.30 ? `low score ${avgScore.toFixed(2)}` : 'time-sensitive'}), got ${webSources.length} results`);
          } catch (e) {
            console.warn('[Chat] Auto web search failed:', e instanceof Error ? e.message : e);
          }
        }
      } else if (isTimeSensitive || isFactualQuery) {
        // 自由对话模式：仅对时效性查询或事实性问题自动搜索
        try {
          webSources = await searchWeb({ query, maxResults: 5 });
          autoSearched = true;
          console.log(`[Chat] Freechat auto web search triggered (reason: ${isTimeSensitive ? 'time-sensitive' : 'factual query'}), got ${webSources.length} results`);
        } catch (e) {
          console.warn('[Chat] Freechat auto web search failed:', e instanceof Error ? e.message : e);
        }
      }

      // 构建系统提示：合并知识库来源 + 网页来源
      // 当自动搜索成功且有网页来源时，过滤低分 KB 结果并将网页来源前置
      const filteredChunks = (autoSearched && webSources.length > 0)
        ? chunks.filter(c => c.score >= 0.35)
        : chunks;

      const kbSourcesText = filteredChunks
        .map((c, i) => `[${i + 1}] ${c.content}\n    — 来源: ${(c.metadata as any)?.title ?? '未知'}`)
        .join('\n\n');
      const kbCount = filteredChunks.length;
      const webSourcesText = webSources
        .map((w, i) => `[${kbCount + i + 1}] ${w.snippet}\n    — 来源: ${w.title} (${w.url})`)
        .join('\n\n');
      // 网页来源前置：让 LLM 优先使用更相关、更时效的网页信息
      const sourcesText = autoSearched && webSources.length > 0
        ? [webSourcesText, kbSourcesText].filter(Boolean).join('\n\n')
        : [kbSourcesText, webSourcesText].filter(Boolean).join('\n\n');

      const systemContent = isFreeChat
        ? `你是"知渡"平台的 AI 助手，一个面向高中生和家长的智能顾问。你能够访问用户在平台各模块的个人数据，提供个性化建议。

## 回答规则
1. 用专业、友善的语气回答
2. 针对高考志愿填报、学业规划、职业发展等话题给出有深度的建议
3. 适当使用标题和编号列表让回答更清晰，严禁使用markdown表格和加粗标记
4. 如果不确定信息，请诚实说明并建议用户查阅官方渠道
5. 当用户数据可用时，结合用户实际情况给出个性化建议${userContext ? `\n\n${userContext}` : ''}${STRUCTURED_OUTPUT_INSTRUCTIONS}${TOOL_USAGE_INSTRUCTIONS}`
        : `你是"知渡"平台的知识助手。请基于以下参考资料回答用户问题。你能够访问用户在平台各模块的个人数据。

## 回答规则
1. 优先使用参考资料中的信息，**只引用相关性高的资料**，不要强行引用不相关的内容
2. 在回答中用 [1]、[2] 等标注引用来源
3. 如果参考资料不足以回答问题，请明确说明，**不要编造引用**
4. 当用户数据可用时，结合用户实际情况给出个性化建议

## 参考资料
${sourcesText || '（暂无相关参考资料）'}${structuredContext}${userContext ? `\n\n${userContext}` : ''}${STRUCTURED_OUTPUT_INSTRUCTIONS}${TOOL_USAGE_INSTRUCTIONS}`;

      const systemMessage = {
        role: 'system' as const,
        content: systemContent,
      };

      const messages = [
        systemMessage,
        ...(chatContext ?? []).map((m: any) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: query },
      ];

      // 如果用户是回答之前的澄清问题，注入选择结果到上下文
      const choiceContextHint = choiceResponse
        ? `\n\n[用户之前回答了你的澄清问题，选择了: ${choiceResponse.join('、')}]`
        : '';

      const llmStream = llm.chatStream({
        messages: choiceContextHint
          ? [
              systemMessage,
              ...(chatContext ?? []).map((m: any) => ({ role: m.role, content: m.content })),
              { role: 'user' as const, content: query + choiceContextHint },
            ]
          : messages,
        options: {
          temperature: 0.7,
          maxTokens: 2048,
          tools: isFreeChat ? undefined : [askUserTool, WEB_SEARCH_TOOL, RUN_TASKS_TOOL, VOLUNTEER_RECOMMEND_TOOL, INVESTMENT_ANALYZE_TOOL, CALCULATE_TOOL],
        },
      });

      const encoder = new TextEncoder();
      const kbSourcesPayload = filteredChunks.map(c => ({
        title: (c.metadata as any)?.title ?? '',
        url: (c.metadata as any)?.sourceUrl,
        snippet: c.content.slice(0, 150),
        score: c.score,
        type: 'kb' as const,
      }));
      const webSourcesPayload = webSources.map(w => ({
        title: w.title,
        url: w.url,
        snippet: w.snippet.slice(0, 150),
        score: 0.8,
        type: 'web' as const,
      }));
      // 自动搜索成功时网页来源前置，否则 KB 来源在前
      const sourcesPayload = (autoSearched && webSourcesPayload.length > 0)
        ? [...webSourcesPayload, ...kbSourcesPayload]
        : [...kbSourcesPayload, ...webSourcesPayload];

      // Collect full assistant response for persistence
      let fullContent = '';
      const persistSessionId = sessionId;

      // Function Calling: 累积 tool_call 参数
      let toolCallArgs = '';
      let toolCallName = '';
      let hasToolCall = false;

      const readable = new ReadableStream({
        async start(controller) {
          try {
            // 发送 sessionId
            if (persistSessionId) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: persistSessionId })}\n\n`),
              );
            }

            // 先发送来源信息
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources: sourcesPayload })}\n\n`),
            );

            // 流式发送 LLM 内容，同时处理 tool_calls
            for await (const chunk of llmStream) {
              // 处理 tool_call 增量
              if (chunk.toolCallDelta) {
                toolCallName = chunk.toolCallDelta.name || toolCallName;
                toolCallArgs += chunk.toolCallDelta.arguments;
                hasToolCall = true;
                console.log('[Chat Stream] toolCallDelta:', { name: chunk.toolCallDelta.name, argsFragment: chunk.toolCallDelta.arguments?.substring(0, 100) });
                continue;
              }

              if (chunk.delta) {
                fullContent += chunk.delta;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: chunk.delta })}\n\n`),
                );
              }
              if (chunk.done) {
                // 诊断日志：工具调用状态
                if (hasToolCall) {
                  console.log('[Chat Stream] Tool call detected:', { name: toolCallName, argsLength: toolCallArgs.length, argsPreview: toolCallArgs.substring(0, 200) });
                } else {
                  console.log('[Chat Stream] No tool call in this response');
                }

                // ─── ask_user: 发送 choice_prompt 事件，短路 ───
                if (hasToolCall && toolCallName === 'ask_user') {
                  try {
                    const parsed = JSON.parse(toolCallArgs);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        type: 'choice_prompt',
                        prompt: {
                          question: parsed.question ?? '请选择：',
                          header: parsed.header,
                          options: parsed.options ?? [],
                          multiSelect: parsed.multiSelect ?? false,
                        },
                      })}\n\n`),
                    );
                  } catch {
                    console.warn('[Chat Stream] Failed to parse ask_user args:', toolCallArgs);
                  }
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  return; // 短路：不持久化、不扣费
                }

                // ─── web_search: 执行搜索，注入结果，继续生成 ───
                if (hasToolCall && toolCallName === 'web_search') {
                  try {
                    // Robust JSON parsing: LLM may return malformed args
                    let searchQuery = query;
                    let maxResults = 5;
                    try {
                      const searchArgs = JSON.parse(toolCallArgs);
                      searchQuery = searchArgs.query ?? query;
                      maxResults = searchArgs.maxResults ?? 5;
                    } catch {
                      // Fallback: try to extract query from malformed JSON via regex
                      const queryMatch = toolCallArgs.match(/"query"\s*:\s*"([^"]+)"/);
                      if (queryMatch) searchQuery = queryMatch[1];
                    }

                    // 去重：如果自动搜索已执行且查询相似，复用已有结果
                    const isDuplicateSearch = autoSearched && webSources.length > 0 &&
                      (searchQuery === query || searchQuery.length > 0 && query.includes(searchQuery.slice(0, Math.min(10, searchQuery.length))));

                    // 通知客户端正在搜索
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: `<!-- type:tool-call -->\n正在搜索: ${searchQuery}\n<!-- /tool-call -->\n\n` })}\n\n`),
                    );

                    let webResults: Array<{ title: string; url: string; snippet: string }>;
                    if (isDuplicateSearch) {
                      webResults = webSources;
                      console.log('[Chat] Skipping duplicate web_search, reusing auto search results');
                    } else {
                      // 执行网络搜索（直接调用 searchWeb 获取结构化结果）
                      webResults = await searchWeb({
                        query: searchQuery,
                        maxResults: Math.min(maxResults, 10),
                      });
                    }

                    // 发送 sources_update 事件，前端追加网页来源（带可访问 URL）
                    if (webResults.length > 0) {
                      const webSourcesUpdate = webResults.map(w => ({
                        title: w.title,
                        url: w.url,
                        snippet: w.snippet.slice(0, 150),
                        score: 0.8,
                        type: 'web' as const,
                      }));
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'sources_update', sources: webSourcesUpdate })}\n\n`),
                      );
                    }

                    // 格式化为 LLM 可消费的文本
                    const searchResults = webResults.length > 0
                      ? `## 网络搜索结果（"${searchQuery}"）\n\n${webResults.map((r, i) => `[${i + 1}] **${r.title}**\n    ${r.snippet}\n    来源: ${r.url}`).join('\n\n')}`
                      : '未找到相关结果。请基于已有知识回答用户的问题。';

                    // 构造第二轮消息（含搜索结果）
                    const followUpMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
                      ...(choiceContextHint
                        ? [
                            systemMessage,
                            ...(chatContext ?? []).map((m: any) => ({ role: m.role, content: m.content })),
                            { role: 'user' as const, content: query + choiceContextHint },
                          ]
                        : [
                            systemMessage,
                            ...(chatContext ?? []).map((m: any) => ({ role: m.role, content: m.content })),
                            { role: 'user' as const, content: query },
                          ]),
                      { role: 'assistant' as const, content: `[调用工具: web_search("${searchQuery}")]` },
                      { role: 'user' as const, content: `搜索结果如下，请基于这些结果回答用户的问题，用 [来源N] 标注引用：\n\n${searchResults}` },
                    ];

                    // 第二轮 LLM 流（不带 tools，避免无限循环）
                    // 加 30s 超时保护，防止 API 卡死导致客户端无响应
                    const followUpStream = llm.chatStream({
                      messages: followUpMessages,
                      options: { temperature: 0.7, maxTokens: 2048 },
                    });

                    let followUpTimeout = false;
                    const followUpTimer = setTimeout(() => { followUpTimeout = true; }, 30000);

                    try {
                      for await (const followChunk of followUpStream) {
                        if (followUpTimeout) {
                          console.warn('[Chat Stream] Follow-up LLM timed out after 30s');
                          break;
                        }
                        if (followChunk.delta) {
                          fullContent += followChunk.delta;
                          controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: followChunk.delta })}\n\n`),
                          );
                        }
                      }
                    } finally {
                      clearTimeout(followUpTimer);
                    }

                    // 降级：如果第二轮 LLM 超时或无内容，直接输出搜索结果
                    if (followUpTimeout && !fullContent) {
                      fullContent = searchResults;
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: `\n\n${searchResults}` })}\n\n`),
                      );
                    }
                  } catch (searchErr) {
                    console.warn('[Chat Stream] web_search failed:', searchErr);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: '\n\n（网络搜索暂时不可用，基于已有知识回答）' })}\n\n`),
                    );
                  }
                }

                // ─── run_tasks: 执行多步骤任务，实时推送进度 ───
                if (hasToolCall && toolCallName === 'run_tasks') {
                  try {
                    const taskArgs = JSON.parse(toolCallArgs);

                    // 执行任务（通过 onTaskUpdate 回调推送 SSE 事件）
                    const taskResults = await executeRunTasks(
                      taskArgs,
                      auth.user.id,
                      supabase as any,
                      (taskEvent) => {
                        controller.enqueue(
                          encoder.encode(`data: ${JSON.stringify({
                            type: 'task_update',
                            task: taskEvent,
                          })}\n\n`),
                        );
                      },
                    );

                    // 通知客户端任务完成，正在生成回复
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: '\n\n' })}\n\n`),
                    );

                    // 构造第二轮消息（含任务执行结果）
                    const followUpMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
                      ...(choiceContextHint
                        ? [
                            systemMessage,
                            ...(chatContext ?? []).map((m: any) => ({ role: m.role, content: m.content })),
                            { role: 'user' as const, content: query + choiceContextHint },
                          ]
                        : [
                            systemMessage,
                            ...(chatContext ?? []).map((m: any) => ({ role: m.role, content: m.content })),
                            { role: 'user' as const, content: query },
                          ]),
                      { role: 'assistant' as const, content: `[调用工具: run_tasks("${taskArgs.goal}")]` },
                      { role: 'user' as const, content: `任务执行结果如下，请基于这些结果给用户一个完整的回答：\n\n${taskResults}` },
                    ];

                    // 第二轮 LLM 流（不带 tools，避免无限循环）
                    // 加 30s 超时保护，防止 API 卡死导致客户端无响应
                    const followUpStream = llm.chatStream({
                      messages: followUpMessages,
                      options: { temperature: 0.7, maxTokens: 2048 },
                    });

                    let followUpTimeout = false;
                    const followUpTimer = setTimeout(() => { followUpTimeout = true; }, 30000);

                    try {
                      for await (const followChunk of followUpStream) {
                        if (followUpTimeout) {
                          console.warn('[Chat Stream] Follow-up LLM timed out after 30s');
                          break;
                        }
                        if (followChunk.delta) {
                          fullContent += followChunk.delta;
                          controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: followChunk.delta })}\n\n`),
                          );
                        }
                      }
                    } finally {
                      clearTimeout(followUpTimer);
                    }

                    // 降级：如果第二轮 LLM 超时或无内容，直接输出任务结果
                    if (followUpTimeout && !fullContent) {
                      fullContent = taskResults;
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: `\n\n${taskResults}` })}\n\n`),
                      );
                    }
                  } catch (taskErr) {
                    console.warn('[Chat Stream] run_tasks failed:', taskErr);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: '\n\n（任务执行暂时不可用，基于已有知识回答）' })}\n\n`),
                    );
                  }
                }

                // ─── volunteer_recommend: 执行志愿推荐，注入结果 ───
                if (hasToolCall && toolCallName === 'volunteer_recommend') {
                  try {
                    const parsed = JSON.parse(toolCallArgs);
                    const result = await executeVolunteerRecommend(parsed, auth.user.id, supabase);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: result })}\n\n`),
                    );
                    fullContent += result;
                  } catch (err) {
                    const errMsg = `志愿推荐执行失败: ${err instanceof Error ? err.message : '未知错误'}`;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: errMsg })}\n\n`),
                    );
                    fullContent += errMsg;
                  }
                }

                // ─── investment_analyze: 执行投资分析，注入结果，LLM 二次生成 ───
                if (hasToolCall && toolCallName === 'investment_analyze') {
                  try {
                    const parsed = JSON.parse(toolCallArgs);
                    const symbol = parsed.symbol ?? '未知';
                    const market = parsed.market ?? 'A股';
                    const action = parsed.action ?? 'analyze_asset';

                    // 通知客户端正在分析
                    const actionLabels: Record<string, string> = {
                      analyze_asset: `正在分析: ${symbol}（${market}）`,
                      analyze_portfolio: '正在分析投资组合',
                      screen_stocks: '正在筛选股票',
                    };
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: `<!-- type:tool-call -->\n${actionLabels[action] ?? `正在分析: ${symbol}`}\n<!-- /tool-call -->\n\n` })}\n\n`),
                    );

                    // 执行投资分析引擎
                    const result = await executeInvestmentAnalyze(parsed, auth.user.id, supabase);

                    // 构造第二轮消息（含分析结果）
                    const followUpMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
                      ...(choiceContextHint
                        ? [
                            systemMessage,
                            ...(chatContext ?? []).map((m: any) => ({ role: m.role, content: m.content })),
                            { role: 'user' as const, content: query + choiceContextHint },
                          ]
                        : [
                            systemMessage,
                            ...(chatContext ?? []).map((m: any) => ({ role: m.role, content: m.content })),
                            { role: 'user' as const, content: query },
                          ]),
                      { role: 'assistant' as const, content: `[调用工具: investment_analyze(${JSON.stringify(parsed)})]` },
                      { role: 'user' as const, content: `以下是投资分析引擎返回的量化数据，请基于这些数据为用户提供专业的投资建议和风险提示。用通俗易懂的语言解读信号含义，给出明确的操作建议（买入/持有/卖出），并说明风险点：\n\n${result}` },
                    ];

                    // 第二轮 LLM 流（不带 tools，避免循环）
                    const followUpStream = llm.chatStream({
                      messages: followUpMessages,
                      options: { temperature: 0.7, maxTokens: 2048 },
                    });

                    let followUpTimeout = false;
                    const followUpTimer = setTimeout(() => { followUpTimeout = true; }, 30000);

                    try {
                      for await (const followChunk of followUpStream) {
                        if (followUpTimeout) {
                          console.warn('[Chat Stream] Investment follow-up LLM timed out after 30s');
                          break;
                        }
                        if (followChunk.delta) {
                          fullContent += followChunk.delta;
                          controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: followChunk.delta })}\n\n`),
                          );
                        }
                      }
                    } finally {
                      clearTimeout(followUpTimer);
                    }

                    // 降级：如果第二轮超时或无内容，直接输出引擎原始结果
                    if (followUpTimeout && !fullContent) {
                      fullContent = result;
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: `\n\n${result}` })}\n\n`),
                      );
                    }
                  } catch (err) {
                    const errMsg = `投资分析执行失败: ${err instanceof Error ? err.message : '未知错误'}`;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: errMsg })}\n\n`),
                    );
                    fullContent += errMsg;
                  }
                }

                // ─── calculate: 执行数学计算，直接返回结果 ───
                if (hasToolCall && toolCallName === 'calculate') {
                  try {
                    const parsed = JSON.parse(toolCallArgs);
                    const calcResult = await executeCalculate(parsed);

                    // 通知客户端正在计算
                    const calcLabel = parsed.expression ?? parsed.equation ?? (parsed.formula ? `${parsed.formula}(${JSON.stringify(parsed.params ?? {})})` : parsed.operation ?? '计算');
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: `<!-- type:tool-call -->\n正在计算: ${calcLabel}\n<!-- /tool-call -->\n\n` })}\n\n`),
                    );

                    // 直接输出计算结果
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: calcResult })}\n\n`),
                    );
                    fullContent += calcResult;
                  } catch (err) {
                    const errMsg = `计算执行失败: ${err instanceof Error ? err.message : '未知错误'}`;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: errMsg })}\n\n`),
                    );
                    fullContent += errMsg;
                  }
                }

                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              }
            }

            // ask_user 已在循环内 return 短路，此处只处理正常回答和 web_search
            // Persist messages after stream completes
            if (persistSessionId && fullContent) {
              await batchCreateChatMessages(persistSessionId, [
                { role: 'user', content: query, taskType },
                { role: 'assistant', content: fullContent, sources: sourcesPayload, taskType },
              ]);
            }

            // Deduct AI credits (1 credit per chat)
            await deductCredits(auth.user.id, 1, 'chat', 'chat_message', {
              tokensOut: fullContent.length,
              model: preferMode === 'freechat' ? 'deepseek-v4-pro' : 'deepseek-v4-pro',
              metadata: {
                sessionId: persistSessionId,
                taskType,
                mode: preferMode ?? 'auto',
                ...(hasToolCall ? { toolUsed: toolCallName } : {}),
              },
            });
          } catch (err) {
            console.error('[Chat Stream] error:', err);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Stream error' })}\n\n`),
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ─── 同步模式 ───
    let content: string;
    let sources: Array<{ content: string; metadata: any; score: number }> = [];

    if (isFreeChat) {
      // 自由对话：直接 LLM（含结构化输出指令 + 用户数据上下文）
      const syncSystemPrompt = `你是"知渡"平台的 AI 助手，一个面向高中生和家长的智能顾问。用专业、友善的语气回答。${userContext ? `\n\n${userContext}` : ''}${STRUCTURED_OUTPUT_INSTRUCTIONS}`;
      content = await llm.chat({
        messages: [
          { role: 'system', content: syncSystemPrompt },
          ...(chatContext ?? []).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: query },
        ],
        options: { temperature: 0.7, maxTokens: 2048 },
      });
    } else {
      const chatContextText = chatContext?.map((m: any) => `${m.role}: ${m.content}`).join('\n');
      const result = await rag.retrieveAndGenerate({
        query,
        collections,
        context: [chatContextText, structuredContext].filter(Boolean).join('\n'),
      });
      content = result.content;
      sources = result.sources;

      // 同步模式也补充网页来源（KB 相关性不足时）
      const avgScore = sources.length > 0 ? sources.reduce((s, c) => s + c.score, 0) / sources.length : 0;
      const syncTimeSensitive = /(?:20[12]\d|今年|去年|最新|今天|刚刚)/.test(query);
      if (sources.length === 0 || avgScore < 0.30 || syncTimeSensitive) {
        try {
          const webResults = await searchWeb({ query, maxResults: 5 });
          for (const w of webResults) {
            sources.push({
              content: w.snippet,
              metadata: { title: w.title, sourceUrl: w.url },
              score: 0.8,
            });
          }
        } catch {
          // web search failed silently
        }
      }
    }

    // Persist synchronous messages
    if (sessionId) {
      const sourcesPayload = sources.map(s => ({
        title: (s.metadata as any)?.title ?? '',
        snippet: s.content.slice(0, 200),
        score: s.score,
      }));
      await batchCreateChatMessages(sessionId, [
        { role: 'user', content: query, taskType },
        { role: 'assistant', content, sources: sourcesPayload, taskType },
      ]);
    }

    // Deduct AI credits (1 credit per chat)
    await deductCredits(auth.user.id, 1, 'chat', 'chat_message', {
      tokensOut: content?.length ?? 0,
      model: 'deepseek-v4-pro',
      metadata: { sessionId, taskType, mode: preferMode ?? 'auto', sync: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        content,
        sessionId,
        sources: sources.map(s => ({
          title: (s.metadata as any)?.title ?? '',
          url: (s.metadata as any)?.sourceUrl,
          snippet: s.content.slice(0, 200),
          score: s.score,
        })),
        taskType,
      },
    });
  } catch (err: any) {
    console.error('[API] AI chat error:', err);
    return NextResponse.json(
      { error: err.message || '智能问答服务暂时不可用' },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 大学知识增强：检测 query 中的大学名，直接查表补充详细信息
// ─────────────────────────────────────────────────────────────────────────────

/** 常见大学名称关键词列表（用于检测 query 是否提及具体大学） */
const UNIVERSITY_KEYWORDS = [
  '北京大学', '清华大学', '复旦大学', '上海交通大学', '浙江大学',
  '中国科学技术大学', '南京大学', '哈尔滨工业大学', '西安交通大学',
  '武汉大学', '华中科技大学', '中山大学', '同济大学', '北京师范大学',
  '南开大学', '天津大学', '东南大学', '中国人民大学', '北京航空航天大学',
  '北京理工大学', '电子科技大学', '四川大学', '山东大学', '厦门大学',
  '大连理工大学', '吉林大学', '中南大学', '湖南大学', '兰州大学',
  '重庆大学', '西北工业大学', '东北大学', '中国农业大学', '中国海洋大学',
  '华东师范大学', '华南理工大学', '北京交通大学', '北京科技大学',
  '南京航空航天大学', '南京理工大学', '河海大学', '苏州大学',
  '武汉理工大学', '合肥工业大学', '西南交通大学', '长安大学',
  '暨南大学', '郑州大学', '云南大学', '新疆大学', '广西大学',
  '贵州大学', '海南大学', '宁夏大学', '青海大学', '西藏大学',
  '石河子大学', '延边大学', '中国石油大学', '中国地质大学',
  '中国矿业大学', '华北电力大学', '上海大学', '江南大学',
  '华中师范大学', '陕西师范大学', '东北师范大学', '西南大学',
];

/** 常见学科/专业关键词（用于检测用户问的是哪个专业方向） */
const DISCIPLINE_KEYWORDS = [
  '计算机', '软件工程', '人工智能', '数据科学', '电子', '通信', '自动化',
  '数学', '物理', '化学', '生物', '天文', '力学', '材料',
  '经济', '金融', '会计', '管理', '工商管理',
  '法学', '政治', '社会学', '哲学', '历史',
  '中文', '外语', '英语', '新闻', '传播',
  '临床医学', '口腔', '药学', '护理', '公共卫生',
  '建筑', '土木', '城市规划',
  '机械', '车辆', '航空', '航天',
  '环境', '能源', '核工程',
  '心理学', '教育学', '体育',
  '艺术', '设计', '音乐', '美术',
];

async function enrichUniversityContext(
  supabase: any,
  query: string,
): Promise<string | null> {
  // 检测 query 中提及的大学名
  const mentioned = UNIVERSITY_KEYWORDS.filter((kw) => query.includes(kw));
  if (mentioned.length === 0) return null;

  // 检测 query 中提及的学科/专业
  const mentionedDisciplines = DISCIPLINE_KEYWORDS.filter((kw) => query.includes(kw));

  const sections: string[] = [];

  for (const uniName of mentioned.slice(0, 4)) {
    // 1. 查大学基本信息
    const { data: uni } = await supabase
      .from('universities')
      .select('id, name, province, city, tier, is_985, is_211, is_dual_first_class, school_type, description, motto, affiliated, founding_year, master_programs, doctoral_programs')
      .ilike('name', `%${uniName}%`)
      .limit(1)
      .single();

    if (!uni) continue;

    const parts: string[] = [`### ${uni.name}`];
    const meta = [
      uni.province && `${uni.province}`,
      uni.city && `${uni.city}`,
      uni.tier && `${uni.tier}`,
      uni.is_985 && '985',
      uni.is_211 && '211',
      uni.is_dual_first_class && '双一流',
      uni.school_type && `${uni.school_type}`,
    ].filter(Boolean).join(' · ');
    if (meta) parts.push(meta);

    // 2. 查排名
    const { data: rankings } = await supabase
      .from('university_rankings')
      .select('source, year, rank')
      .eq('university_id', uni.id)
      .order('year', { ascending: false })
      .limit(3);

    if (rankings && rankings.length > 0) {
      const rankStr = rankings
        .map((r: any) => `${r.source === 'ruanke' ? '软科' : r.source} ${r.year}年第${r.rank}名`)
        .join('、');
      parts.push(`综合排名: ${rankStr}`);
    }

    // 3. 如果用户提及了具体学科，优先查该学科的评估
    if (mentionedDisciplines.length > 0) {
      for (const discipline of mentionedDisciplines.slice(0, 2)) {
        const { data: specificEval } = await supabase
          .from('discipline_evaluations')
          .select('discipline_name, rating')
          .eq('university_id', uni.id)
          .ilike('discipline_name', `%${discipline}%`)
          .limit(3);

        if (specificEval && specificEval.length > 0) {
          const evalStr = specificEval
            .map((e: any) => `${e.discipline_name}: ${e.rating}`)
            .join('、');
          parts.push(`【${discipline}相关学科评估】${evalStr}`);
        } else {
          parts.push(`【${discipline}】该校无第四轮学科评估数据`);
        }
      }
    }

    // 4. 查全部学科评估（Top 10 优势学科）
    const { data: evals } = await supabase
      .from('discipline_evaluations')
      .select('discipline_name, rating')
      .eq('university_id', uni.id)
      .limit(20);

    if (evals && evals.length > 0) {
      // 按评级排序：A+ > A > A- > B+ > B > B- > C+ > C > C-
      const ratingOrder: Record<string, number> = {
        'A+': 0, 'A': 1, 'A-': 2, 'B+': 3, 'B': 4, 'B-': 5, 'C+': 6, 'C': 7, 'C-': 8,
      };
      const sorted = evals.sort((a: any, b: any) =>
        (ratingOrder[a.rating] ?? 99) - (ratingOrder[b.rating] ?? 99),
      );
      const topEvals = sorted.slice(0, 12);
      const aPlus = topEvals.filter((e: any) => e.rating === 'A+');
      const aLevel = topEvals.filter((e: any) => e.rating === 'A');
      const aMinus = topEvals.filter((e: any) => e.rating === 'A-');

      if (aPlus.length > 0) {
        parts.push(`A+学科: ${aPlus.map((e: any) => e.discipline_name).join('、')}`);
      }
      if (aLevel.length > 0) {
        parts.push(`A学科: ${aLevel.map((e: any) => e.discipline_name).join('、')}`);
      }
      if (aMinus.length > 0) {
        parts.push(`A-学科: ${aMinus.map((e: any) => e.discipline_name).join('、')}`);
      }
      const others = topEvals.filter((e: any) => !['A+', 'A', 'A-'].includes(e.rating));
      if (others.length > 0) {
        parts.push(`其他优势学科: ${others.map((e: any) => `${e.discipline_name}(${e.rating})`).join('、')}`);
      }
    }

    // 5. 描述（截取前 400 字）
    if (uni.description) {
      parts.push(`\n学校简介: ${uni.description.slice(0, 400)}`);
    }

    sections.push(parts.join('\n'));
  }

  if (sections.length === 0) return null;

  // 如果有学科对比，在前面加一段总结
  let header = '## 大学详细信息（来自平台数据库，请优先使用此数据回答）';
  if (mentionedDisciplines.length > 0 && mentioned.length >= 2) {
    header += `\n\n> 用户正在对比 **${mentioned.join(' vs ')}** 的 **${mentionedDisciplines[0]}** 方向，请重点参考学科评估等级进行对比分析。`;
  }

  return `\n\n${header}\n\n${sections.join('\n\n---\n\n')}`;
}
