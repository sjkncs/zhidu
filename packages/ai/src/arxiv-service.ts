// @zhidu/ai — arXiv 论文追踪服务（学术雷达模块）
// 从 arXiv API 抓取论文，解析 XML，存入 Supabase
// 支持增量抓取、分类过滤、关键词搜索

// ─── 类型定义 ────────────────────────────────────────────────────────────

export interface ArxivPaper {
  arxivId: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  primaryCategory: string;
  publishedAt: string;
  updatedAt: string;
  pdfUrl: string;
  absUrl: string;
}

export interface ArxivSearchParams {
  categories?: string[];       // e.g., ["cs.AI", "stat.ML", "q-fin.ST"]
  keywords?: string[];         // 全文搜索关键词
  maxResults?: number;         // 最大返回数 (默认 50)
  start?: number;              // 分页偏移
  sortBy?: 'lastUpdatedDate' | 'submittedDate' | 'relevance';
  sortOrder?: 'ascending' | 'descending';
}

// arXiv 默认关注分类（AI + 量化金融 + 交叉科学）
export const DEFAULT_CATEGORIES = [
  // 人工智能 / 机器学习
  'cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'cs.NE',
  // 量化金融
  'q-fin.ST', 'q-fin.CP', 'q-fin.PM', 'q-fin.TR',
  // 统计 / 数学
  'stat.ML', 'math.OC', 'math.PR',
  // 交叉科学
  'physics.soc-ph', 'physics.data-an',
  // 经济学
  'econ.EM', 'econ.GN',
];

// ─── arXiv API 抓取 ─────────────────────────────────────────────────────

const ARXIV_API_BASE = 'http://export.arxiv.org/api/query';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

/**
 * 从 arXiv API 抓取论文
 */
export async function fetchArxivPapers(params: ArxivSearchParams = {}): Promise<ArxivPaper[]> {
  const {
    categories = [],
    keywords = [],
    maxResults = 50,
    start = 0,
    sortBy = 'lastUpdatedDate',
    sortOrder = 'descending',
  } = params;

  // 构建查询字符串
  const queryParts: string[] = [];

  // 分类过滤
  if (categories.length > 0) {
    const catQuery = categories.map(c => `cat:${c}`).join(' OR ');
    queryParts.push(`(${catQuery})`);
  }

  // 关键词搜索
  if (keywords.length > 0) {
    const kwQuery = keywords.map(k => `all:"${encodeURIComponent(k)}"`).join(' OR ');
    queryParts.push(`(${kwQuery})`);
  }

  // 默认查询：如果无分类无关键词，查 AI + 量化金融最新论文
  if (queryParts.length === 0) {
    queryParts.push('(cat:cs.AI OR cat:cs.LG OR cat:stat.ML OR cat:q-fin.ST)');
  }

  const searchQuery = queryParts.join(' AND ');
  const url = new URL(ARXIV_API_BASE);
  url.searchParams.set('search_query', searchQuery);
  url.searchParams.set('start', String(start));
  url.searchParams.set('max_results', String(maxResults));
  url.searchParams.set('sortBy', sortBy);
  url.searchParams.set('sortOrder', sortOrder);

  // 重试逻辑
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.warn(`[ArxivService] Retry attempt ${attempt}/${MAX_RETRIES}...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'Zhidu-AcademicRadar/1.0' },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        // arXiv 限流 (503) 时等待重试
        if (response.status === 503) {
          lastError = new Error(`arXiv rate limited (HTTP 503)`);
          continue;
        }
        throw new Error(`arXiv API error: HTTP ${response.status}`);
      }

      const xml = await response.text();
      return parseArxivXml(xml);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt >= MAX_RETRIES) break;
    }
  }

  console.error('[ArxivService] All attempts failed:', lastError?.message);
  return [];
}

/**
 * 解析 arXiv Atom XML 响应
 * arXiv API 返回 Atom feed 格式
 */
function parseArxivXml(xml: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];

  // 提取每个 <entry> 元素
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    try {
      const arxivId = extractXmlField(entry, 'id')
        ?.replace('http://arxiv.org/abs/', '')
        .replace(/v\d+$/, '') || '';  // 去除版本号

      if (!arxivId) continue;

      const title = cleanXmlText(extractXmlField(entry, 'title') || '');
      const abstract = cleanXmlText(extractXmlField(entry, 'summary') || '');
      const publishedAt = extractXmlField(entry, 'published') || '';
      const updatedAt = extractXmlField(entry, 'updated') || '';

      // 提取作者
      const authors: string[] = [];
      const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>/g;
      let authorMatch;
      while ((authorMatch = authorRegex.exec(entry)) !== null) {
        authors.push(cleanXmlText(authorMatch[1]));
      }

      // 提取分类
      const categories: string[] = [];
      let primaryCategory = '';
      const catRegex = /<category\s+term="([^"]+)"/g;
      let catMatch;
      while ((catMatch = catRegex.exec(entry)) !== null) {
        categories.push(catMatch[1]);
      }
      const primaryMatch = entry.match(/<arxiv:primary_category\s+term="([^"]+)"/);
      if (primaryMatch) primaryCategory = primaryMatch[1];

      // 提取链接
      let pdfUrl = '';
      let absUrl = '';
      const linkRegex = /<link\s+[^>]*?href="([^"]+)"[^>]*?type="([^"]+)"/g;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(entry)) !== null) {
        if (linkMatch[2] === 'application/pdf') pdfUrl = linkMatch[1];
      }
      absUrl = `https://arxiv.org/abs/${arxivId}`;
      if (!pdfUrl) pdfUrl = `https://arxiv.org/pdf/${arxivId}`;

      papers.push({
        arxivId,
        title,
        abstract,
        authors,
        categories,
        primaryCategory,
        publishedAt,
        updatedAt,
        pdfUrl,
        absUrl,
      });
    } catch (err) {
      console.warn('[ArxivService] Failed to parse entry:', err instanceof Error ? err.message : err);
    }
  }

  return papers;
}

// ─── XML 辅助函数 ────────────────────────────────────────────────────────

function extractXmlField(xml: string, field: string): string | null {
  const regex = new RegExp(`<${field}>([\\s\\S]*?)</${field}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function cleanXmlText(text: string): string {
  return text
    .replace(/\s+/g, ' ')          // 合并空白
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── 论文入库 ────────────────────────────────────────────────────────────

/**
 * 批量 upsert 论文到 Supabase
 * 使用 arxiv_id 作为冲突键，已存在的论文更新 abstract/authors
 */
export async function upsertPapers(
  db: any,
  papers: ArxivPaper[],
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const paper of papers) {
    try {
      const { data: existing } = await db
        .from('papers')
        .select('id')
        .eq('arxiv_id', paper.arxivId)
        .maybeSingle();

      const record = {
        arxiv_id: paper.arxivId,
        title: paper.title,
        abstract: paper.abstract,
        authors: paper.authors,
        categories: paper.categories,
        primary_category: paper.primaryCategory,
        published_at: paper.publishedAt,
        updated_at: paper.updatedAt,
        pdf_url: paper.pdfUrl,
        abs_url: paper.absUrl,
        source: 'arxiv',
      };

      if (existing) {
        // 更新已有论文（保留 AI 增强字段）
        const { error } = await db
          .from('papers')
          .update({
            title: record.title,
            abstract: record.abstract,
            authors: record.authors,
            categories: record.categories,
            updated_at: record.updated_at,
          })
          .eq('arxiv_id', paper.arxivId);
        if (error) {
          console.warn(`[ArxivService] Update failed for ${paper.arxivId}:`, error.message);
          errors++;
        } else {
          updated++;
        }
      } else {
        // 插入新论文
        const { error } = await db.from('papers').insert(record);
        if (error) {
          console.warn(`[ArxivService] Insert failed for ${paper.arxivId}:`, error.message);
          errors++;
        } else {
          inserted++;
        }
      }
    } catch (err) {
      console.warn(`[ArxivService] Error processing ${paper.arxivId}:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  return { inserted, updated, errors };
}
