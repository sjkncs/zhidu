// @zhidu/ai — 文本分块器（Text Chunker）
// 将长文档分割为带重叠的片段，用于知识库入库和检索

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

export interface ChunkOptions {
  /** 目标分块字符数（默认 500） */
  chunkSize?: number;
  /** 相邻块重叠字符数（默认 50） */
  overlap?: number;
  /** 优先按段落分割（默认 true） */
  respectParagraphs?: boolean;
}

export interface TextChunk {
  /** 分块内容 */
  content: string;
  /** 元数据 */
  metadata: {
    chunkIndex: number;
    totalChunks: number;
    startChar: number;
    endChar: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 句子/段落边界检测
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 中英文句子边界正则
 * 中文句号、问号、感叹号、分号，以及英文对应符号
 */
const SENTENCE_BOUNDARY = /(?<=[。！？；.!?;\n])\s*/;

/**
 * 段落边界（连续换行）
 */
const PARAGRAPH_BOUNDARY = /\n\s*\n/;

/**
 * 在指定位置附近寻找最佳分割点
 * 优先顺序：段落边界 > 句子边界 > 空格/标点 > 任意位置
 */
function findSplitPoint(text: string, targetPos: number, searchRadius: number = 50): number {
  const start = Math.max(0, targetPos - searchRadius);
  const end = Math.min(text.length, targetPos + searchRadius);
  const searchRegion = text.slice(start, end);

  // 1. 优先找段落边界（换行符）
  const paraMatch = searchRegion.match(/\n\s*\n/);
  if (paraMatch && paraMatch.index !== undefined) {
    const absolutePos = start + paraMatch.index + paraMatch[0].length;
    if (Math.abs(absolutePos - targetPos) < searchRadius) {
      return absolutePos;
    }
  }

  // 2. 找句子边界
  const sentenceMatch = searchRegion.match(/(?<=[。！？；.!?;])\s*/);
  if (sentenceMatch && sentenceMatch.index !== undefined) {
    const absolutePos = start + sentenceMatch.index + sentenceMatch[0].length;
    if (Math.abs(absolutePos - targetPos) < searchRadius) {
      return absolutePos;
    }
  }

  // 3. 找空格或标点
  for (let i = targetPos; i < end && i < text.length; i++) {
    if (/\s|[，,、：:]/.test(text[i])) {
      return i + 1;
    }
  }
  for (let i = targetPos - 1; i >= start; i--) {
    if (/\s|[，,、：:]/.test(text[i])) {
      return i + 1;
    }
  }

  // 4. 回退到目标位置
  return targetPos;
}

// ─────────────────────────────────────────────────────────────────────────────
// 核心分块函数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 将文本分割为带重叠的片段
 *
 * 策略：
 * 1. 如果文本短于 chunkSize，直接返回一个块
 * 2. 按段落分割，如果单段落超过 chunkSize，再按句子分割
 * 3. 相邻块有 overlap 字符重叠，确保上下文连续
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const {
    chunkSize = 500,
    overlap = 50,
    respectParagraphs = true,
  } = options;

  // 清理文本
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[ \f\v]+/g, ' ')
    .trim();

  if (cleaned.length <= chunkSize) {
    return [{
      content: cleaned,
      metadata: {
        chunkIndex: 0,
        totalChunks: 1,
        startChar: 0,
        endChar: cleaned.length,
      },
    }];
  }

  const chunks: TextChunk[] = [];
  let cursor = 0;

  while (cursor < cleaned.length) {
    // 计算当前块的理想结束位置
    let endPos = Math.min(cursor + chunkSize, cleaned.length);

    // 如果不是文本末尾，尝试在自然边界分割
    if (endPos < cleaned.length) {
      endPos = findSplitPoint(cleaned, endPos, Math.min(chunkSize / 3, 80));
    }

    // 提取当前块内容
    const chunkContent = cleaned.slice(cursor, endPos).trim();

    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        metadata: {
          chunkIndex: chunks.length,
          totalChunks: 0, // 稍后填充
          startChar: cursor,
          endChar: endPos,
        },
      });
    }

    // 移动游标（考虑重叠）
    cursor = endPos - overlap;
    if (cursor < 0) cursor = endPos;

    // 防止无限循环
    if (cursor >= cleaned.length) break;
    if (chunks.length > 0 && chunks[chunks.length - 1].metadata.endChar >= cleaned.length) break;
  }

  // 回填总块数
  const totalChunks = chunks.length;
  for (const chunk of chunks) {
    chunk.metadata.totalChunks = totalChunks;
  }

  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// 批量分块（多文档）
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentToChunk {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ChunkedDocument {
  documentId: string;
  chunks: TextChunk[];
  documentMetadata?: Record<string, unknown>;
}

/**
 * 批量分块多份文档
 */
export function chunkDocuments(
  documents: DocumentToChunk[],
  options: ChunkOptions = {},
): ChunkedDocument[] {
  return documents.map(doc => ({
    documentId: doc.id,
    chunks: chunkText(doc.content, options),
    documentMetadata: doc.metadata,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────────────────────────────────────

export { SENTENCE_BOUNDARY, PARAGRAPH_BOUNDARY };
