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
      content: `你是"智渡"平台的专业高考志愿填报顾问。你需要基于规则引擎生成的推荐方案，为学生提供深入浅出的解读。
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
      content: `你是"智渡"平台的专业分析顾问。请从以下维度对比分析给定的专业：
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
 * 构建职业路径分析 Prompt
 */
export function buildCareerPathPrompt(params: {
  major: string;
  mbtiType?: string;
  hollandCode?: string;
}): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是"智渡"平台的生涯规划师。基于专业方向和个人测评结果，生成详细的职业发展路径：
1. 核心职业方向（3-5 个）
2. 每个方向的典型岗位和薪资范围
3. 短期目标（大学期间）
4. 中期目标（毕业 3-5 年）
5. 长期目标（10 年+）
6. 需要补充的技能和证书
7. 行业趋势分析`,
    },
    {
      role: 'user',
      content: `请为我规划职业路径：
- 专业方向：${params.major}
${params.mbtiType ? `- MBTI 类型：${params.mbtiType}` : ''}
${params.hollandCode ? `- 霍兰德代码：${params.hollandCode}` : ''}`,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────────────────────────────────────

export type { ChatMessage, LLMConfig };
