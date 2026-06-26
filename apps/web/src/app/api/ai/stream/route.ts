// API: AI 流式对话 — 支持 SSE 流式输出
// POST /api/ai/stream
// Body: { messages: [...], model?: string }

import { NextRequest } from 'next/server';
import { createLLMService } from '@zhidu/ai/llm-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages = [], model } = body;

    if (!messages.length) {
      return new Response(JSON.stringify({ error: '请提供对话消息' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const llm = createLLMService();
    const stream = llm.chatStream({
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      options: { model },
    });

    // 使用 ReadableStream 实现 SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.delta) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ delta: chunk.delta })}\n\n`),
              );
            }
            if (chunk.done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            }
          }
        } catch (err) {
          console.error('[Stream] error:', err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`),
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
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
