/**
 * @zhidu/ai — IntentRouter
 * 根据用户查询识别意图并路由到对应服务（规则引擎 / RAG / LLM）
 *
 * 意图识别策略：
 * - 关键词匹配 → 快速路由（置信度 ≥ 0.7 时直接使用）
 * - LLM 意图分类 → 精准路由（置信度 < 0.7 时回退到 LLM 分类器）
 */

import type {
  AIRequest,
  AIResponse,
  RouteStrategy,
  RuleEngine,
  RAGService,
  LLMService,
} from './index';
import { TaskType } from './index';
import { PROMPT_TEMPLATES } from './prompts';
import type { IntentClassifier } from './intent-classifier';

/** 意图识别结果 */
export interface IntentResult {
  taskType: TaskType;
  /** 推荐路由策略 */
  strategy: RouteStrategy;
  /** 意图置信度 */
  confidence: number;
  /** 提取的实体/参数 */
  entities?: Record<string, unknown>;
}

/**
 * IntentRouter — 根据用户查询识别意图并路由到对应服务
 */
export class IntentRouter {
  private classifier?: IntentClassifier;

  constructor(
    private readonly ruleEngine: RuleEngine,
    private readonly ragService: RAGService,
    private readonly llmService: LLMService,
  ) {}

  /** 注入 LLM 意图分类器 */
  setClassifier(classifier: IntentClassifier): void {
    this.classifier = classifier;
  }

  /**
   * 识别用户意图
   * 关键词快速匹配 + LLM 兜底分类
   */
  async identifyIntent(
    query: string,
    context?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<IntentResult> {
    // 第一层：关键词快速匹配
    const keywordResult = this.keywordMatch(query);

    // 置信度足够，直接使用关键词结果
    if (keywordResult.confidence >= 0.7) {
      return keywordResult;
    }

    // 第二层：LLM 意图分类（当有分类器且关键词置信度低时）
    if (this.classifier) {
      try {
        const llmResult = await this.classifier.classify(query, context);
        if (llmResult.confidence > keywordResult.confidence) {
          return llmResult;
        }
      } catch {
        // LLM 分类失败，使用关键词结果
      }
    }

    return keywordResult;
  }

  /**
   * 关键词匹配（同步方法）
   */
  private keywordMatch(query: string): IntentResult {
    const q = (query).toLowerCase();

    // 1. 志愿匹配（分数线、位次、志愿推荐）
    const volunteerKeywords = ['分数线', '录取', '志愿', '位次', '投档', '冲稳保',
      '冲一冲', '稳一稳', '保一保', '平行志愿', '多少分', '能上', '报哪'];
    if (volunteerKeywords.some(k => q.includes(k))) {
      const scoreMatch = query.match(/(\d{3})\s*分/);
      const provincePatterns = ['北京', '天津', '上海', '重庆', '广东', '浙江', '江苏',
        '山东', '河南', '四川', '湖北', '湖南', '河北', '安徽', '福建', '陕西',
        '辽宁', '吉林', '黑龙江', '山西', '江西', '广西', '云南', '贵州', '甘肃'];
      const province = provincePatterns.find(p => q.includes(p));

      return {
        taskType: TaskType.VOLUNTEER_MATCH,
        strategy: 'hybrid',
        confidence: 0.9,
        entities: {
          score: scoreMatch ? parseInt(scoreMatch[1]) : undefined,
          province,
        },
      };
    }

    // 2. 知识问答（政策、专业介绍、院校信息）
    const knowledgeKeywords = ['政策', '招生', '专业介绍', '学什么', '什么专业',
      '专业怎么样', '好不好', '就业前景', '课程', '培养', '方向',
      '985', '211', '双一流', '一本', '二本'];
    if (knowledgeKeywords.some(k => q.includes(k))) {
      return {
        taskType: TaskType.KNOWLEDGE_QA,
        strategy: 'rag',
        confidence: 0.85,
      };
    }

    // 3. 生涯规划（职业、就业、考研、实习）
    const careerKeywords = ['职业', '就业', '工作', '考研', '深造', '实习',
      '简历', '面试', '规划', '发展方向', '出路', '薪资', '工资'];
    if (careerKeywords.some(k => q.includes(k))) {
      return {
        taskType: TaskType.CAREER_PLAN,
        strategy: 'hybrid',
        confidence: 0.8,
      };
    }

    // 4. 情感/日记
    const emotionKeywords = ['心情', '情绪', '压力', '焦虑', '不开心', '难过',
      '烦恼', '吐槽', '日记'];
    if (emotionKeywords.some(k => q.includes(k))) {
      return {
        taskType: TaskType.EMOTION_ANALYSIS,
        strategy: 'llm',
        confidence: 0.75,
      };
    }

    // 5. 学习计划
    const studyKeywords = ['学习计划', '复习', '备考', '提分', '怎么学', '安排'];
    if (studyKeywords.some(k => q.includes(k))) {
      return {
        taskType: TaskType.STUDY_PLAN,
        strategy: 'rag',
        confidence: 0.8,
      };
    }

    // 6. 默认：通用对话（低置信度，可被 LLM 分类器覆盖）
    return {
      taskType: TaskType.GENERAL_CHAT,
      strategy: 'llm',
      confidence: 0.6,
    };
  }

  /**
   * 路由并执行请求
   */
  async route(request: AIRequest): Promise<AIResponse> {
    const intent = request.taskType
      ? { taskType: request.taskType, strategy: 'hybrid' as RouteStrategy, confidence: 1.0 }
      : await this.identifyIntent(request.query, request.context);

    switch (intent.strategy) {
      case 'rule':
        return this.handleByRule(intent.taskType, request);
      case 'rag':
        return this.handleByRAG(intent.taskType, request);
      case 'llm':
        return this.handleByLLM(intent.taskType, request);
      case 'hybrid':
        return this.handleHybrid(intent.taskType, request);
      default:
        return this.handleByLLM(intent.taskType, request);
    }
  }

  private async handleByRule(taskType: TaskType, request: AIRequest): Promise<AIResponse> {
    if (!this.ruleEngine.canHandle(taskType)) {
      return this.handleByLLM(taskType, request);
    }
    const result = await this.ruleEngine.execute(taskType, request.params ?? {});
    return { taskType, strategy: 'rule', content: '', data: result, confidence: 1.0 };
  }

  private async handleByRAG(taskType: TaskType, request: AIRequest): Promise<AIResponse> {
    if (!this.ragService.canHandle(taskType)) {
      return this.handleByLLM(taskType, request);
    }
    const collections = this.getCollectionsForTask(taskType);
    const { content, sources } = await this.ragService.retrieveAndGenerate({
      query: request.query,
      collections,
      context: request.context?.map(c => `${c.role}: ${c.content}`).join('\n'),
    });
    return {
      taskType, strategy: 'rag', content, confidence: 0.85,
      sources: sources.map(s => ({
        title: (s.metadata as Record<string, unknown>)?.title as string ?? '',
        url: (s.metadata as Record<string, unknown>)?.sourceUrl as string | undefined,
        snippet: s.content.slice(0, 200),
      })),
    };
  }

  private async handleByLLM(taskType: TaskType, request: AIRequest): Promise<AIResponse> {
    const systemPrompt = PROMPT_TEMPLATES[
      this.getTemplateKey(taskType) as keyof typeof PROMPT_TEMPLATES
    ] ?? PROMPT_TEMPLATES.KNOWLEDGE_SYSTEM;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    if (request.context) {
      for (const msg of request.context) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: 'user', content: request.query });

    const content = await this.llmService.chat({
      messages,
      options: { temperature: 0.7, maxTokens: 2048 },
    });
    return { taskType, strategy: 'llm', content, confidence: 0.75 };
  }

  /**
   * 混合处理：先规则筛选 → 再 RAG 检索 → 最后 LLM 润色生成
   */
  private async handleHybrid(taskType: TaskType, request: AIRequest): Promise<AIResponse> {
    // 志愿推荐：规则引擎 + RAG + LLM
    if (taskType === TaskType.VOLUNTEER_MATCH && this.ruleEngine.canHandle(taskType)) {
      const score = (request.params?.score as number) ?? 0;
      const province = (request.params?.province as string) ?? '';

      if (score > 0 && province) {
        const candidates = await this.ruleEngine.matchByScore({ score, province });

        let ragContext = '';
        if (this.ragService.canHandle(taskType)) {
          const chunks = await this.ragService.retrieve({
            query: `${province} ${score}分 志愿填报 冲稳保`,
            collections: ['volunteer', 'policy'],
            topK: 3,
          });
          ragContext = chunks.map(c => c.content).join('\n\n');
        }

        const summary = candidates.slice(0, 20).map(c =>
          `${c.remark} | 概率: ${((c.estimatedProbability ?? 0) * 100).toFixed(0)}% | ${c.riskLevel}`
        ).join('\n');

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: PROMPT_TEMPLATES.VOLUNTEER_SYSTEM },
          {
            role: 'user',
            content: `分数: ${score}分, 省份: ${province}\n\n候选志愿方案：\n${summary}\n\n${ragContext ? `参考资料：\n${ragContext}` : ''}\n\n请给出方案解读和建议。`,
          },
        ];

        const content = await this.llmService.chat({ messages, options: { temperature: 0.6, maxTokens: 2048 } });
        return { taskType, strategy: 'hybrid', content, data: candidates, confidence: 0.9 };
      }
    }

    if (this.ragService.canHandle(taskType)) {
      return this.handleByRAG(taskType, request);
    }
    return this.handleByLLM(taskType, request);
  }

  // ─── 辅助方法 ───

  private getCollectionsForTask(taskType: TaskType): string[] {
    const mapping: Partial<Record<TaskType, string[]>> = {
      [TaskType.KNOWLEDGE_QA]: ['policy', 'major_intro', 'general'],
      [TaskType.CAREER_PLAN]: ['career', 'major_intro'],
      [TaskType.MAJOR_RECOMMEND]: ['major_intro', 'career'],
      [TaskType.STUDY_PLAN]: ['general', 'policy'],
      [TaskType.VOLUNTEER_MATCH]: ['volunteer', 'policy'],
      [TaskType.GENERAL_CHAT]: ['policy', 'major_intro', 'career', 'volunteer', 'general'],
    };
    return mapping[taskType] ?? ['general'];
  }

  private getTemplateKey(taskType: TaskType): string {
    const mapping: Partial<Record<TaskType, string>> = {
      [TaskType.VOLUNTEER_MATCH]: 'VOLUNTEER_SYSTEM',
      [TaskType.CAREER_PLAN]: 'CAREER_SYSTEM',
      [TaskType.RESUME_POLISH]: 'RESUME_SYSTEM',
      [TaskType.INTERVIEW_PREP]: 'INTERVIEW_SYSTEM',
      [TaskType.KNOWLEDGE_QA]: 'KNOWLEDGE_SYSTEM',
    };
    return mapping[taskType] ?? 'KNOWLEDGE_SYSTEM';
  }
}

/**
 * 创建混合路由器实例的工厂函数
 */
export function createHybridRouter(config?: {
  ruleEngine?: RuleEngine;
  ragService?: RAGService;
  llmService?: LLMService;
  enableClassifier?: boolean;
}): IntentRouter {
  const noopRule: RuleEngine = {
    canHandle: () => false,
    matchByScore: async () => [],
    rankToScore: async () => ({ equivalentScore: 0, confidence: 0 }),
    classifyRisk: async () => [],
    execute: async () => null,
  };

  const noopRag: RAGService = {
    canHandle: () => false,
    retrieve: async () => [],
    retrieveAndGenerate: async () => ({ content: '', sources: [] }),
    index: async () => {},
  };

  const noopLlm: LLMService = {
    canHandle: () => false,
    chat: async () => '',
    chatStream: async function* () { yield { delta: '', done: true }; },
    chatJSON: async () => ({}) as any,
  };

  const llm = config?.llmService ?? noopLlm;
  const router = new IntentRouter(
    config?.ruleEngine ?? noopRule,
    config?.ragService ?? noopRag,
    llm,
  );

  // 启用 LLM 意图分类器
  if (config?.enableClassifier) {
    const { IntentClassifier } = require('./intent-classifier');
    router.setClassifier(new IntentClassifier(llm));
  }

  return router;
}
