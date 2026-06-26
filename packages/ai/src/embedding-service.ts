// @zhidu/ai — Embedding Service（可插拔向量嵌入接口）
//
// Phase 3a: 使用 pg_trgm 关键词检索，不需要 embedding
// Phase 3b: 接入 Embedding 提供商后，切换到 pgvector 语义检索
//
// 本文件定义了统一接口和多种实现，方便后续无缝切换

// ─────────────────────────────────────────────────────────────────────────────
// 接口定义
// ─────────────────────────────────────────────────────────────────────────────

export interface EmbeddingService {
  /** 将文本转换为向量 */
  embed(text: string): Promise<number[]>;
  /** 批量转换 */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** 向量维度 */
  dimensions(): number;
  /** 服务是否可用 */
  isAvailable(): boolean;
  /** 服务名称 */
  name(): string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Noop 实现（Phase 3a 默认，不依赖外部 API）
// ─────────────────────────────────────────────────────────────────────────────

export function createNoopEmbeddingService(): EmbeddingService {
  return {
    embed: async () => {
      throw new Error('[Embedding] Service not configured. Phase 3a uses pg_trgm search.');
    },
    embedBatch: async () => {
      throw new Error('[Embedding] Service not configured. Phase 3a uses pg_trgm search.');
    },
    dimensions: () => 0,
    isAvailable: () => false,
    name: () => 'noop',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Embedding 实现（通用 OpenAI-compatible Embedding API）
// ─────────────────────────────────────────────────────────────────────────────

export interface HttpEmbeddingConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions?: number;
}

export function createHttpEmbeddingService(config: HttpEmbeddingConfig): EmbeddingService {
  const { baseUrl, apiKey, model, dimensions: dims = 768 } = config;

  async function callEmbed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown');
      throw new Error(`[Embedding] API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[]; index: number }>;
      model: string;
      usage: { prompt_tokens: number; total_tokens: number };
    };

    // 按 index 排序确保顺序正确
    return data.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);
  }

  return {
    embed: async (text: string) => {
      const [result] = await callEmbed([text]);
      return result;
    },
    embedBatch: async (texts: string[]) => {
      // 分批处理，每批最多 100 条
      const batchSize = 100;
      const results: number[][] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await callEmbed(batch);
        results.push(...batchResults);
      }
      return results;
    },
    dimensions: () => dims,
    isAvailable: () => !!apiKey && !!baseUrl,
    name: () => `http:${model}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 工厂函数：根据环境变量自动选择实现
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 创建 Embedding 服务
 *
 * 环境变量：
 * - EMBEDDING_BASE_URL: Embedding API 地址
 * - EMBEDDING_API_KEY: API Key
 * - EMBEDDING_MODEL: 模型名称
 * - EMBEDDING_DIMENSIONS: 向量维度（默认 768）
 *
 * 如果没有配置，返回 noop 实现
 */
export function createEmbeddingService(): EmbeddingService {
  const baseUrl = process.env.EMBEDDING_BASE_URL;
  const apiKey = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL;
  const dims = parseInt(process.env.EMBEDDING_DIMENSIONS ?? '768', 10);

  if (baseUrl && apiKey && model) {
    console.log(`[Embedding] Using HTTP service: ${model} @ ${baseUrl}`);
    return createHttpEmbeddingService({
      baseUrl,
      apiKey,
      model,
      dimensions: dims,
    });
  }

  console.log('[Embedding] No embedding service configured, using noop (pg_trgm fallback).');
  return createNoopEmbeddingService();
}

// ─────────────────────────────────────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────────────────────────────────────
