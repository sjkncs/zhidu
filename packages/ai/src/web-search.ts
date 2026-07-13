// @zhidu/ai — 网络检索服务（P5: 外部知识增强）
// 双引擎架构：DuckDuckGo HTML（免费，主）+ Bing Web Search API（付费，备）
// 用于补充 RAG 知识库的时效性不足（最新政策、院校动态等）
// DDG 含重试逻辑：限流时(202/403/429)延迟重试
// Bing 备选：设置 BING_SEARCH_API_KEY 环境变量启用（免费额度 1000次/月）

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchParams {
  query: string;
  maxResults?: number;
  language?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 搜索主函数（DDG 主 + Bing 备）
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

/**
 * 执行网络搜索
 * 策略：先尝试 DuckDuckGo（免费），失败后回退到 Bing（付费，需配置 API Key）
 */
export async function searchWeb(params: WebSearchParams): Promise<WebSearchResult[]> {
  const { query, maxResults = 5, language = 'zh-cn' } = params;

  // 阶段 1：DuckDuckGo（含重试）
  const ddgResults = await searchWithDDG(query, maxResults, language);
  if (ddgResults.length > 0) return ddgResults;

  // 阶段 2：Wikipedia 搜索（永久备选，免费无需 key，始终可用）
  const wikiResults = await searchWithWikipedia(query, maxResults, language);
  if (wikiResults.length > 0) return wikiResults;

  // 阶段 3：Bing Web Search API（付费备选，需 API Key）
  const bingKey = process.env.BING_SEARCH_API_KEY;
  if (bingKey) {
    console.warn('[WebSearch] DDG+Wikipedia failed, falling back to Bing...');
    const bingResults = await searchWithBing(query, maxResults, language, bingKey);
    if (bingResults.length > 0) return bingResults;
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// DuckDuckGo 搜索引擎（免费）
// ─────────────────────────────────────────────────────────────────────────────

async function searchWithDDG(query: string, maxResults: number, language: string): Promise<WebSearchResult[]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.warn(`[WebSearch] DDG retry attempt ${attempt}/${MAX_RETRIES}...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }

    try {
      const results = await executeDDGSearch(query, maxResults, language);
      if (results.length > 0) return results;
      if (attempt < MAX_RETRIES) continue;
    } catch (err) {
      console.warn(`[WebSearch] DDG attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
      if (attempt >= MAX_RETRIES) break;
    }
  }
  return [];
}

async function executeDDGSearch(query: string, maxResults: number, language: string): Promise<WebSearchResult[]> {
  const searchUrl = new URL('https://html.duckduckgo.com/html/');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('kl', language);

  const response = await fetch(searchUrl.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': `${language},${language.split('-')[0]};q=0.9,en;q=0.5`,
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (response.status === 202 || response.status === 403 || response.status === 429) {
    throw new Error(`Rate limited (HTTP ${response.status})`);
  }

  if (!response.ok) {
    console.warn('[WebSearch] DDG returned', response.status);
    return [];
  }

  const html = await response.text();

  if (html.length < 5000 || !html.includes('result__a')) {
    throw new Error('DDG returned homepage or empty page');
  }

  return parseDDGResults(html, maxResults);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wikipedia 搜索（永久备选，免费无需 API Key）
// 适合查询院校信息、学科介绍、教育政策等知识类内容
// ─────────────────────────────────────────────────────────────────────────────

async function searchWithWikipedia(
  query: string,
  maxResults: number,
  language: string,
): Promise<WebSearchResult[]> {
  try {
    // 根据语言选择 Wikipedia 版本
    const wikiLang = language.startsWith('zh') ? 'zh' : language.split('-')[0];
    const wikiBase = `https://${wikiLang}.wikipedia.org/w/api.php`;

    const searchUrl = new URL(wikiBase);
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', query);
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('srlimit', String(Math.min(maxResults, 10)));

    const response = await fetch(searchUrl.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn('[WebSearch] Wikipedia returned', response.status);
      return [];
    }

    const data = await response.json();
    const searchResults = data?.query?.search ?? [];

    return searchResults.slice(0, maxResults).map((item: any) => ({
      title: item.title ?? '',
      url: `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(item.title?.replace(/ /g, '_') ?? '')}`,
      snippet: stripHtml(item.snippet ?? '').trim(),
    }));
  } catch (err) {
    console.warn('[WebSearch] Wikipedia failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bing Web Search API（付费备选）
// 免费额度：1000 次/月，3 次/秒
// 申请地址：https://www.microsoft.com/en-us/bing/apis/bing-web-search-api
// ─────────────────────────────────────────────────────────────────────────────

async function searchWithBing(
  query: string,
  maxResults: number,
  language: string,
  apiKey: string,
): Promise<WebSearchResult[]> {
  try {
    const bingUrl = new URL('https://api.bing.microsoft.com/v7.0/search');
    bingUrl.searchParams.set('q', query);
    bingUrl.searchParams.set('count', String(Math.min(maxResults, 10)));
    bingUrl.searchParams.set('mkt', language === 'zh-cn' ? 'zh-CN' : language);
    bingUrl.searchParams.set('textDecorations', 'false');

    const response = await fetch(bingUrl.toString(), {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn('[WebSearch] Bing returned', response.status);
      return [];
    }

    const data = await response.json();
    const webPages = data?.webPages?.value ?? [];

    return webPages.slice(0, maxResults).map((page: any) => ({
      title: page.name ?? '',
      url: page.url ?? '',
      snippet: page.snippet ?? '',
    }));
  } catch (err) {
    console.warn('[WebSearch] Bing failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML 解析器（分步提取，更健壮）
// ─────────────────────────────────────────────────────────────────────────────

function parseDDGResults(html: string, maxResults: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];

  // 步骤 1：提取所有 title + url（从 result__a 链接）
  const titles: Array<{ title: string; url: string }> = [];
  const titleRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = titleRegex.exec(html)) !== null) {
    const url = decodeDDGUrl(match[1]);
    const title = stripHtml(match[2]).trim();
    if (title && url) {
      titles.push({ title, url });
    }
  }

  // 步骤 2：提取所有 snippet（从 result__snippet）
  const snippets: string[] = [];
  // DDG 的 snippet 可能是 <a> 或 <span>
  const snippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|span)>/g;
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtml(match[1]).trim());
  }

  // 步骤 3：合并 title 和 snippet（按顺序配对）
  const count = Math.min(titles.length, maxResults);
  for (let i = 0; i < count; i++) {
    results.push({
      title: titles[i].title,
      url: titles[i].url,
      snippet: snippets[i] ?? '',
    });
  }

  // 备用解析：如果 result__a 没匹配到，尝试从 result__url 提取
  if (results.length === 0) {
    const urlRegex = /<a[^>]+class="result__url"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    while ((match = urlRegex.exec(html)) !== null && results.length < maxResults) {
      const url = decodeDDGUrl(match[1]);
      const title = stripHtml(match[2]).trim();
      if (title && url) {
        results.push({ title, url, snippet: '' });
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

/** 解码 DuckDuckGo 重定向 URL */
function decodeDDGUrl(ddgUrl: string): string {
  try {
    const uddgMatch = ddgUrl.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      return decodeURIComponent(uddgMatch[1]);
    }
    return ddgUrl;
  } catch {
    return ddgUrl;
  }
}

/** 去除 HTML 标签，保留纯文本 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具定义（Function Calling 格式）
// ─────────────────────────────────────────────────────────────────────────────

export const WEB_SEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description: '搜索互联网获取最新信息。当需要查询最新的招生政策、院校动态、专业排名变化、就业市场趋势等知识库中可能过时的信息时使用。不要用于查询知识库中已有的静态数据（如历年分数线、学科评估等）。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词，应当精确描述要查找的信息',
        },
        maxResults: {
          type: 'number',
          description: '最大返回结果数（默认5，最大10）',
        },
      },
      required: ['query'],
    },
  },
};

/**
 * 执行 web_search 工具调用并格式化结果
 */
export async function executeWebSearch(args: { query: string; maxResults?: number }): Promise<string> {
  const results = await searchWeb({
    query: args.query,
    maxResults: Math.min(args.maxResults ?? 5, 10),
  });

  if (results.length === 0) {
    return '未找到相关结果。请基于已有知识回答用户的问题。';
  }

  const formatted = results
    .map((r, i) => `[${i + 1}] **${r.title}**\n    ${r.snippet}\n    来源: ${r.url}`)
    .join('\n\n');

  return `## 网络搜索结果（"${args.query}"）\n\n${formatted}`;
}
