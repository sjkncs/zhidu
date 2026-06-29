// API: RAG 智能问答 — 知识库检索 + LLM 生成 + 对话持久化
// POST /api/ai/chat
// Body: { query, collections?, context?, taskType?, stream?, sessionId? }
//
// 支持同步和流式 (SSE) 两种模式，自动持久化对话到 chat_sessions/chat_messages

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createRAGService } from '@zhidu/ai/rag-service';
import { createLLMService } from '@zhidu/ai/llm-service';
import { createChatSession, batchCreateChatMessages } from '@zhidu/db/repository';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      collections,
      context: chatContext,
      taskType = 'KNOWLEDGE_QA',
      stream = false,
      sessionId: inputSessionId,
    } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: '缺少必填参数: query' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // ─── Session management ───
    let sessionId = inputSessionId;
    if (!sessionId && user) {
      const session = await createChatSession(user.id);
      if (session) sessionId = session.id;
    }

    const llm = createLLMService();
    const rag = createRAGService(supabase as any, llm);

    // ─── 流式模式 ───
    if (stream) {
      // 先检索知识库
      const chunks = await rag.retrieve({
        query,
        collections,
        topK: 8,
      });

      // 构建带知识库上下文的消息
      const sourcesText = chunks
        .map((c, i) => `[${i + 1}] ${c.content}\n    — 来源: ${(c.metadata as any)?.title ?? '未知'}`)
        .join('\n\n');

      const systemMessage = {
        role: 'system' as const,
        content: `你是"智渡"平台的知识助手。请基于以下参考资料回答用户问题。

## 回答规则
1. 优先使用参考资料中的信息
2. 在回答中用 [1]、[2] 等标注引用来源
3. 如果参考资料不足，请明确说明

## 参考资料
${sourcesText || '（暂无相关参考资料）'}`,
      };

      const messages = [
        systemMessage,
        ...(chatContext ?? []).map((m: any) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: query },
      ];

      const llmStream = llm.chatStream({
        messages,
        options: { temperature: 0.6, maxTokens: 2048 },
      });

      const encoder = new TextEncoder();
      const sourcesPayload = chunks.map(c => ({
        title: (c.metadata as any)?.title ?? '',
        snippet: c.content.slice(0, 150),
        score: c.score,
      }));

      // Collect full assistant response for persistence
      let fullContent = '';
      const persistSessionId = sessionId;

      const readable = new ReadableStream({
        async start(controller) {
          try {
            // 发送 sessionId
            if (persistSessionId) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: persistSessionId })}\n\n`),
              );
            }

            // 先发送来源信息
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources: sourcesPayload })}\n\n`),
            );

            // 流式发送 LLM 内容
            for await (const chunk of llmStream) {
              if (chunk.delta) {
                fullContent += chunk.delta;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'content', delta: chunk.delta })}\n\n`),
                );
              }
              if (chunk.done) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              }
            }

            // Persist messages after stream completes
            if (persistSessionId && fullContent) {
              await batchCreateChatMessages(persistSessionId, [
                { role: 'user', content: query, taskType },
                { role: 'assistant', content: fullContent, sources: sourcesPayload, taskType },
              ]);
            }
          } catch (err) {
            console.error('[Chat Stream] error:', err);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Stream error' })}\n\n`),
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ─── 同步模式 ───
    const { content, sources } = await rag.retrieveAndGenerate({
      query,
      collections,
      context: chatContext?.map((m: any) => `${m.role}: ${m.content}`).join('\n'),
    });

    // Persist synchronous messages
    if (sessionId) {
      const sourcesPayload = sources.map(s => ({
        title: (s.metadata as any)?.title ?? '',
        snippet: s.content.slice(0, 200),
        score: s.score,
      }));
      await batchCreateChatMessages(sessionId, [
        { role: 'user', content: query, taskType },
        { role: 'assistant', content, sources: sourcesPayload, taskType },
      ]);
    }

    return NextResponse.json({
      success: true,
      data: {
        content,
        sessionId,
        sources: sources.map(s => ({
          title: (s.metadata as any)?.title ?? '',
          url: (s.metadata as any)?.sourceUrl,
          snippet: s.content.slice(0, 200),
          score: s.score,
        })),
        taskType,
      },
    });
  } catch (err: any) {
    console.error('[API] AI chat error:', err);
    return NextResponse.json(
      { error: err.message || '智能问答服务暂时不可用' },
      { status: 500 },
    );
  }
}
