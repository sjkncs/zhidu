// API: 单篇论文详情 + AI 摘要生成
// GET /api/papers/[id] — 获取论文详情
// POST /api/papers/[id] — 生成 AI 摘要/洞察

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLLMService } from '@zhidu/ai/llm-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: paper, error } = await supabase
      .from('papers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !paper) {
      return NextResponse.json({ error: '论文不存在' }, { status: 404 });
    }

    // 获取用户交互状态
    const { data: { user } } = await supabase.auth.getUser();
    let userInteraction = null;
    if (user) {
      const { data: interactions } = await supabase
        .from('paper_interactions')
        .select('interaction_type, note, rating, created_at')
        .eq('paper_id', id)
        .eq('user_id', user.id);

      if (interactions && interactions.length > 0) {
        userInteraction = {
          bookmarked: interactions.some(i => i.interaction_type === 'bookmark'),
          read: interactions.some(i => i.interaction_type === 'read'),
          note: interactions.find(i => i.interaction_type === 'note')?.note,
          rating: interactions.find(i => i.interaction_type === 'note')?.rating,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...paper, userInteraction },
    });
  } catch (err) {
    console.error('[Paper Detail] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: 生成 AI 增强摘要 + 投资/量化关联洞察
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .select('*')
      .eq('id', id)
      .single();

    if (paperError || !paper) {
      return NextResponse.json({ error: '论文不存在' }, { status: 404 });
    }

    // 如果已有 AI 摘要且不强制刷新，直接返回
    const forceRefresh = request.nextUrl.searchParams.get('force') === 'true';
    if (paper.ai_summary && !forceRefresh) {
      return NextResponse.json({
        success: true,
        data: {
          aiSummary: paper.ai_summary,
          aiInsights: paper.ai_insights,
          aiTags: paper.ai_tags,
          relevanceScores: paper.relevance_scores,
        },
      });
    }

    // 调用 LLM 生成摘要和洞察
    const llm = createLLMService();

    const prompt = `你是一位精通 AI/ML、量化金融和交叉科学的学术研究员。请分析以下 arXiv 论文，生成：

1. **中文摘要**（200字以内）：用通俗易懂的语言概括论文的核心贡献、方法和结论
2. **交叉洞察**（JSON 数组）：这篇论文与以下领域的潜在关联：
   - 投资策略（如动量因子、均值回归、情绪分析等）
   - 量化交易（如新的统计方法、预测模型等）
   - 科研方向（如对知渡平台知识库/RAG/推荐系统的启发）
   - 实习/职业（如该领域的就业前景、技能需求）
3. **关键词标签**（5-8个）：用于分类和搜索
4. **相关度评分**（0-1）：investment, quant, research, career 四个维度

论文标题：${paper.title}
论文摘要：${paper.abstract}
作者：${(paper.authors as string[]).join(', ')}
分类：${(paper.categories as string[]).join(', ')}

请严格按以下 JSON 格式返回：
{
  "summary": "中文摘要...",
  "insights": [
    {"domain": "investment|quant|research|career", "title": "洞察标题", "description": "详细描述", "relevance": 0.8}
  ],
  "tags": ["tag1", "tag2", ...],
  "relevance": {"investment": 0.7, "quant": 0.5, "research": 0.9, "career": 0.3}
}`;

    const response = await llm.chat({
      messages: [{ role: 'user', content: prompt }],
      options: { temperature: 0.3, maxTokens: 1500 },
    });

    // 解析 LLM 响应
    let aiData;
    try {
      // 尝试从 markdown code block 中提取 JSON
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();
      aiData = JSON.parse(jsonStr);
    } catch {
      // 如果解析失败，使用原始文本作为摘要
      aiData = {
        summary: response.slice(0, 500),
        insights: [],
        tags: [],
        relevance: { investment: 0, quant: 0, research: 0.5, career: 0 },
      };
    }

    // 更新数据库
    const { error: updateError } = await supabase
      .from('papers')
      .update({
        ai_summary: aiData.summary,
        ai_insights: aiData.insights || [],
        ai_tags: aiData.tags || [],
        relevance_scores: aiData.relevance || {},
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Paper AI] Update error:', updateError.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        aiSummary: aiData.summary,
        aiInsights: aiData.insights,
        aiTags: aiData.tags,
        relevanceScores: aiData.relevance,
      },
    });
  } catch (err) {
    console.error('[Paper AI] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI analysis failed' },
      { status: 500 },
    );
  }
}
