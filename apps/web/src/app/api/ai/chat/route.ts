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

    // ─── 结构化数据预查询（Phase 15d）───
    // 自由对话模式下跳过所有数据库查询
    let structuredContext = '';
    if (!isFreeChat) try {
      const executor = new SupabaseQueryExecutor(supabase as any);
      const agent = new StructuredQueryAgent(llm, executor);
      const result = await agent.query(query);
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
    } catch (err) {
      console.warn('[Chat] Structured query failed, falling back to RAG only:', err);
    }

    // ─── 直接大学知识增强（大学名检测 + 学科评估 + 排名）───
    if (!isFreeChat) try {
      const enriched = await enrichUniversityContext(supabase as any, query);
      if (enriched) structuredContext += enriched;
    } catch (err) {
      console.warn('[Chat] University context enrichment failed:', err);
    }

    // ─── 跨模块用户数据收集 ───
    let userContext = '';
    try {
      userContext = await gatherUserContext(auth.user.id, query, supabase as any);
    } catch (err) {
      console.warn('[Chat] User context gathering failed:', err);
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

注意：深度思考标记内的内容会对用户折叠显示，所以请在标记内写完整的思考过程。`;

    // ─── 流式模式 ───
    if (stream) {
      // 自由对话模式：跳过 RAG，直接 LLM
      let chunks: Array<{ content: string; metadata: any; score: number }> = [];
      if (!isFreeChat) {
        chunks = await rag.retrieve({ query, collections, topK: 8 });
        // 过滤低相关性结果（score < 0.15 视为噪音）
        chunks = chunks.filter(c => c.score >= 0.15);
      }

      // 构建系统提示
      const sourcesText = chunks
        .map((c, i) => `[${i + 1}] ${c.content}\n    — 来源: ${(c.metadata as any)?.title ?? '未知'}`)
        .join('\n\n');

      const systemContent = isFreeChat
        ? `你是"知渡"平台的 AI 助手，一个面向高中生和家长的智能顾问。你能够访问用户在平台各模块的个人数据，提供个性化建议。

## 回答规则
1. 用专业、友善的语气回答
2. 针对高考志愿填报、学业规划、职业发展等话题给出有深度的建议
3. 适当使用结构化格式（标题、列表、表格）让回答更清晰
4. 如果不确定信息，请诚实说明并建议用户查阅官方渠道
5. 当用户数据可用时，结合用户实际情况给出个性化建议${userContext ? `\n\n${userContext}` : ''}${STRUCTURED_OUTPUT_INSTRUCTIONS}`
        : `你是"知渡"平台的知识助手。请基于以下参考资料回答用户问题。你能够访问用户在平台各模块的个人数据。

## 回答规则
1. 优先使用参考资料中的信息，**只引用相关性高的资料**，不要强行引用不相关的内容
2. 在回答中用 [1]、[2] 等标注引用来源
3. 如果参考资料不足以回答问题，请明确说明，**不要编造引用**
4. 当用户数据可用时，结合用户实际情况给出个性化建议

## 参考资料
${sourcesText || '（暂无相关参考资料）'}${structuredContext}${userContext ? `\n\n${userContext}` : ''}${STRUCTURED_OUTPUT_INSTRUCTIONS}`;

      const systemMessage = {
        role: 'system' as const,
        content: systemContent,
      };

      const messages = [
        systemMessage,
        ...(chatContext ?? []).map((m: any) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: query },
      ];

      const llmStream = llm.chatStream({
        messages,
        options: { temperature: 0.7, maxTokens: 2048 },
      });

      const encoder = new TextEncoder();
      const sourcesPayload = chunks.map(c => ({
        title: (c.metadata as any)?.title ?? '',
        snippet: c.content.slice(0, 150),
        score: c.score,
      }));

      // Collect full assistant response for persistence
      let fullContent = '';
      const persistSessionId = sessionId;

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

            // 流式发送 LLM 内容
            for await (const chunk of llmStream) {
              if (chunk.delta) {
                fullContent += chunk.delta;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: chunk.delta })}\n\n`),
                );
              }
              if (chunk.done) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              }
            }

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
              metadata: { sessionId: persistSessionId, taskType, mode: preferMode ?? 'auto' },
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
