// API: AI 智能生成简历内容
// POST /api/resume/generate
// Body: { background: string, targetRole: string, targetIndustry?: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLLMService } from '@zhidu/ai/llm-service';

interface ResumeGenerateResult {
  personalSummary: string;
  education: Array<{
    school: string;
    degree: string;
    major: string;
    startDate: string;
    endDate: string;
    gpa?: string;
  }>;
  experience: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    description: string;
    achievements: string[];
  }>;
  skills: Array<{
    name: string;
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  }>;
  awards: Array<{
    title: string;
    organization: string;
    date: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { background, targetRole, targetIndustry } = body;

    if (!background || typeof background !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: background' },
        { status: 400 },
      );
    }

    if (!targetRole || typeof targetRole !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: targetRole' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const llm = createLLMService();

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: `你是"智渡"平台的资深 HR 和简历优化专家。你的任务是根据用户提供的背景信息和目标岗位，生成一份结构化的专业简历内容。

【输出要求】
你必须且只能输出一个 JSON 对象，格式如下（不要输出任何其他文字）：

{
  "personalSummary": "2-3 句话的个人简介，突出核心优势和与目标岗位的匹配度",
  "education": [
    {
      "school": "学校名称",
      "degree": "学历（如：本科、硕士、博士）",
      "major": "专业名称",
      "startDate": "2020-09",
      "endDate": "2024-06",
      "gpa": "3.8/4.0（可选，如不清楚可不填）"
    }
  ],
  "experience": [
    {
      "company": "公司/组织名称",
      "role": "职位/角色名称",
      "startDate": "2023-06",
      "endDate": "2023-09",
      "description": "工作内容概述（1-2句话）",
      "achievements": ["具体成就1（尽量量化，如：提升了30%的效率）", "具体成就2"]
    }
  ],
  "skills": [
    {
      "name": "技能名称",
      "level": "beginner 或 intermediate 或 advanced 或 expert"
    }
  ],
  "awards": [
    {
      "title": "奖项名称",
      "organization": "颁发机构",
      "date": "2023-12"
    }
  ]
}

【生成规则】
1. personalSummary 要简洁有力，突出与目标岗位最相关的 2-3 个优势
2. education 根据用户背景填写，如有多段教育经历按时间倒序排列
3. experience 包含 2-4 段相关经历，每段有 2-3 个具体成就，尽量量化数据
4. skills 列出 6-10 个与目标岗位相关的技能，合理分配熟练度
5. awards 如有则列出 1-3 个，无则留空数组
6. 所有内容应基于用户提供的背景，不可编造不实信息，但可以适当润色和优化表述`,
      },
      {
        role: 'user',
        content: `请根据以下信息生成简历内容：

个人背景：${background}

目标岗位：${targetRole}${targetIndustry ? `\n目标行业：${targetIndustry}` : ''}

请严格按 JSON 格式输出。`,
      },
    ];

    const result = await llm.chatJSON<ResumeGenerateResult>({
      messages,
      options: { temperature: 0.7, maxTokens: 4096 },
    });

    if (!result?.personalSummary) {
      return NextResponse.json(
        { error: 'LLM 返回数据格式异常' },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[resume/generate]', err);
    return NextResponse.json(
      { error: '生成失败，请稍后重试' },
      { status: 500 },
    );
  }
}
