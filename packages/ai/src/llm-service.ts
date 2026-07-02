// @zhidu/ai — LLM 服务实现（DeepSeek / GLM 双模型）
// 基于 OpenAI-compatible API 格式，支持同步、流式、结构化输出

import type { LLMService, LLMOptions, AIStreamChunk, TaskType } from './index';

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface OpenAIResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface OpenAIStreamDelta {
  id: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP 请求封装
// ─────────────────────────────────────────────────────────────────────────────

async function callLLM(
  config: LLMConfig,
  messages: ChatMessage[],
  options: LLMOptions = {},
): Promise<string> {
  const { temperature = 0.7, maxTokens = 4096, jsonMode = false } = options;

  const body: Record<string, unknown> = {
    model: options.model ?? config.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  return data.choices[0]?.message?.content ?? '';
}

async function* streamLLM(
  config: LLMConfig,
  messages: ChatMessage[],
  options: LLMOptions = {},
): AsyncIterable<AIStreamChunk> {
  const { temperature = 0.7, maxTokens = 4096 } = options;

  const body = {
    model: options.model ?? config.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  if (!response.body) {
    throw new Error('LLM API returned no stream body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // Keep incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        yield { delta: '', done: true, final: undefined };
        return;
      }

      try {
        const parsed = JSON.parse(data) as OpenAIStreamDelta;
        const content = parsed.choices[0]?.delta?.content ?? '';
        if (content) {
          fullContent += content;
          yield { delta: content, done: false };
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }

  // If stream ended without [DONE]
  yield { delta: '', done: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 模型配置
// ─────────────────────────────────────────────────────────────────────────────

function getConfig(model?: string): LLMConfig {
  const useGLM = model?.includes('GLM') || model?.includes('glm');

  if (useGLM) {
    return {
      baseUrl: process.env.GLM_BASE_URL ?? 'https://mydamoxing.cn/v1',
      apiKey: process.env.GLM_API_KEY ?? '',
      model: process.env.GLM_MODEL ?? 'GLM-5.2-C',
    };
  }

  return {
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://xlapis.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 任务路由策略
// ─────────────────────────────────────────────────────────────────────────────

/** DeepSeek 擅长的任务类型（推理强、速度快） */
const DEEPSEEK_TASKS: Set<TaskType> = new Set([
  'VOLUNTEER_MATCH' as TaskType,
  'MAJOR_RECOMMEND' as TaskType,
  'KNOWLEDGE_QA' as TaskType,
  'STUDY_PLAN' as TaskType,
]);

/** GLM 擅长的任务类型（中文理解好、创意写作） */
const GLM_TASKS: Set<TaskType> = new Set([
  'ESSAY_WRITING' as TaskType,
  'RESUME_POLISH' as TaskType,
  'EMOTION_ANALYSIS' as TaskType,
  'GENERAL_CHAT' as TaskType,
]);

// ─────────────────────────────────────────────────────────────────────────────
// LLMService 实现
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 创建 LLM 服务实例
 * 自动根据任务类型选择模型（DeepSeek 或 GLM）
 */
export function createLLMService(): LLMService {
  return {
    canHandle(taskType: TaskType): boolean {
      // LLM 可以处理所有需要自然语言生成的任务
      return DEEPSEEK_TASKS.has(taskType) || GLM_TASKS.has(taskType) ||
             taskType === ('CAREER_PLAN' as TaskType) ||
             taskType === ('INTERVIEW_PREP' as TaskType);
    },

    async chat(params: {
      messages: ChatMessage[];
      options?: LLMOptions;
    }): Promise<string> {
      const { messages, options = {} } = params;
      const config = getConfig(options.model);

      try {
        return await callLLM(config, messages, options);
      } catch (err) {
        console.error('[LLM] chat error:', err);
        throw err;
      }
    },

    async *chatStream(params: {
      messages: ChatMessage[];
      options?: LLMOptions;
    }): AsyncIterable<AIStreamChunk> {
      const { messages, options = {} } = params;
      const config = getConfig(options.model);

      try {
        yield* streamLLM(config, messages, options);
      } catch (err) {
        console.error('[LLM] stream error:', err);
        yield { delta: '', done: true };
      }
    },

    async chatJSON<T>(params: {
      messages: ChatMessage[];
      schema?: Record<string, unknown>;
      options?: LLMOptions;
    }): Promise<T> {
      const { messages, schema, options = {} } = params;
      const config = getConfig(options.model);

      // 在 system prompt 中加入 JSON 格式要求
      const enhancedMessages: ChatMessage[] = [...messages];
      if (schema) {
        enhancedMessages.unshift({
          role: 'system',
          content: `请严格按照以下 JSON Schema 格式输出，不要添加任何多余文字：\n${JSON.stringify(schema, null, 2)}`,
        });
      }

      try {
        const result = await callLLM(config, enhancedMessages, {
          ...options,
          jsonMode: true,
        });

        // 尝试解析 JSON
        const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned) as T;
      } catch (err) {
        console.error('[LLM] chatJSON error:', err);
        throw err;
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt 构建器 — 为志愿推荐等场景生成高质量 Prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 构建志愿方案解读 Prompt
 */
export function buildVolunteerAnalysisPrompt(params: {
  score: number;
  province: string;
  rushItems: Array<{ universityName: string; majorName: string; probability: number }>;
  stableItems: Array<{ universityName: string; majorName: string; probability: number }>;
  safeItems: Array<{ universityName: string; majorName: string; probability: number }>;
  interests?: string[];
}): ChatMessage[] {
  const { score, province, rushItems, stableItems, safeItems, interests } = params;

  const formatItems = (items: typeof rushItems) =>
    items.map(i => `  - ${i.universityName} ${i.majorName} (概率 ${(i.probability * 100).toFixed(0)}%)`).join('\n');

  return [
    {
      role: 'system',
      content: `你是"知渡"平台的专业高考志愿填报顾问。你需要基于规则引擎生成的推荐方案，为学生提供深入浅出的解读。
解读要点：
1. 总体方案概述（冲稳保比例是否合理）
2. 冲一冲的学校：分析风险和机会，给出建议
3. 稳一稳的学校：分析匹配度
4. 保一保的学校：确认安全性
5. 专业选择建议（结合兴趣和就业）
6. 注意事项和最终建议

语言风格：专业但亲切，用数据说话，给出明确建议。`,
    },
    {
      role: 'user',
      content: `请解读我的志愿推荐方案：

基本信息：
- 省份：${province}
- 分数：${score} 分
${interests?.length ? `- 感兴趣的方向：${interests.join('、')}` : ''}

冲一冲（${rushItems.length} 个）：
${formatItems(rushItems)}

稳一稳（${stableItems.length} 个）：
${formatItems(stableItems)}

保一保（${safeItems.length} 个）：
${formatItems(safeItems)}

请给出完整的方案解读和建议。`,
    },
  ];
}

/**
 * 构建专业对比分析 Prompt
 */
export function buildMajorComparisonPrompt(majors: string[], context?: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是"知渡"平台的专业分析顾问。请从以下维度对比分析给定的专业：
1. 核心课程与学习内容
2. 就业方向与前景
3. 薪资水平（参考数据）
4. 适合人群特征
5. 考研/深造方向
6. 综合推荐指数（1-5星）

每个专业分析 200-300 字，最后给出选择建议。`,
    },
    {
      role: 'user',
      content: `请对比分析以下专业：${majors.join('、')}${context ? `\n\n补充信息：${context}` : ''}`,
    },
  ];
}

/**
 * 构建职业路径分析 Prompt（JSON 结构化输出，配合 chatJSON 使用）
 *
 * 返回的 ChatMessage[] 将由 chatJSON<CareerPathAIResult>() 调用，
 * LLM 必须严格按 JSON Schema 输出，不得包含额外文字。
 */
export function buildCareerPathPrompt(params: {
  major: string;
  mbtiType?: string;
  hollandCode?: string;
}): ChatMessage[] {
  const personalityContext = [
    params.mbtiType ? `MBTI 类型: ${params.mbtiType}` : null,
    params.hollandCode ? `霍兰德代码: ${params.hollandCode}` : null,
  ].filter(Boolean).join('，');

  return [
    {
      role: 'system',
      content: `你是"知渡"平台的资深生涯规划师 AI。你的任务是根据用户的专业方向和个人测评结果，生成 3-5 条结构化职业发展路径。

【输出要求】
你必须且只能输出一个 JSON 对象，格式如下（不要输出任何其他文字）：

{
  "paths": [
    {
      "targetRole": "目标岗位名称（如：算法工程师、产品经理）",
      "targetIndustry": "所属行业（如：人工智能、金融科技、教育科技）",
      "salaryRange": "薪资范围（如：15K-30K/月，入职 3 年后 25K-50K/月）",
      "requiredSkills": ["核心技能1", "核心技能2", "核心技能3", "核心技能4", "核心技能5"],
      "shortTermGoals": [
        { "title": "目标标题", "description": "具体行动描述", "deadline": "建议完成时间（如：大二下学期）" }
      ],
      "midTermGoals": [
        { "title": "目标标题", "description": "具体行动描述", "deadline": "建议完成时间（如：毕业后 2 年）" }
      ],
      "longTermGoals": [
        { "title": "目标标题", "description": "具体行动描述", "deadline": "建议完成时间（如：毕业后 8-10 年）" }
      ],
      "industryTrends": "该方向 2-3 句话的行业趋势分析",
      "matchScore": 85
    }
  ]
}

【生成规则】
1. 每条路径的 targetRole 必须不同，覆盖该专业的主要就业/深造方向
2. matchScore 是 0-100 的整数，表示该路径与用户专业和测评结果的匹配程度
3. requiredSkills 列出 4-6 个核心技能，按重要性排序
4. shortTermGoals = 大学期间（2-3 条），midTermGoals = 毕业后 1-5 年（2-3 条），longTermGoals = 5-10 年+（1-2 条）
5. salaryRange 基于 2024-2025 年中国市场实际数据，区分起步和成长阶段
6. industryTrends 要具体，提及技术趋势、市场需求变化、政策影响等
${personalityContext ? `7. 结合用户的测评结果（${personalityContext}）调整路径推荐和 matchScore` : ''}`,
    },
    {
      role: 'user',
      content: `请为以下学生生成职业发展路径：
- 专业方向：${params.major}${personalityContext ? `\n- 个人测评：${personalityContext}` : ''}

请严格按 JSON 格式输出 3-5 条路径。`,
    },
  ];
}

/** 职业路径 AI 输出的 TypeScript 类型 */
export interface CareerPathAIGoal {
  title: string;
  description: string;
  deadline: string;
}

export interface CareerPathAIItem {
  targetRole: string;
  targetIndustry: string;
  salaryRange: string;
  requiredSkills: string[];
  shortTermGoals: CareerPathAIGoal[];
  midTermGoals: CareerPathAIGoal[];
  longTermGoals: CareerPathAIGoal[];
  industryTrends: string;
  matchScore: number;
}

export interface CareerPathAIResult {
  paths: CareerPathAIItem[];
}

/**
 * 构建技能树生成 Prompt（JSON 结构化输出，配合 chatJSON 使用）
 */
export function buildSkillTreePrompt(params: {
  major: string;
  careerDirection?: string;
}): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是"知渡"平台的技能规划师 AI。你的任务是根据用户的专业方向和职业目标，生成一棵结构化的技能树。

【输出要求】
你必须且只能输出一个 JSON 对象，格式如下：

{
  "treeName": "技能树名称",
  "treeDescription": "一句话描述",
  "category": "TECH 或 SOFT 或 LANGUAGE 或 CERTIFICATE",
  "nodes": [
    {
      "title": "技能名称",
      "description": "技能简述及学习要点",
      "difficulty": 3,
      "estimatedHours": 40,
      "prerequisites": [],
      "resources": [
        { "type": "course", "title": "推荐课程名", "url": "https://..." }
      ],
      "children": [
        {
          "title": "子技能名称",
          "description": "描述",
          "difficulty": 4,
          "estimatedHours": 60,
          "prerequisites": ["父技能名称"],
          "resources": [],
          "children": []
        }
      ]
    }
  ]
}

【生成规则】
1. 技能树应包含 3-5 个主干分支（nodes 顶层元素），每个分支下有 2-4 个子技能
2. difficulty 为 1-5（1=入门，5=精通），子技能应比父技能难度高或持平
3. estimatedHours 为该技能的预估学习时长（小时）
4. prerequisites 列出前置技能名称（字符串数组），根节点为空数组
5. resources 列出 1-2 个学习资源，type 可选: course/book/tutorial/project/practice
6. 技能名称要具体（如"React Hooks"而非"前端框架"），便于后续追踪进度
7. 整棵树应覆盖该方向从入门到就业所需的核心技能`,
    },
    {
      role: 'user',
      content: `请为以下方向生成技能树：
- 专业/方向：${params.major}${params.careerDirection ? `\n- 职业目标：${params.careerDirection}` : ''}

请严格按 JSON 格式输出。`,
    },
  ];
}

/** 技能树 AI 输出的 TypeScript 类型 */
export interface SkillTreeAIResource {
  type: string;
  title: string;
  url?: string;
}

export interface SkillTreeAINode {
  title: string;
  description: string;
  difficulty: number;
  estimatedHours: number;
  prerequisites: string[];
  resources: SkillTreeAIResource[];
  children: SkillTreeAINode[];
}

export interface SkillTreeAIResult {
  treeName: string;
  treeDescription: string;
  category: string;
  nodes: SkillTreeAINode[];
}

/**
 * 构建 AI 周回顾 Prompt（JSON 结构化输出，配合 chatJSON 使用）
 *
 * 分析用户一周内的待办完成情况、番茄钟数据和日程安排，生成时间利用洞察。
 */
export function buildWeeklyReviewPrompt(params: {
  weekStart: string;
  weekEnd: string;
  todos: Array<{ title: string; completed: boolean; category: string; priority: number }>;
  pomodoroCount: number;
  pomodoroMinutes: number;
  events: Array<{ title: string; eventType: string; duration: number }>;
}): ChatMessage[] {
  const completedCount = params.todos.filter(t => t.completed).length;
  const completionRate = params.todos.length > 0
    ? Math.round((completedCount / params.todos.length) * 100)
    : 0;

  const categorySummary: Record<string, { total: number; completed: number }> = {};
  for (const t of params.todos) {
    if (!categorySummary[t.category]) categorySummary[t.category] = { total: 0, completed: 0 };
    categorySummary[t.category].total++;
    if (t.completed) categorySummary[t.category].completed++;
  }

  return [
    {
      role: 'system',
      content: `你是"知渡"平台的时间管理教练 AI。你需要根据用户本周的时间使用数据，生成一份结构化的周回顾报告。

【输出要求】
你必须且只能输出一个 JSON 对象，格式如下：

{
  "overallScore": 75,
  "summary": "一句话总结本周时间利用情况",
  "highlights": ["本周亮点1", "本周亮点2"],
  "improvements": ["改进建议1", "改进建议2", "改进建议3"],
  "categoryAnalysis": [
    { "category": "STUDY", "score": 80, "insight": "学习类任务完成率高，继续保持" }
  ],
  "timeAllocation": {
    "study": 40,
    "work": 20,
    "personal": 15,
    "health": 5,
    "other": 20
  },
  "nextWeekFocus": "下周重点关注方向建议",
  "encouragement": "一句鼓励的话"
}

【生成规则】
1. overallScore 为 0-100 的整数，综合评估时间利用效率
2. highlights 列出 2-3 个本周做得好的方面
3. improvements 列出 2-3 个具体可操作的改进建议
4. categoryAnalysis 按类别分析完成率和表现
5. timeAllocation 为百分比（总和 100），基于实际数据推算
6. 语气积极但有建设性，不空泛夸奖`,
    },
    {
      role: 'user',
      content: `请分析我本周（${params.weekStart} ~ ${params.weekEnd}）的时间使用情况：

待办事项：
- 总计 ${params.todos.length} 项，完成 ${completedCount} 项（完成率 ${completionRate}%）
- 按类别：${Object.entries(categorySummary).map(([cat, v]) => `${cat}: ${v.completed}/${v.total}`).join('，')}

番茄钟：
- 完成 ${params.pomodoroCount} 个番茄钟，共 ${params.pomodoroMinutes} 分钟专注时间

日程事件：
${params.events.map(e => `  - ${e.title} (${e.eventType}, ${e.duration}分钟)`).join('\n') || '  无日程事件'}

请生成周回顾报告。`,
    },
  ];
}

/** 周回顾 AI 输出类型 */
export interface WeeklyReviewCategoryAnalysis {
  category: string;
  score: number;
  insight: string;
}

export interface WeeklyReviewResult {
  overallScore: number;
  summary: string;
  highlights: string[];
  improvements: string[];
  categoryAnalysis: WeeklyReviewCategoryAnalysis[];
  timeAllocation: Record<string, number>;
  nextWeekFocus: string;
  encouragement: string;
}

/**
 * 构建 AI 成长洞察 Prompt（JSON 结构化输出，配合 chatJSON 使用）
 *
 * 分析用户一段时间内的日记情绪趋势、高频标签，生成成长洞察。
 */
export function buildGrowthInsightsPrompt(params: {
  period: string;
  entries: Array<{
    date: string;
    mood: number;
    moodTags: string[];
    title: string;
    contentPreview: string;
  }>;
}): ChatMessage[] {
  const avgMood = params.entries.length > 0
    ? Math.round(params.entries.reduce((sum, e) => sum + e.mood, 0) / params.entries.length * 10) / 10
    : 0;

  const tagCounts: Record<string, number> = {};
  for (const e of params.entries) {
    for (const tag of e.moodTags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return [
    {
      role: 'system',
      content: `你是"知渡"平台的成长洞察分析师 AI。你需要根据用户一段时间内的日记记录，生成结构化的成长洞察报告。

【输出要求】
你必须且只能输出一个 JSON 对象，格式如下：

{
  "overallMood": 7.2,
  "moodTrend": "稳定向好 或 波动较大 或 持续低迷 或 起伏明显",
  "moodInsight": "对情绪趋势的分析和建议（2-3句话）",
  "topEmotions": [
    { "tag": "平静", "count": 15, "interpretation": "平静出现频率最高，说明整体心态较好" }
  ],
  "growthAreas": [
    { "area": "学业压力管理", "observation": "观察到的现象", "suggestion": "具体建议" }
  ],
  "journalingHabits": {
    "frequency": "高/中/低",
    "consistency": "好/一般/需要改善",
    "depth": "深入/适中/偏表面"
  },
  "monthlyHighlight": "本月最值得关注的成长事件或转变",
  "affirmation": "对用户的一段真诚肯定和鼓励（3-4句话）"
}

【生成规则】
1. overallMood 为 1-10 的浮点数，表示期间平均情绪水平
2. topEmotions 列出前 3-5 个高频情绪标签及其解读
3. growthAreas 识别 2-3 个可改善的成长维度
4. journalingHabits 基于记录频率和内容深度评估
5. affirmation 要真诚、具体，不空泛`,
    },
    {
      role: 'user',
      content: `请分析我${params.period}的成长日记：

共 ${params.entries.length} 篇日记，平均心情评分 ${avgMood}/10
高频情绪标签：${topTags.map(([tag, count]) => `${tag}(${count}次)`).join('、') || '无'}

最近日记摘要：
${params.entries.slice(0, 10).map(e =>
  `- ${e.date} | 心情: ${e.mood}/10 | ${e.moodTags.join(',')} | ${e.title || '无标题'} | ${e.contentPreview}`
).join('\n')}

请生成成长洞察报告。`,
    },
  ];
}

/** 成长洞察 AI 输出类型 */
export interface GrowthInsightEmotion {
  tag: string;
  count: number;
  interpretation: string;
}

export interface GrowthInsightArea {
  area: string;
  observation: string;
  suggestion: string;
}

export interface GrowthInsightHabits {
  frequency: string;
  consistency: string;
  depth: string;
}

export interface GrowthInsightResult {
  overallMood: number;
  moodTrend: string;
  moodInsight: string;
  topEmotions: GrowthInsightEmotion[];
  growthAreas: GrowthInsightArea[];
  journalingHabits: GrowthInsightHabits;
  monthlyHighlight: string;
  affirmation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────────────────────────────────────

export type { ChatMessage, LLMConfig };
