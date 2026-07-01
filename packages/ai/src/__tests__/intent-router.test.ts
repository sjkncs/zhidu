import { describe, it, expect, vi } from 'vitest';
import { IntentRouter, TaskType } from '../index';
import type { RuleEngine, RAGService, LLMService } from '../index';

// Mock services (noop implementations)
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

function createRouter(): IntentRouter {
  return new IntentRouter(noopRule, noopRag, noopLlm);
}

describe('IntentRouter — keyword matching', () => {
  const router = createRouter();

  // Volunteer matching
  it('detects volunteer match intent from score query', async () => {
    const result = await router.identifyIntent('广东620分能上什么大学');
    expect(result.taskType).toBe(TaskType.VOLUNTEER_MATCH);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.entities?.province).toBe('广东');
    expect(result.entities?.score).toBe(620);
  });

  it('detects volunteer match from 位次 keyword', async () => {
    const result = await router.identifyIntent('位次8000能报哪些学校');
    expect(result.taskType).toBe(TaskType.VOLUNTEER_MATCH);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('detects volunteer match from 冲稳保 keyword', async () => {
    const result = await router.identifyIntent('帮我分析一下冲稳保方案');
    expect(result.taskType).toBe(TaskType.VOLUNTEER_MATCH);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('detects volunteer match from 平行志愿 keyword', async () => {
    const result = await router.identifyIntent('平行志愿怎么填报');
    expect(result.taskType).toBe(TaskType.VOLUNTEER_MATCH);
  });

  // Knowledge QA
  it('detects knowledge QA from 政策 keyword', async () => {
    const result = await router.identifyIntent('今年招生政策有什么变化');
    expect(result.taskType).toBe(TaskType.KNOWLEDGE_QA);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('detects knowledge QA from 985 keyword', async () => {
    const result = await router.identifyIntent('985大学有哪些');
    expect(result.taskType).toBe(TaskType.KNOWLEDGE_QA);
  });

  it('detects knowledge QA from 专业介绍 keyword', async () => {
    const result = await router.identifyIntent('计算机专业介绍');
    expect(result.taskType).toBe(TaskType.KNOWLEDGE_QA);
  });

  // Career planning
  it('detects career planning from 职业 keyword', async () => {
    const result = await router.identifyIntent('毕业后做什么工作比较好');
    expect(result.taskType).toBe(TaskType.CAREER_PLAN);
  });

  it('detects career planning from 考研 keyword', async () => {
    const result = await router.identifyIntent('考研应该怎么准备');
    expect(result.taskType).toBe(TaskType.CAREER_PLAN);
  });

  it('detects career planning from 薪资 keyword', async () => {
    const result = await router.identifyIntent('毕业后的薪资水平如何');
    expect(result.taskType).toBe(TaskType.CAREER_PLAN);
  });

  // Emotion analysis
  it('detects emotion analysis from 焦虑 keyword', async () => {
    const result = await router.identifyIntent('最近感到很焦虑');
    expect(result.taskType).toBe(TaskType.EMOTION_ANALYSIS);
  });

  it('detects emotion analysis from 日记 keyword', async () => {
    const result = await router.identifyIntent('写一篇日记');
    expect(result.taskType).toBe(TaskType.EMOTION_ANALYSIS);
  });

  // Study plan
  it('detects study plan from 学习计划 keyword', async () => {
    const result = await router.identifyIntent('帮我制定一个学习计划');
    expect(result.taskType).toBe(TaskType.STUDY_PLAN);
  });

  // General chat fallback
  it('falls back to general chat for unrelated queries', async () => {
    const result = await router.identifyIntent('今天天气怎么样');
    expect(result.taskType).toBe(TaskType.GENERAL_CHAT);
    expect(result.confidence).toBeLessThan(0.7);
  });

  it('falls back to general chat for empty string', async () => {
    const result = await router.identifyIntent('');
    expect(result.taskType).toBe(TaskType.GENERAL_CHAT);
  });

  // Province extraction
  it('extracts province correctly', async () => {
    const result = await router.identifyIntent('浙江650分报志愿');
    expect(result.entities?.province).toBe('浙江');
  });

  it('extracts score correctly', async () => {
    const result = await router.identifyIntent('580分能上什么学校');
    expect(result.entities?.score).toBe(580);
  });
});

describe('IntentRouter — explicit task type override', () => {
  const router = createRouter();

  it('uses explicit taskType when provided in request', async () => {
    const response = await router.route({
      query: '今天天气怎么样',
      taskType: TaskType.VOLUNTEER_MATCH,
    });
    expect(response.taskType).toBe(TaskType.VOLUNTEER_MATCH);
  });
});
