/**
 * SSE 流解析器 — 解析 /api/ai/chat 返回的 Server-Sent Events 流
 *
 * 协议：
 *   data: {"type":"sources","sources":[...]}    → RAG 检索结果
 *   data: {"type":"content","delta":"..."}      → LLM 增量文本
 *   data: {"type":"error","error":"..."}        → 错误
 *   data: [DONE]                                → 流结束
 */

export interface Source {
  title: string;
  snippet: string;
  score: number;
  url?: string;
}

export interface SourcesEvent {
  type: 'sources';
  sources: Source[];
}

export interface ContentEvent {
  type: 'content';
  delta: string;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export interface DoneEvent {
  type: 'done';
}

export type SSEEvent = SourcesEvent | ContentEvent | ErrorEvent | DoneEvent;

/**
 * 异步生成器：从 ReadableStream 逐行解析 SSE 事件
 */
export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按换行分割，保留最后一段（可能不完整）
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // SSE 标准格式：data: <payload>
        if (!trimmed.startsWith('data: ')) continue;

        const payload = trimmed.slice(6);

        // 结束信号
        if (payload === '[DONE]') {
          yield { type: 'done' };
          return;
        }

        // 尝试解析 JSON
        try {
          const parsed = JSON.parse(payload);

          if (parsed.type === 'sources' && Array.isArray(parsed.sources)) {
            yield { type: 'sources', sources: parsed.sources };
          } else if (parsed.type === 'content' && typeof parsed.delta === 'string') {
            yield { type: 'content', delta: parsed.delta };
          } else if (parsed.type === 'error' && typeof parsed.error === 'string') {
            yield { type: 'error', error: parsed.error };
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }

    // 流正常结束但未收到 [DONE]
    yield { type: 'done' };
  } finally {
    reader.releaseLock();
  }
}
