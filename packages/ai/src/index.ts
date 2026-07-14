// @zhidu/ai — AI 服务层入口（规则引擎 + RAG + LLM 混合架构）
// 本文件为 barrel 导出文件，核心逻辑已拆分到各子模块

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
  /** Function Calling: 流式工具调用片段（增量拼接） */
  toolCallDelta?: ToolCallDelta;
}

// ─────────────────────────────────────────────────────────────────────────────
// 规则引擎接口（确定性匹配：分数线、位次计算等）
// ─────────────────────────────────────────────────────────────────────────────

/** 规则引擎 — 处理可确定性推理的任务 */
export interface RuleEngine {
  canHandle(taskType: TaskType): boolean;
  matchByScore(params: {
    score: number;
    province: string;
    subjectCombination?: string[];
    limit?: number;
  }): Promise<PlanItem[]>;
  rankToScore(params: {
    rank: number;
    province: string;
    year: number;
  }): Promise<{ equivalentScore: number; confidence: number }>;
  classifyRisk(params: {
    items: Array<{ universityId: string; majorId: string; historicalAvgScore: number }>;
    userScore: number;
  }): Promise<Array<{ universityId: string; majorId: string; riskLevel: 'RUSH' | 'STABLE' | 'SAFE' }>>;
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
  score: number;
}

/** RAG 服务 — 知识库检索增强 */
export interface RAGService {
  canHandle(taskType: TaskType): boolean;
  retrieve(params: {
    query: string;
    collections?: string[];
    topK?: number;
  }): Promise<RetrievalResult[]>;
  retrieveAndGenerate(params: {
    query: string;
    collections?: string[];
    context?: string;
  }): Promise<{ content: string; sources: RetrievalResult[] }>;
  index(params: {
    collection: string;
    documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>;
  }): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM 服务接口（大模型调用，支持流式）
// ─────────────────────────────────────────────────────────────────────────────

/** 工具定义（OpenAI Function Calling 格式） */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** 流式工具调用片段 */
export interface ToolCallDelta {
  id: string;
  name: string;
  arguments: string;
}

/** LLM 调用选项 */
export interface LLMOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  jsonMode?: boolean;
  /** Function Calling 工具列表 */
  tools?: ToolDefinition[];
}

/** LLM 服务 — 大模型推理调用 */
export interface LLMService {
  canHandle(taskType: TaskType): boolean;
  chat(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    options?: LLMOptions;
  }): Promise<string>;
  chatStream(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    options?: LLMOptions;
  }): AsyncIterable<AIStreamChunk>;
  chatJSON<T>(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    schema?: Record<string, unknown>;
    options?: LLMOptions;
  }): Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports from sub-modules
// ─────────────────────────────────────────────────────────────────────────────

// Intent router
export { IntentRouter, createHybridRouter } from './intent-router';
export type { IntentResult } from './intent-router';

// Prompt templates
export { PROMPT_TEMPLATES } from './prompts';

// Rule engine
export { createRuleEngine } from './rule-engine';
export type { ScoreStats, CandidateItem, AdmissionRecord } from './rule-engine';

// LLM service
export {
  createLLMService,
  buildVolunteerAnalysisPrompt,
  buildMajorComparisonPrompt,
  buildCareerPathPrompt,
  buildSkillTreePrompt,
  buildWeeklyReviewPrompt,
  buildGrowthInsightsPrompt,
} from './llm-service';
export type {
  ChatMessage,
  LLMConfig,
  CareerPathAIResult,
  CareerPathAIItem,
  CareerPathAIGoal,
  SkillTreeAIResult,
  SkillTreeAINode,
  SkillTreeAIResource,
  WeeklyReviewResult,
  WeeklyReviewCategoryAnalysis,
  GrowthInsightResult,
  GrowthInsightEmotion,
  GrowthInsightArea,
  GrowthInsightHabits,
} from './llm-service';

// Chunker
export { chunkText, chunkDocuments } from './chunker';
export type { ChunkOptions, TextChunk, DocumentToChunk, ChunkedDocument } from './chunker';

// Embedding service
export {
  createEmbeddingService,
  createNoopEmbeddingService,
  createHttpEmbeddingService,
} from './embedding-service';
export type { EmbeddingService, HttpEmbeddingConfig } from './embedding-service';

// RAG service
export { createRAGService, buildRAGPrompt } from './rag-service';
export type { RAGServiceConfig, SearchResultRow } from './rag-service';

// Knowledge seed
export { seedKnowledge, SEED_KNOWLEDGE } from './knowledge-seed';

// Volunteer matching engine
export { VolunteerMatchingEngine } from './volunteer-engine';
export type { VolunteerQuery, MatchResult, VolunteerRecommendation } from './volunteer-engine';

// Intent classifier
export { IntentClassifier, extractEntities } from './intent-classifier';
export type { IntentClassification } from './intent-classifier';

// Intent clarifier (P1: 结构化选择引导)
export { IntentClarifier, createIntentClarifier } from './intent-clarifier';
export type { ClarificationResult, ChoiceOption } from './intent-clarifier';

// Structured query agent
export { StructuredQueryAgent } from './structured-query-agent';
export type {
  StructuredQuery,
  StructuredQueryType,
  StructuredQueryResult,
  QueryExecutor,
} from './structured-query-agent';

// Supabase query executor
export { SupabaseQueryExecutor } from './supabase-query-executor';

// ML predict client
export {
  predictAdmission,
  predictBatch,
  isMLServiceAvailable,
} from './ml-predict-client';
export type { MLPredictInput, MLPredictResult } from './ml-predict-client';

// User context gatherer
export { gatherUserContext } from './user-context-gatherer';

// Web search (P5: 外部知识增强)
export { searchWeb, executeWebSearch, WEB_SEARCH_TOOL } from './web-search';
export type { WebSearchResult, WebSearchParams } from './web-search';

// arXiv 论文追踪（学术雷达模块）
export { fetchArxivPapers, upsertPapers, DEFAULT_CATEGORIES } from './arxiv-service';
export type { ArxivPaper, ArxivSearchParams } from './arxiv-service';

// Agent framework
export { ToolRegistry, createDefaultRegistry, Planner, Executor } from './agent';
export type { AgentTask, AgentStep, AgentPlan, ToolHandler, ToolDefinition } from './agent';

// Agent tools (P3: run_tasks Function Calling)
export { RUN_TASKS_TOOL, executeRunTasks, AVAILABLE_AGENT_TOOLS, VOLUNTEER_RECOMMEND_TOOL, executeVolunteerRecommend, INVESTMENT_ANALYZE_TOOL, executeInvestmentAnalyze } from './agent-tools';
export type { TaskUpdateEvent } from './agent-tools';

// PA_Agent pattern: 确定性决策节点引擎
export { DecisionNodeEngine } from './decision-nodes';
export type { DecisionNode, DecisionTrace, NodeOverride, GateCheck, GateResult, NodeAuthority } from './decision-nodes';

// PA_Agent pattern: 连续性守卫
export { ContinuityGuard } from './continuity-guard';
export type { PreviousPlan, ContinuityCheckResult, Contradiction } from './continuity-guard';

// PA_Agent pattern: 结构化决策树 Prompt
export {
  buildDecisionTreeSystemPrompt,
  buildVolunteerUserPrompt,
  buildNoRecommendationResponse,
} from './decision-tree-prompt';

// PA_Agent pattern: 推荐结果验证器
export { RecommendationValidator, createDefaultBudget, canRetry } from './recommendation-validator';
export type { ValidationError, ValidationResult, ValidationErrorCategory, RetryBudget } from './recommendation-validator';

// PortfolioAgent: 独立资管智能体（3阶段流水线）
export { PortfolioAgent } from './portfolio-agent';
export type {
  AnalysisMode, PortfolioAnalysisRequest, PortfolioAgentResult,
  PositionData, PositionSignal, PortfolioAssessment, AgentRecommendation,
} from './portfolio-agent';

// Factor Library: 因子库 + 投资行为学知识库（PA_Agent + 栀染移植）
export {
  MARKET_FEATURES, MATH_OPERATORS, RL_REWARD_PARAMS,
  VOTING_SIGNALS, synthesizeDirection,
  riskParityOptimize, maxSharpeOptimize, blackLittermanPosterior, hierarchicalRiskParity,
  calculateMarketImpact, estimateAUMCapacity, DEFAULT_IMPACT_PARAMS,
  BEHAVIORAL_BIASES, detectBehavioralBiases,
  STRATEGY_TEMPLATES,
  robustNormalize, shrinkCovariance,
} from './factor-library';
export type {
  PriceBar, VotingSignal,
  OptimizerResult, MarketImpactParams,
  BehavioralBias, TradingContext, StrategyTemplate,
  FactorMarketFeature, FactorMathOperator,
} from './factor-library';

// Investment Analysis Engine: 资管模块 — 投资组合分析 / 多信号投票 / 因子挖掘 / DeFi 收益
export { InvestmentAnalysisEngine, createInvestmentEngine } from './investment-engine';
export type {
  AssetQuery,
  StockScreenCriteria,
  InvestmentSignal,
  InvestmentGateCheck,
  InvestmentDecisionNode,
  InvestmentDecisionTrace,
  InvestmentNodeAuthority,
  PositionAnalysis,
  PortfolioRecommendation,
  PortfolioAnalysis,
  Factor,
  MathOperator,
  MarketFeature,
  DeFiPoolData,
  DeFiYieldAnalysis,
  OHLCV,
  MarketDataProvider,
  PreviousRecommendation,
  InvestmentContinuityResult,
  InvestmentContradiction,
} from './investment-engine';
