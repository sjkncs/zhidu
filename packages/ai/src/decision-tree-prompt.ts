/**
 * @zhidu/ai — 结构化决策树 Prompt（PA_Agent 模式）
 *
 * 将志愿推荐流程编码为二叉决策树，强制 LLM 走可审计的推理路径。
 * 每个节点要求 yes/no 回答，不确定时默认"等待"而非强行推荐。
 *
 * 设计参考：PA_Agent 的二元决策树 + Credal Transformer 的不确定性量化思想
 */

import type { DecisionTrace, GateCheck } from './decision-nodes';
import type { VolunteerRecommendation } from './volunteer-engine';
import type { ContinuityCheckResult } from './continuity-guard';

// ─── Prompt Builder ─────────────────────────────────────────────────────────

/**
 * 构建结构化决策树 System Prompt
 * 与 Stage 1/Stage 2 共享前缀（利于 KV-cache 命中）
 */
export function buildDecisionTreeSystemPrompt(): string {
  return `你是知渡（Zhìdù）高考志愿推荐引擎的 AI 分析层。

## 核心原则
1. **确定性优先**：冲/稳/保分层、录取概率、位次计算由程序权威决定，你不可更改
2. **不确定性诚实**：当数据不足时，明确告知用户而非猜测
3. **可审计推理**：每个推荐必须附带数据依据
4. **连续性守卫**：如果用户之前已有推荐方案，解释变化原因而非忽略历史

## 决策树结构
你必须按照以下顺序逐步推理，每步给出 yes/no 判断：

### Section 0: 原则确认
- 0.1 是否理解用户的核心诉求？（分数/偏好/约束）
- 0.2 是否有足够的数据给出推荐？（程序已确认 → yes）

### Section 1: 数据门禁
- 1.1 数据充分性（程序锁定，已计算）
- 1.2 冲稳保三层是否均有匹配？
- 1.3 是否存在极端数据缺失需要警告用户？

### Section 2: 推荐分析
- 2.1 冲层：是否有值得冲刺的高价值目标？
- 2.2 稳层：稳层院校是否符合用户偏好？
- 2.3 保层：保底层是否足够安全？
- 2.4 是否存在大小年风险？

### Section 3: 个性化建议（你的主导区域）
- 3.1 基于用户偏好给出优先级建议
- 3.2 标注高置信度和低置信度推荐
- 3.3 提供"如果分数提高/降低 X 分"的弹性分析

## 输出格式
你的回复必须包含以下结构：
1. **决策追踪**：逐步列出各 section 的判断结果
2. **冲稳保分析**：每层 2-3 个重点推荐 + 推荐理由
3. **风险提示**：大小年、数据不足、竞争激烈等
4. **行动建议**：下一步该做什么（如补充信息、确认偏好）

## 禁止行为
- 不得编造不存在的院校或专业
- 不得修改程序计算的概率值
- 不得在数据不足时强行推荐
- 不得使用模糊语言回避不确定性（如"可能大概也许"）
`;
}

/**
 * 构建志愿推荐 User Prompt
 * 将确定性引擎的计算结果注入 LLM 上下文
 */
export function buildVolunteerUserPrompt(
  recommendation: VolunteerRecommendation,
  trace: DecisionTrace,
  gateCheck: GateCheck,
  continuityHint?: string,
): string {
  const { query } = recommendation;
  const lines: string[] = [];

  // ─── 考生信息 ────────────────────────────────────────────────
  lines.push('## 考生信息');
  lines.push(`- 分数: ${query.score} 分`);
  lines.push(`- 位次: 第 ${recommendation.rank} 名`);
  lines.push(`- 省份: ${query.province}`);
  lines.push(`- 科类: ${query.subjectType}`);
  lines.push(`- 省控线: ${recommendation.currentScoreLine} 分（线差: ${query.score - recommendation.currentScoreLine}）`);
  if (query.preferredMajorIds?.length) {
    lines.push(`- 偏好专业: ${query.preferredMajorIds.join(', ')}`);
  }
  if (query.preferredCities?.length) {
    lines.push(`- 偏好城市: ${query.preferredCities.join(', ')}`);
  }
  if (query.tierFilter?.length) {
    lines.push(`- 院校层级: ${query.tierFilter.join(', ')}`);
  }
  lines.push('');

  // ─── 门禁结果 ────────────────────────────────────────────────
  lines.push('## 数据门禁结果（程序计算，不可修改）');
  lines.push(`- 门禁状态: ${gateCheck.result}`);
  lines.push(`- 数据覆盖: ${gateCheck.dataYearCoverage} 年`);
  lines.push(`- 匹配记录: ${gateCheck.recordCount} 条`);
  if (gateCheck.reasons.length > 0) {
    lines.push(`- ⚠ 问题: ${gateCheck.reasons.join('; ')}`);
  }
  lines.push('');

  // ─── 决策追踪 ────────────────────────────────────────────────
  lines.push('## 决策追踪（程序计算结果）');
  for (const node of trace.nodes) {
    const authority = node.authority === 'locked' ? '🔒' :
      node.authority === 'overridable' ? '🔓' : '🤖';
    lines.push(`- ${authority} [${node.id}] ${node.label}: ${JSON.stringify(node.programValue)}`);
    lines.push(`  依据: ${node.evidence}`);
  }
  lines.push(`- 总体置信度: ${(trace.overallConfidence * 100).toFixed(0)}%`);
  lines.push('');

  // ─── 冲稳保推荐 ─────────────────────────────────────────────
  buildTierSection(lines, '冲（RUSH）', recommendation.rush);
  buildTierSection(lines, '稳（STABLE）', recommendation.stable);
  buildTierSection(lines, '保（SAFE）', recommendation.safe);

  // ─── 连续性上下文 ────────────────────────────────────────────
  if (continuityHint) {
    lines.push('## 连续性上下文');
    lines.push(continuityHint);
    lines.push('');
  }

  // ─── 指令 ────────────────────────────────────────────────────
  lines.push('## 请完成');
  lines.push('1. 按决策树结构逐步分析');
  lines.push('2. 为每层选出 2-3 个重点推荐并说明理由');
  lines.push('3. 标注风险点和数据不足之处');
  lines.push('4. 给出可操作的下一步建议');

  return lines.join('\n');
}

/**
 * 构建层级推荐表格
 */
function buildTierSection(
  lines: string[],
  title: string,
  results: Array<{
    universityName: string;
    majorName: string;
    probability: number;
    confidence: string;
    historicalMinScore: number;
    historicalAvgScore?: number;
    historicalMinRank?: number;
    mlUsed?: boolean;
    salaryInfo?: { avgSalary?: number };
    rankingInfo?: { bestRank?: number; bestRankSource?: string };
    disciplineRating?: string;
  }>,
): void {
  lines.push(`## ${title}（${results.length} 所）`);

  if (results.length === 0) {
    lines.push('_无匹配结果_');
    lines.push('');
    return;
  }

  // 展示前 5 个
  const display = results.slice(0, 5);
  for (const r of display) {
    const mlTag = r.mlUsed ? ' [ML]' : '';
    const confTag = r.confidence === 'low' ? ' ⚠低置信' : '';
    lines.push(`### ${r.universityName} — ${r.majorName}`);
    lines.push(`- 录取概率: ${r.probability}%${mlTag}${confTag}`);
    lines.push(`- 历年最低分: ${r.historicalMinScore}${r.historicalAvgScore ? ` / 均分: ${r.historicalAvgScore}` : ''}`);
    if (r.historicalMinRank) {
      lines.push(`- 历年最低位次: ${r.historicalMinRank}`);
    }
    if (r.rankingInfo?.bestRank) {
      lines.push(`- 院校排名: 第 ${r.rankingInfo.bestRank}（${r.rankingInfo.bestRankSource}）`);
    }
    if (r.disciplineRating) {
      lines.push(`- 学科评估: ${r.disciplineRating}`);
    }
    if (r.salaryInfo?.avgSalary) {
      lines.push(`- 就业参考: 平均薪资 ¥${r.salaryInfo.avgSalary.toLocaleString()}/月`);
    }
    lines.push('');
  }

  if (results.length > 5) {
    lines.push(`_还有 ${results.length - 5} 所，请向用户展示完整列表_`);
    lines.push('');
  }
}

/**
 * 构建"无推荐"的合成响应（门禁不通过时）
 */
export function buildNoRecommendationResponse(
  gateCheck: GateCheck,
  query: { score: number; province: string; subjectType: string },
): string {
  const lines: string[] = [];

  lines.push('## 无法生成推荐方案');
  lines.push('');
  lines.push(`考生信息: ${query.score}分 / ${query.province} / ${query.subjectType}`);
  lines.push('');

  if (gateCheck.result === 'insufficient_data') {
    lines.push('**原因**：当前数据不足以支撑可靠的志愿推荐。');
    lines.push('');
    for (const reason of gateCheck.reasons) {
      lines.push(`- ${reason}`);
    }
    lines.push('');
    lines.push('**建议**：');
    lines.push('1. 确认你的分数和位次信息是否准确');
    lines.push('2. 如果今年数据尚未发布，可以参考往年数据');
    lines.push('3. 提供更具体的偏好（城市、专业方向）以缩小匹配范围');
  } else {
    lines.push('**原因**：推荐方案不够完整，建议你补充以下信息：');
    lines.push('');
    for (const reason of gateCheck.reasons) {
      lines.push(`- ${reason}`);
    }
  }

  return lines.join('\n');
}
