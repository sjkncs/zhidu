// @zhidu/ai — AI 服务层骨架（规则引擎 + RAG + LLM 混合架构）

import type { ApiResponse, UserProfile, ApplicationPlan, PlanItem } from '@zhidu/shared';

// ─────────────────────────────────────────────────────────────────────────────
// 任务类型枚举
// ─────────────────────────────────────────────────────────────────────────────

/** AI 平台支持的任务类型 */
export enum TaskType {
  /** 志愿匹配（冲稳保推荐） */
  VOLUNTEER_MATCH = 'VOLUNTEER_MATCH',
  /** 生涯规划（路径生成） */
  CAREER_PLAN = 'CAREER_PLAN',
  /** 知识问答（招生政策、专业介绍等） */
  KNOWLEDGE_QA = 'KNOWLEDGE_QA',
  /** 简历润色 */
  RESUME_POLISH = 'RESUME_POLISH',
  /** 面试准备（模拟面试、常见问题） */
  INTERVIEW_PREP = 'INTERVIEW_PREP',
  /** 情感分析（日记/情绪识别） */
  EMOTION_ANALYSIS = 'EMOTION_ANALYSIS',
  /** 学习计划生成 */
  STUDY_PLAN = 'STUDY_PLAN',
  /** 专业推荐（基于测评结果） */
  MAJOR_RECOMMEND = 'MAJOR_RECOMMEND',
  /** 文书生成（自荐信、个人陈述） */
  ESSAY_WRITING = 'ESSAY_WRITING',
  /** 通用对话 */
  GENERAL_CHAT = 'GENERAL_CHAT',
}

/** 路由策略（决定使用哪类服务处理请求） */
export type RouteStrategy = 'rule' | 'rag' | 'llm' | 'hybrid';

// ─────────────────────────────────────────────────────────────────────────────
// 请求/响应类型
// ─────────────────────────────────────────────────────────────────────────────

/** AI 服务请求 */
export interface AIRequest {
  /** 用户原始查询 */
  query: string;
  /** 用户画像（用于个性化） */
  profile?: UserProfile;
  /** 会话上下文（历史消息） */
  context?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** 强制指定任务类型（跳过自动识别） */
  taskType?: TaskType;
  /** 附加参数 */
  params?: Record<string, unknown>;
}

/** AI 服务响应 */
export interface AIResponse {
  /** 任务类型 */
  taskType: TaskType;
  /** 使用的路由策略 */
  strategy: RouteStrategy;
  /** 主要回复内容 */
  content: string;
  /** 结构化数据（志愿推荐列表、计划 JSON 等） */
  data?: unknown;
  /** 置信度 0-1 */
  confidence: number;
  /** 引用来源（RAG 检索结果） */
  sources?: Array<{ title: string; url?: string; snippet: string }>;
}

/** 流式响应块 */
export interface AIStreamChunk {
  /** 内容片段 */
  delta: string;
  /** 是否为最后一块 */
  done: boolean;
  /** 完整响应（仅在 done=true 时有值） */
  final?: AIResponse;
}

// ─────────────────────────────────────────────────────────────────────────────
// 规则引擎接口（确定性匹配：分数线、位次计算等）
// ─────────────────────────────────────────────────────────────────────────────

/** 规则引擎 — 处理可确定性推理的任务 */
export interface RuleEngine {
  /**
   * 判断是否能处理该任务类型
   */
  canHandle(taskType: TaskType): boolean;

  /**
   * 分数线匹配：给定分数和省份，返回历年可填报院校
   */
  matchByScore(params: {
    score: number;
    province: string;
    subjectCombination?: string[];
    limit?: number;
  }): Promise<PlanItem[]>;

  /**
   * 位次换算：将今年位次映射到历年等效分
   */
  rankToScore(params: {
    rank: number;
    province: string;
    year: number;
  }): Promise<{ equivalentScore: number; confidence: number }>;

  /**
   * 冲稳保分类：对一组志愿条目进行风险分级
   */
  classifyRisk(params: {
    items: Array<{ universityId: string; majorId: string; historicalAvgScore: number }>;
    userScore: number;
  }): Promise<Array<{ universityId: string; majorId: string; riskLevel: 'RUSH' | 'STABLE' | 'SAFE' }>>;

  /**
   * 通用规则执行
   */
  execute(taskType: TaskType, params: Record<string, unknown>): Promise<unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// RAG 服务接口（检索增强生成）
// ─────────────────────────────────────────────────────────────────────────────

/** RAG 检索结果条目 */
export interface RetrievalResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  /** 相似度得分 0-1 */
  score: number;
}

/** RAG 服务 — 知识库检索增强 */
export interface RAGService {
  /**
   * 判断该任务类型是否适合使用 RAG
   */
  canHandle(taskType: TaskType): boolean;

  /**
   * 检索相关文档片段
   */
  retrieve(params: {
    query: string;
    /** 知识库范围（如：'policy', 'major_intro', 'career_info'） */
    collections?: string[];
    topK?: number;
  }): Promise<RetrievalResult[]>;

  /**
   * 检索 + 生成：检索后结合上下文生成回复
   */
  retrieveAndGenerate(params: {
    query: string;
    collections?: string[];
    context?: string;
  }): Promise<{ content: string; sources: RetrievalResult[] }>;

  /**
   * 索引新文档（用于知识库更新）
   */
  index(params: {
    collection: string;
    documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>;
  }): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM 服务接口（大模型调用，支持流式）
// ─────────────────────────────────────────────────────────────────────────────

/** LLM 调用选项 */
export interface LLMOptions {
  /** 系统提示词 */
  systemPrompt?: string;
  /** 温度（默认 0.7） */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 使用的模型（如 'gpt-4', 'deepseek-chat'） */
  model?: string;
  /** 强制 JSON 输出 */
  jsonMode?: boolean;
}

/** LLM 服务 — 大模型推理调用 */
export interface LLMService {
  /**
   * 判断该任务类型是否需要 LLM
   */
  canHandle(taskType: TaskType): boolean;

  /**
   * 同步调用（完整回复）
   */
  chat(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    options?: LLMOptions;
  }): Promise<string>;

  /**
   * 流式调用（返回异步迭代器）
   */
  chatStream(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    options?: LLMOptions;
  }): AsyncIterable<AIStreamChunk>;

  /**
   * 结构化输出（JSON 格式）
   */
  chatJSON<T>(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    /** JSON Schema 描述 */
    schema?: Record<string, unknown>;
    options?: LLMOptions;
  }): Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// IntentRouter — 意图识别 & 路由
// ─────────────────────────────────────────────────────────────────────────────

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
  constructor(
    private readonly ruleEngine: RuleEngine,
    private readonly ragService: RAGService,
    private readonly llmService: LLMService,
  ) {}

  /**
   * 识别用户意图
   * @throws 当前为骨架实现，抛出 "not implemented"
   */
  async identifyIntent(query: string, context?: string): Promise<IntentResult> {
    // TODO: 实现基于关键词 + 小模型的意图识别
    throw new Error('not implemented');
  }

  /**
   * 路由并执行请求
   */
  async route(request: AIRequest): Promise<AIResponse> {
    // 1. 识别意图
    const intent = request.taskType
      ? { taskType: request.taskType, strategy: 'hybrid' as RouteStrategy, confidence: 1.0 }
      : await this.identifyIntent(request.query);

    // 2. 根据策略分发
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
        throw new Error(`Unknown strategy: ${intent.strategy}`);
    }
  }

  private async handleByRule(taskType: TaskType, request: AIRequest): Promise<AIResponse> {
    throw new Error('not implemented');
  }

  private async handleByRAG(taskType: TaskType, request: AIRequest): Promise<AIResponse> {
    throw new Error('not implemented');
  }

  private async handleByLLM(taskType: TaskType, request: AIRequest): Promise<AIResponse> {
    throw new Error('not implemented');
  }

  /**
   * 混合处理：先规则筛选 → 再 RAG 检索 → 最后 LLM 润色生成
   */
  private async handleHybrid(taskType: TaskType, request: AIRequest): Promise<AIResponse> {
    throw new Error('not implemented');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 便捷函数：混合路由器
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 创建混合路由实例的工厂函数
 * @param config - 各服务的配置（骨架阶段接受空对象）
 */
export function createHybridRouter(config?: {
  ruleEngine?: RuleEngine;
  ragService?: RAGService;
  llmService?: LLMService;
}): IntentRouter {
  // 骨架阶段：使用占位实现
  const noopRule: RuleEngine = {
    canHandle: () => false,
    matchByScore: async () => { throw new Error('not implemented'); },
    rankToScore: async () => { throw new Error('not implemented'); },
    classifyRisk: async () => { throw new Error('not implemented'); },
    execute: async () => { throw new Error('not implemented'); },
  };

  const noopRag: RAGService = {
    canHandle: () => false,
    retrieve: async () => { throw new Error('not implemented'); },
    retrieveAndGenerate: async () => { throw new Error('not implemented'); },
    index: async () => { throw new Error('not implemented'); },
  };

  const noopLlm: LLMService = {
    canHandle: () => false,
    chat: async () => { throw new Error('not implemented'); },
    chatStream: async function* () { throw new Error('not implemented'); },
    chatJSON: async () => { throw new Error('not implemented'); },
  };

  return new IntentRouter(
    config?.ruleEngine ?? noopRule,
    config?.ragService ?? noopRag,
    config?.llmService ?? noopLlm,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt 模板常量（供各服务使用）
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPT_TEMPLATES = {
  VOLUNTEER_SYSTEM: `你是一位专业的高考志愿填报顾问。根据用户的分数、省份、选科和个人偏好，提供科学的志愿方案建议。
请遵循"冲稳保"原则，并说明推荐理由。`,

  CAREER_SYSTEM: `你是一位生涯规划师。根据用户的测评结果、兴趣和能力，帮助其制定职业发展路径。
建议应具体、可操作，并包含短期和长期目标。`,

  RESUME_SYSTEM: `你是一位资深 HR 和简历优化专家。对用户提供的简历内容进行润色，
使其更专业、更有竞争力，同时保持真实性。`,

  INTERVIEW_SYSTEM: `你是一位面试教练。通过模拟面试场景，帮助用户练习面试技巧。
提供针对性的问题和专业反馈。`,

  KNOWLEDGE_SYSTEM: `你是一位教育领域知识助手。基于检索到的可靠信息回答用户关于招生政策、
专业介绍、院校信息等问题。必须引用来源，不编造事实。`,
} as const;

// Re-export rule engine
export { createRuleEngine } from './rule-engine';
export type { ScoreStats, CandidateItem, AdmissionRecord } from './rule-engine';

// Re-export LLM service
export {
  createLLMService,
  buildVolunteerAnalysisPrompt,
  buildMajorComparisonPrompt,
  buildCareerPathPrompt,
} from './llm-service';
export type { ChatMessage, LLMConfig } from './llm-service';
