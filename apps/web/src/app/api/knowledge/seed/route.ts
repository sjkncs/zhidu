// API: 知识库种子 — 将内置知识数据导入知识库
// POST /api/knowledge/seed
// Body: { reset?: boolean }  — reset=true 会先清空现有知识数据
//
// [!] 此接口需要管理员权限

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { seedKnowledge } from '@zhidu/ai/knowledge-seed';
import { requireAdmin, authErrorResponse } from '@/lib/auth-utils';
import { checkRateLimit, getRateLimitKey, rateLimitResponse, KNOWLEDGE_WRITE_LIMIT } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // 速率限制
    const rlKey = getRateLimitKey(request);
    const rl = checkRateLimit(`seed:${rlKey}`, KNOWLEDGE_WRITE_LIMIT);
    if (!rl.allowed) return rateLimitResponse(rl);

    // 要求管理员权限
    let auth;
    try {
      auth = await requireAdmin();
    } catch (err) {
      return authErrorResponse(err);
    }

    const body = await request.json().catch(() => ({}));
    const { reset = false } = body;

    const supabase = await createClient();

    // 如果需要重置，先清空数据
    if (reset) {
      // 先删分块（有外键关联）
      await supabase.from('knowledge_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('knowledge_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('[Seed] Cleared existing knowledge data by admin:', auth.user.email);
    }

    // 执行种子导入
    const result = await seedKnowledge(supabase as any);

    return NextResponse.json({
      success: true,
      data: {
        documentsInserted: result.documentsInserted,
        chunksInserted: result.chunksInserted,
        reset,
      },
    });
  } catch (err: any) {
    console.error('[API] knowledge seed error:', err);
    return NextResponse.json(
      { error: err.message || '知识库种子服务暂时不可用' },
      { status: 500 },
    );
  }
}
