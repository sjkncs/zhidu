// @zhidu/ai — LLM 意图分类器（Phase 13a）
// 当关键词匹配置信度低时，使用 LLM 进行精准意图分类
// 支持中英文混合查询，自动提取实体参数

import type { TaskType, RouteStrategy, LLMService } from './index';

// ─────────────────────────────────────────────────────────────────────────────
// 意图分类结果
// ─────────────────────────────────────────────────────────────────────────────

export interface IntentClassification {
  taskType: TaskType;
  strategy: RouteStrategy;
  confidence: number;
  entities: Record<string, unknown>;
  reasoning?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 分类 Prompt
// ─────────────────────────────────────────────────────────────────────────────

const CLASSIFIER_SYSTEM = `你是智渡AI平台的意图分类器。根据用户输入，精准识别意图并提取关键参数。

## 任务类型说明
- VOLUNTEER_MATCH: 高考志愿填报、分数线查询、位次估算、冲稳保推荐、院校匹配
- KNOWLEDGE_QA: 招生政策、专业介绍、院校信息、课程培养方向、就业前景查询
- CAREER_PLAN: 职业规划、就业路径、考研深造建议、实习方向、薪资分析
- RESUME_POLISH: 简历优化、简历润色、求职材料准备
- INTERVIEW_PREP: 面试准备、模拟面试、面试技巧
- EMOTION_ANALYSIS: 情绪倾诉、压力释放、心理疏导、日记记录
- STUDY_PLAN: 学习计划、备考安排、提分策略、时间规划
- MAJOR_RECOMMEND: 专业推荐、选科建议、兴趣测评匹配
- ESSAY_WRITING: 自荐信、个人陈述、申请文书撰写
- GENERAL_CHAT: 闲聊、问候、其他非特定领域问题

## 路由策略
- rule: 纯数值计算/规则匹配（如位次换算）
- rag: 需要检索知识库回答（政策、专业介绍等）
- llm: 需要 LLM 生成/推理（规划、分析、创作）
- hybrid: 规则+检索+LLM 组合（如志愿推荐）

## 输出格式（严格 JSON）
{
  "taskType": "VOLUNTEER_MATCH",
  "strategy": "hybrid",
  "confidence": 0.95,
  "entities": {
    "score": 620,
    "province": "广东",
    "year": 2024,
    "subjectType": "理科"
  },
  "reasoning": "用户询问620分在广东能上什么大学，属于志愿匹配场景"
}`;

// ─────────────────────────────────────────────────────────────────────────────
// 实体提取辅助
// ─────────────────────────────────────────────────────────────────────────────

const PROVINCE_LIST = [
  '北京', '天津', '上海', '重庆', '广东', '浙江', '江苏',
  '山东', '河南', '四川', '湖北', '湖南', '河北', '安徽', '福建', '陕西',
  '辽宁', '吉林', '黑龙江', '山西', '江西', '广西', '云南', '贵州', '甘肃',
  '青海', '海南', '内蒙古', '宁夏', '新疆', '西藏',
];

const SUBJECT_TYPES = ['理科', '文科', '物理类', '历史类', '综合', '理科综合', '文科综合'];

/** 从用户文本中提取常见实体参数（不依赖 LLM） */
export function extractEntities(text: string): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  // 分数提取
  const scoreMatch = text.match(/(\d{3})\s*分/);
  if (scoreMatch) entities.score = parseInt(scoreMatch[1]);

  // 位次提取
  const rankMatch = text.match(/(?:位次|排名|名次)[：:为是]?\s*(\d+)/);
  if (rankMatch) entities.rank = parseInt(rankMatch[1]);

  // 省份提取
  const province = PROVINCE_LIST.find(p => text.includes(p));
  if (province) entities.province = province;

  // 科类提取
  const subjectType = SUBJECT_TYPES.find(s => text.includes(s));
  if (subjectType) entities.subjectType = subjectType;

  // 年份提取
  const yearMatch = text.match(/(20\d{2})\s*年/);
  if (yearMatch) entities.year = parseInt(yearMatch[1]);

  return entities;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM 意图分类器
// ─────────────────────────────────────────────────────────────────────────────

export class IntentClassifier {
  constructor(private readonly llmService: LLMService) {}

  /**
   * 使用 LLM 进行意图分类（当关键词匹配置信度不足时使用）
   */
  async classify(
    query: string,
    context?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<IntentClassification> {
    const preExtracted = extractEntities(query);

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: CLASSIFIER_SYSTEM },
    ];

    // 附带最近的对话上下文（最多 3 轮）
    if (context?.length) {
      const recentContext = context.slice(-6);
      for (const msg of recentContext) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // 构建用户输入（附带预提取的实体提示）
    const entityHint = Object.keys(preExtracted).length > 0
      ? `\n\n[预提取参数: ${JSON.stringify(preExtracted)}]`
      : '';

    messages.push({
      role: 'user',
      content: `请分类以下用户意图：\n"${query}"${entityHint}`,
    });

    try {
      const result = await this.llmService.chatJSON<{
        taskType: string;
        strategy: string;
        confidence: number;
        entities: Record<string, unknown>;
        reasoning?: string;
      }>({
        messages,
        options: {
          temperature: 0.1,
          maxTokens: 300,
          jsonMode: true,
        },
      });

      // 合并预提取实体和 LLM 提取实体（预提取优先）
      const mergedEntities = { ...result.entities, ...preExtracted };

      return {
        taskType: (result.taskType as TaskType) ?? 'GENERAL_CHAT',
        strategy: (result.strategy as RouteStrategy) ?? 'llm',
        confidence: result.confidence ?? 0.7,
        entities: mergedEntities,
        reasoning: result.reasoning,
      };
    } catch {
      // LLM 分类失败时回退到通用对话
      return {
        taskType: 'GENERAL_CHAT' as TaskType,
        strategy: 'llm',
        confidence: 0.5,
        entities: preExtracted,
        reasoning: 'LLM classification failed, fallback to general chat',
      };
    }
  }
}
