// @zhidu/ai — 意图澄清服务（Phase 10: P1 结构化选择引导）
// 当用户查询过于模糊时，自动生成结构化选项引导用户聚焦意图
// 参照 IntentClassifier 模式：LLM (temperature=0.1) + JSON mode + regex 预提取

import type { LLMService } from './index';
import { extractEntities } from './intent-classifier';

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

export interface ChoiceOption {
  label: string;
  description?: string;
  icon?: string;
}

export interface ClarificationResult {
  /** 是否需要澄清 */
  needsClarification: boolean;
  /** 澄清问题 */
  question?: string;
  /** 选项标签（用于 header badge） */
  header?: string;
  /** 选项列表（2-4 个） */
  options?: ChoiceOption[];
  /** 是否允许多选 */
  multiSelect?: boolean;
  /** 判断依据 */
  reasoning?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 澄清判断 Prompt
// ─────────────────────────────────────────────────────────────────────────────

const CLARIFIER_SYSTEM = `你是知渡AI平台的意图澄清器。判断用户输入是否足够明确，若模糊则生成结构化选项引导用户聚焦意图。

## 判断标准
需要澄清的场景：
1. 用户意图宽泛（如"帮我看看志愿方案"但未提供分数/省份/偏好）
2. 存在多种可能的理解方向（如"推荐专业"但未说明是高考选专业还是大学转专业）
3. 缺少关键决策参数（如"帮我规划"但未说明是学业规划还是职业规划）

不需要澄清的场景：
1. 用户已提供足够参数（如"广东620分理科能上什么985"）
2. 明确的知识查询（如"清华大学的计算机专业怎么样"）
3. 简单的问候/闲聊

## 输出格式（严格 JSON）
{
  "needsClarification": true,
  "question": "需要了解更多信息来制定方案",
  "header": "志愿咨询",
  "options": [
    { "label": "已有目标院校", "description": "我知道想报哪些学校，需要帮我分析录取概率" },
    { "label": "已有目标专业", "description": "我对某些专业感兴趣，需要帮我匹配院校" },
    { "label": "从分数开始分析", "description": "我有高考分数，帮我推荐冲稳保方案" },
    { "label": "完全没头绪", "description": "不确定方向，需要全面引导" }
  ],
  "multiSelect": false,
  "reasoning": "用户未提供分数、省份等关键参数，需要引导明确方向"
}

不需要澄清时：
{
  "needsClarification": false,
  "reasoning": "用户已提供足够信息"
}

## 重要规则
1. options 数组必须包含 2-4 个选项，每个选项有 label 和 description
2. 选项应覆盖用户最可能的意图方向
3. 优先用 label 简洁概括，description 补充说明
4. 当查询包含具体数字（分数/位次）+ 具体地名时，通常不需要澄清`;

// ─────────────────────────────────────────────────────────────────────────────
// 预定义场景模板（避免每次调用 LLM，降低延迟）
// ─────────────────────────────────────────────────────────────────────────────

const VOLUNTEER_CLARIFICATION: ClarificationResult = {
  needsClarification: true,
  question: '需要了解更多信息来制定志愿方案',
  header: '志愿咨询',
  options: [
    { label: '已有目标院校', description: '我知道想报哪些学校，需要分析录取概率' },
    { label: '已有目标专业', description: '我对某些专业感兴趣，需要匹配院校' },
    { label: '从分数开始分析', description: '我有高考分数，帮我推荐冲稳保方案' },
    { label: '完全没头绪', description: '不确定方向，需要全面引导' },
  ],
  multiSelect: false,
};

const MAJOR_CLARIFICATION: ClarificationResult = {
  needsClarification: true,
  question: '想了解专业的哪些方面？',
  header: '专业咨询',
  options: [
    { label: '课程设置与学习内容', description: '这个专业学什么、怎么学' },
    { label: '就业前景与薪资', description: '毕业后的工作方向和待遇' },
    { label: '院校推荐与排名', description: '哪些学校的这个专业比较好' },
    { label: '全面对比分析', description: '综合了解再做决定' },
  ],
  multiSelect: false,
};

const PLAN_CLARIFICATION: ClarificationResult = {
  needsClarification: true,
  question: '你希望规划哪个方面？',
  header: '成长规划',
  options: [
    { label: '学业提升计划', description: 'GPA提升、课程安排、学习方法' },
    { label: '职业发展路径', description: '实习方向、技能储备、求职准备' },
    { label: '考研/留学准备', description: '备考规划、院校选择、时间线' },
  ],
  multiSelect: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// 规则预判断（快速路径，避免不必要的 LLM 调用）
// ─────────────────────────────────────────────────────────────────────────────

/** 查询是否已包含足够的结构化参数 */
function hasEnoughParams(entities: Record<string, unknown>): boolean {
  // 有分数/位次 + 省份 → 足够明确
  if ((entities.score || entities.rank) && entities.province) return true;
  return false;
}

/** 关键词匹配常见模糊场景 */
function matchVaguePattern(query: string): ClarificationResult | null {
  // 志愿相关但缺少参数
  if (/志愿|填报|方案|选校|冲稳保/.test(query)) {
    return VOLUNTEER_CLARIFICATION;
  }
  // 专业相关但方向不明
  if (/专业|选专业|什么专业好/.test(query) && !/课程|就业|排名|前景/.test(query)) {
    return MAJOR_CLARIFICATION;
  }
  // 规划相关但范围不清
  if (/规划|计划|安排|怎么学|怎么办/.test(query) && !/学习|职业|考研|留学/.test(query)) {
    return PLAN_CLARIFICATION;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 意图澄清服务
// ─────────────────────────────────────────────────────────────────────────────

export class IntentClarifier {
  constructor(private readonly llmService: LLMService) {}

  /**
   * 判断用户查询是否需要澄清，若需要则生成结构化选项
   *
   * 策略（纯规则，<50ms，不调用 LLM）：
   * 1. 先用 extractEntities 提取结构化参数
   * 2. 若参数充足 → 不需要澄清
   * 3. 如果用户已回答选择引导 → 不需要澄清
   * 4. 尝试关键词模板匹配 → 命中则直接返回预定义选项
   * 5. 无模板命中 → 不需要澄清（交给 LLM 自然对话）
   */
  async clarify(
    query: string,
    _context?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<ClarificationResult> {
    // 1. 预提取实体
    const entities = extractEntities(query);

    // 2. 参数充足 → 直接返回不需要澄清
    if (hasEnoughParams(entities)) {
      return {
        needsClarification: false,
        reasoning: `已有充足参数: ${Object.keys(entities).join(', ')}`,
      };
    }

    // 3. 如果用户已经回答了选择引导（查询以"已选择:"开头），不再澄清
    if (query.startsWith('已选择:')) {
      return { needsClarification: false, reasoning: '用户已回答选择引导' };
    }

    // 4. 尝试关键词模板快速匹配
    const templateMatch = matchVaguePattern(query);
    if (templateMatch) {
      return templateMatch;
    }

    // 5. 无模板命中 → 不澄清，交由主 LLM 自然对话处理
    return {
      needsClarification: false,
      reasoning: '无匹配的澄清模板，交由 LLM 自然对话',
    };
  }

  /** LLM 兜底：动态生成澄清问题和选项 */
  private async llmClarify(
    query: string,
    context?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<ClarificationResult> {
    const entities = extractEntities(query);
    const entityHint = Object.keys(entities).length > 0
      ? `\n\n[预提取参数: ${JSON.stringify(entities)}]`
      : '';

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: CLARIFIER_SYSTEM },
    ];

    if (context?.length) {
      const recentContext = context.slice(-4); // 最近 2 轮
      for (const msg of recentContext) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({
      role: 'user',
      content: `判断以下输入是否需要澄清：\n"${query}"${entityHint}`,
    });

    try {
      const result = await this.llmService.chatJSON<ClarificationResult>({
        messages,
        options: {
          temperature: 0.1,
          maxTokens: 400,
          jsonMode: true,
        },
      });

      // 验证选项数量
      if (result.needsClarification && result.options) {
        result.options = result.options.slice(0, 4);
        if (result.options.length < 2) {
          return { needsClarification: false, reasoning: 'LLM generated too few options' };
        }
      }

      return result;
    } catch {
      return {
        needsClarification: false,
        reasoning: 'LLM clarification failed, proceeding without clarification',
      };
    }
  }
}

/** 工厂函数 */
export function createIntentClarifier(llmService: LLMService): IntentClarifier {
  return new IntentClarifier(llmService);
}
