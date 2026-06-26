// API: 知识库入库 — 添加文档到知识库
// POST /api/knowledge/ingest
// Body: { title, collection, content, sourceUrl?, metadata?, chunkSize?, overlap? }
//
// 支持单文档和批量入库
// collection: 'policy' | 'major_intro' | 'career' | 'volunteer' | 'general'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chunkText } from '@zhidu/ai/chunker';

const VALID_COLLECTIONS = ['policy', 'major_intro', 'career', 'volunteer', 'general'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      collection,
      content,
      sourceUrl,
      metadata = {},
      chunkSize = 500,
      overlap = 50,
      documents, // 支持批量: Array<{ title, collection, content, ... }>
    } = body;

    const supabase = await createClient();

    // 检查用户认证
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 },
      );
    }

    // 支持批量入库
    const docsToProcess = documents ?? [{
      title,
      collection,
      content,
      sourceUrl,
      metadata,
      chunkSize,
      overlap,
    }];

    const results: Array<{
      documentId: string;
      title: string;
      chunkCount: number;
      status: 'success' | 'error';
      error?: string;
    }> = [];

    for (const doc of docsToProcess) {
      try {
        // 验证必填字段
        if (!doc.title || !doc.collection || !doc.content) {
          results.push({
            documentId: '',
            title: doc.title ?? '未知',
            chunkCount: 0,
            status: 'error',
            error: '缺少必填字段: title, collection, content',
          });
          continue;
        }

        if (!VALID_COLLECTIONS.includes(doc.collection)) {
          results.push({
            documentId: '',
            title: doc.title,
            chunkCount: 0,
            status: 'error',
            error: `无效的 collection: ${doc.collection}。有效值: ${VALID_COLLECTIONS.join(', ')}`,
          });
          continue;
        }

        // 1. 插入文档记录
        const { data: docRow, error: docError } = await supabase
          .from('knowledge_documents')
          .insert({
            title: doc.title,
            collection: doc.collection,
            content: doc.content,
            source_url: doc.sourceUrl ?? null,
            metadata: doc.metadata ?? {},
          } as any)
          .select('id')
          .single();

        if (docError || !docRow) {
          results.push({
            documentId: '',
            title: doc.title,
            chunkCount: 0,
            status: 'error',
            error: `文档插入失败: ${docError?.message ?? '未知错误'}`,
          });
          continue;
        }

        const documentId = docRow.id;

        // 2. 文本分块
        const chunks = chunkText(doc.content, {
          chunkSize: doc.chunkSize ?? 500,
          overlap: doc.overlap ?? 50,
        });

        // 3. 插入分块数据
        const chunkRows = chunks.map((chunk) => ({
          document_id: documentId,
          chunk_index: chunk.metadata.chunkIndex,
          content: chunk.content,
          metadata: {
            ...chunk.metadata,
            ...(doc.metadata ?? {}),
          },
        }));

        if (chunkRows.length > 0) {
          const { error: chunkError } = await supabase
            .from('knowledge_chunks')
            .insert(chunkRows as any[]);

          if (chunkError) {
            results.push({
              documentId,
              title: doc.title,
              chunkCount: 0,
              status: 'error',
              error: `分块插入失败: ${chunkError.message}`,
            });
            continue;
          }
        }

        results.push({
          documentId,
          title: doc.title,
          chunkCount: chunks.length,
          status: 'success',
        });
      } catch (docErr: any) {
        results.push({
          documentId: '',
          title: doc.title ?? '未知',
          chunkCount: 0,
          status: 'error',
          error: docErr.message,
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: errorCount === 0,
      data: {
        total: results.length,
        successCount,
        errorCount,
        results,
      },
    });
  } catch (err: any) {
    console.error('[API] knowledge ingest error:', err);
    return NextResponse.json(
      { error: err.message || '知识库入库服务暂时不可用' },
      { status: 500 },
    );
  }
}
