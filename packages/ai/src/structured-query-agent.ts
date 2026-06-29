// @zhidu/ai — 结构化查询 Agent（Phase 13b）
// 将自然语言转换为结构化数据库查询
// 支持：院校查询、分数匹配、位次查询、专业推荐

import type { TaskType, LLMService } from './index';
import { extractEntities } from './intent-classifier';

// ─────────────────────────────────────────────────────────────────────────────
// 查询类型
// ─────────────────────────────────────────────────────────────────────────────

export type StructuredQueryType =
  | 'UNIVERSITY_SEARCH'      // 按分数/位次搜索院校
  | 'MAJOR_RECOMMEND'        // 专业推荐
  | 'SCORE_COMPARE'          // 分数对比（历年分数线）
  | 'RANK_ESTIMATE'          // 位次估算
  | 'CAREER_SALARY'          // 就业薪资查询
  | 'ADMISSION_STATS'        // 录取统计
  | 'UNKNOWN';               // 无法结构化

export interface StructuredQuery {
  type: StructuredQueryType;
  filters: {
    province?: string;
    year?: number;
    score?: number;
    rank?: number;
    subjectType?: string;
    universityName?: string;
    universityId?: string;
    majorName?: string;
    majorId?: string;
    tier?: string;
    riskLevel?: 'RUSH' | 'STABLE' | 'SAFE';
    limit?: number;
  };
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  explanation: string;
}

export interface StructuredQueryResult {
  query: StructuredQuery;
  data: unknown[];
  total: number;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 查询解析 Prompt
// ─────────────────────────────────────────────────────────────────────────────

const QUERY_PARSER_SYSTEM = `你是智渡平台的结构化查询解析器。将用户的自然语言问题转换为结构化数据库查询。

## 查询类型
- UNIVERSITY_SEARCH: 按分数/位次搜索可报考的院校（"XX分能上什么大学"、"位次XXXX有哪些学校"）
- MAJOR_RECOMMEND: 专业推荐（"什么专业适合我"、"推荐几个专业"）
- SCORE_COMPARE: 历年分数线对比（"XX大学近三年分数线"、"XX专业录取分数变化"）
- RANK_ESTIMATE: 位次估算（"XX分相当于去年多少分"、"位次换算"）
- CAREER_SALARY: 就业薪资查询（"计算机专业毕业薪资"、"XX专业就业前景"）
- ADMISSION_STATS: 录取统计（"XX大学录取率"、"XX专业报录比"）
- UNKNOWN: 无法转换为结构化查询

## 输出格式（严格 JSON）
{
  "type": "UNIVERSITY_SEARCH",
  "filters": {
    "province": "广东",
    "year": 2024,
    "score": 620,
    "subjectType": "物理类",
    "riskLevel": "STABLE",
    "limit": 20
  },
  "sort": { "field": "minScore", "direction": "desc" },
  "explanation": "查询广东省2024年物理类620分可报考的稳档院校"
}`;

// ─────────────────────────────────────────────────────────────────────────────
// 数据库查询执行器
// ─────────────────────────────────────────────────────────────────────────────

export interface QueryExecutor {
  /** 搜索院校（按分数/位次） */
  searchUniversities(params: {
    province: string;
    year: number;
    minScore?: number;
    maxScore?: number;
    tier?: string;
    limit?: number;
  }): Promise<unknown[]>;

  /** 获取院校历年分数线 */
  getScoreHistory(params: {
    universityId?: string;
    universityName?: string;
    majorId?: string;
    province: string;
    years?: number[];
  }): Promise<unknown[]>;

  /** 位次估算（分数转位次） */
  estimateRank(params: {
    score: number;
    province: string;
    year?: number;
  }): Promise<{ estimatedRank: number | null; confidence: number }>;

  /** 专业推荐 */
  recommendMajors(params: {
    province?: string;
    score?: number;
    category?: string;
    limit?: number;
  }): Promise<unknown[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 结构化查询 Agent
// ─────────────────────────────────────────────────────────────────────────────

export class StructuredQueryAgent {
  constructor(
    private readonly llmService: LLMService,
    private readonly executor: QueryExecutor,
  ) {}

  /**
   * 解析自然语言为结构化查询
   */
  async parseQuery(query: string): Promise<StructuredQuery> {
    const preExtracted = extractEntities(query);

    try {
      const result = await this.llmService.chatJSON<{
        type: StructuredQueryType;
        filters: StructuredQuery['filters'];
        sort?: StructuredQuery['sort'];
        explanation: string;
      }>({
        messages: [
          { role: 'system', content: QUERY_PARSER_SYSTEM },
          {
            role: 'user',
            content: `解析查询：${query}\n\n[预提取参数: ${JSON.stringify(preExtracted)}]`,
          },
        ],
        options: { temperature: 0.1, maxTokens: 400, jsonMode: true },
      });

      // 合并预提取参数
      const filters = { ...result.filters, ...preExtracted };

      return {
        type: result.type ?? 'UNKNOWN',
        filters,
        sort: result.sort,
        explanation: result.explanation ?? '',
      };
    } catch {
      // LLM 解析失败，尝试纯规则提取
      return this.fallbackParse(query, preExtracted);
    }
  }

  /**
   * 执行结构化查询并返回结果
   */
  async execute(structuredQuery: StructuredQuery): Promise<StructuredQueryResult> {
    const { type, filters } = structuredQuery;

    try {
      switch (type) {
        case 'UNIVERSITY_SEARCH': {
          const year = filters.year ?? new Date().getFullYear();
          const score = filters.score;
          if (!filters.province || !score) {
            return {
              query: structuredQuery,
              data: [],
              total: 0,
              message: '请提供省份和分数，我才能帮你搜索院校。',
            };
          }

          // 根据 riskLevel 调整分数范围
          let minScore: number | undefined;
          let maxScore: number | undefined;
          switch (filters.riskLevel) {
            case 'RUSH':
              minScore = score;
              maxScore = score + 30;
              break;
            case 'STABLE':
              minScore = score - 10;
              maxScore = score + 10;
              break;
            case 'SAFE':
              minScore = score - 40;
              maxScore = score - 5;
              break;
            default:
              minScore = score - 30;
              maxScore = score + 20;
          }

          const data = await this.executor.searchUniversities({
            province: filters.province,
            year,
            minScore,
            maxScore,
            tier: filters.tier,
            limit: filters.limit ?? 20,
          });

          return {
            query: structuredQuery,
            data,
            total: data.length,
            message: data.length > 0
              ? `找到 ${data.length} 所符合条件的院校`
              : '未找到符合条件的院校，请尝试调整分数范围或筛选条件。',
          };
        }

        case 'SCORE_COMPARE': {
          if (!filters.province) {
            return {
              query: structuredQuery,
              data: [],
              total: 0,
              message: '请提供省份信息。',
            };
          }

          const data = await this.executor.getScoreHistory({
            universityId: filters.universityId,
            universityName: filters.universityName,
            majorId: filters.majorId,
            province: filters.province,
          });

          return {
            query: structuredQuery,
            data,
            total: data.length,
            message: data.length > 0
              ? `查询到 ${data.length} 条录取记录`
              : '未找到该院校/专业的录取数据。',
          };
        }

        case 'RANK_ESTIMATE': {
          if (!filters.score || !filters.province) {
            return {
              query: structuredQuery,
              data: [],
              total: 0,
              message: '请提供分数和省份。',
            };
          }

          const result = await this.executor.estimateRank({
            score: filters.score,
            province: filters.province,
            year: filters.year,
          });

          return {
            query: structuredQuery,
            data: [result],
            total: 1,
            message: result.estimatedRank != null
              ? `${filters.score}分估算位次约为 ${result.estimatedRank}（置信度 ${(result.confidence * 100).toFixed(0)}%）`
              : '暂无该分数段的位次数据。',
          };
        }

        case 'MAJOR_RECOMMEND': {
          const data = await this.executor.recommendMajors({
            province: filters.province,
            score: filters.score,
            limit: filters.limit ?? 10,
          });

          return {
            query: structuredQuery,
            data,
            total: data.length,
            message: data.length > 0
              ? `为你推荐 ${data.length} 个专业方向`
              : '暂无推荐结果，请完善个人信息后重试。',
          };
        }

        default:
          return {
            query: structuredQuery,
            data: [],
            total: 0,
            message: '该查询类型暂不支持结构化处理，我将用对话方式回答你。',
          };
      }
    } catch (err) {
      return {
        query: structuredQuery,
        data: [],
        total: 0,
        message: `查询执行出错: ${err instanceof Error ? err.message : '未知错误'}`,
      };
    }
  }

  /**
   * 一步完成：解析 + 执行
   */
  async query(naturalLanguage: string): Promise<StructuredQueryResult> {
    const structured = await this.parseQuery(naturalLanguage);
    return this.execute(structured);
  }

  /**
   * 回退解析：纯规则提取
   */
  private fallbackParse(
    query: string,
    entities: Record<string, unknown>,
  ): StructuredQuery {
    const q = query.toLowerCase();

    let type: StructuredQueryType = 'UNKNOWN';

    if (/能上|报哪|推荐.*大学|什么.*学校|可以报/.test(q)) {
      type = 'UNIVERSITY_SEARCH';
    } else if (/分数线|录取分|历年|变化/.test(q)) {
      type = 'SCORE_COMPARE';
    } else if (/位次|排名.*多少|换算/.test(q)) {
      type = 'RANK_ESTIMATE';
    } else if (/推荐.*专业|什么专业|选.*专业/.test(q)) {
      type = 'MAJOR_RECOMMEND';
    } else if (/薪资|工资|收入|就业.*薪/.test(q)) {
      type = 'CAREER_SALARY';
    }

    return {
      type,
      filters: entities as StructuredQuery['filters'],
      explanation: '基于规则提取的结构化查询',
    };
  }
}
