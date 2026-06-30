// 向量嵌入生成脚本
// 为 knowledge_chunks 生成 embedding 并写入 Supabase
// 用法: cd packages/db && npx tsx src/embeddings/index.ts [--batch-size 20] [--dry-run]
//
// 环境变量：
//   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   GLM_API_KEY + GLM_BASE_URL (优先，智谱 embedding-3)
//   OPENAI_API_KEY (回退，text-embedding-3-small)

import { createClient, type SupabaseClient } from '../index';

// 智谱 embedding-3：支持 1536 维，与 pgvector(1536) 匹配
const GLM_MODEL = 'embedding-3';
const OPENAI_MODEL = 'text-embedding-3-small';
const DEFAULT_BATCH_SIZE = 20; // 智谱限速较严，用小批次
const DEFAULT_DIMENSIONS = 1536;

interface CLIArgs {
  batchSize: number;
  dryRun: boolean;
  provider: 'glm' | 'openai' | 'auto';
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    batchSize: DEFAULT_BATCH_SIZE,
    dryRun: false,
    provider: 'auto',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--batch-size':
        result.batchSize = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--provider':
        result.provider = args[++i] as 'glm' | 'openai';
        break;
    }
  }

  return result;
}

/** 检测可用的 embedding provider */
function resolveProvider(preference: 'glm' | 'openai' | 'auto'): {
  provider: 'glm' | 'openai';
  baseUrl: string;
  apiKey: string;
  model: string;
} {
  // 优先使用 ZHIPU_EMBEDDING_KEY（智谱官方 key），回退 GLM_API_KEY
  const zhipuKey = process.env.ZHIPU_EMBEDDING_KEY;
  const glmKey = process.env.GLM_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const glmApiKey = zhipuKey ?? glmKey;

  if (preference === 'glm' || (preference === 'auto' && glmApiKey)) {
    if (!glmApiKey) throw new Error('GLM_API_KEY 或 ZHIPU_EMBEDDING_KEY 环境变量未设置');
    return {
      provider: 'glm',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: glmApiKey,
      model: GLM_MODEL,
    };
  }

  if (openaiKey) {
    return {
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: openaiKey,
      model: OPENAI_MODEL,
    };
  }

  throw new Error('未找到可用的 embedding API key（需要 GLM_API_KEY 或 OPENAI_API_KEY）');
}

/**
 * 调用 Embeddings API 生成向量（兼容 OpenAI / 智谱）
 */
async function generateEmbeddings(
  texts: string[],
  config: { baseUrl: string; apiKey: string; model: string },
): Promise<number[][]> {
  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: texts,
      dimensions: DEFAULT_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error (${config.model}): ${response.status} ${err}`);
  }

  const data = await response.json() as any;
  return data.data.map((item: any) => item.embedding);
}

/**
 * 主流程：分批处理所有 knowledge_chunks
 */
async function main(): Promise<void> {
  // 加载 apps/web/.env.local 中的环境变量
  const dotenv = await import('dotenv');
  const { fileURLToPath } = await import('url');
  const path = await import('path');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, '../../../../apps/web/.env.local');
  dotenv.config({ path: envPath });

  const args = parseArgs();
  const providerConfig = resolveProvider(args.provider);

  console.log('=== 向量嵌入生成器 ===');
  console.log(`Provider: ${providerConfig.provider}`);
  console.log(`模型: ${providerConfig.model}`);
  console.log(`API: ${providerConfig.baseUrl}`);
  console.log(`批次大小: ${args.batchSize}`);
  console.log(`试运行: ${args.dryRun ? '是' : '否'}`);
  console.log('');

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!supabaseUrl || !supabaseKey) {
    console.error('错误：需要设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量');
    process.exit(1);
  }

  const db = createClient({ url: supabaseUrl, anonKey: supabaseKey });

  // 统计总数
  const { count: totalCount } = await db
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true });

  const { count: embeddedCount } = await db
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .not('embedding', 'is', null);

  console.log(`总 chunks: ${totalCount}`);
  console.log(`已嵌入: ${embeddedCount}`);
  console.log(`待处理: ${(totalCount ?? 0) - (embeddedCount ?? 0)}`);
  console.log('');

  if (args.dryRun) {
    console.log('试运行模式，不执行实际操作');
    return;
  }

  // 分批处理未嵌入的 chunks
  let processed = 0;
  let errors = 0;
  const startTime = Date.now();

  while (true) {
    const { data: chunks, error } = await db
      .from('knowledge_chunks')
      .select('id, content')
      .is('embedding', null)
      .limit(args.batchSize);

    if (error) {
      console.error('查询失败:', error.message);
      break;
    }

    if (!chunks || chunks.length === 0) {
      console.log('\n所有 chunks 已处理完毕');
      break;
    }

    const texts = chunks.map((c: any) => c.content);

    try {
      const embeddings = await generateEmbeddings(texts, providerConfig);

      for (let i = 0; i < chunks.length; i++) {
        const { error: updateError } = await db
          .from('knowledge_chunks')
          .update({ embedding: embeddings[i] as any })
          .eq('id', chunks[i].id);

        if (updateError) {
          console.error(`  更新失败 ${chunks[i].id}: ${updateError.message}`);
          errors++;
        }
      }

      processed += chunks.length;
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = ((totalCount ?? 0) - (embeddedCount ?? 0) - processed) / rate;

      console.log(
        `  已处理 ${processed} 条 (${rate.toFixed(1)}/s, 预计剩余 ${remaining.toFixed(0)}s)`,
      );

      // 智谱限速：间隔 1s；OpenAI 可更短
      const delay = providerConfig.provider === 'glm' ? 1000 : 200;
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (err) {
      console.error(`批次处理失败:`, err);
      errors++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('\n=== 完成 ===');
  console.log(`处理: ${processed}`);
  console.log(`错误: ${errors}`);
  console.log(`耗时: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
