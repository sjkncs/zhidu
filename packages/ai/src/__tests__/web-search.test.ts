// @zhidu/ai — web-search 三引擎切换逻辑测试
// 覆盖：工具定义、DDG→Wikipedia→Bing 引擎切换、Wikipedia 实时查询

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WEB_SEARCH_TOOL, executeWebSearch, searchWeb } from '../web-search';

// ─── 工具定义测试 ───────────────────────────────────────────────────────────

describe('WEB_SEARCH_TOOL 定义', () => {
  it('符合 Function Calling 工具格式', () => {
    expect(WEB_SEARCH_TOOL.type).toBe('function');
    expect(WEB_SEARCH_TOOL.function.name).toBe('web_search');
    expect(WEB_SEARCH_TOOL.function.description).toBeTruthy();

    const params = WEB_SEARCH_TOOL.function.parameters as any;
    expect(params.type).toBe('object');
    expect(params.properties.query.type).toBe('string');
    expect(params.properties.maxResults.type).toBe('number');
    expect(params.required).toContain('query');
  });

  it('description 说明了使用场景', () => {
    expect(WEB_SEARCH_TOOL.function.description).toContain('最新');
    expect(WEB_SEARCH_TOOL.function.description).toContain('搜索');
  });
});

// ─── Mock 工厂函数（每次调用创建新 Response，避免 body 被重复消费） ─────────

/** 创建 DDG 限流响应 (202) */
const ddgRateLimited = () => new Response('<html>rate limited</html>', { status: 202 });

/** 创建 DDG 正常响应（含搜索结果 HTML） */
function ddgWithResults(): Response {
  const padding = '<div>x</div>'.repeat(500);
  const results = Array.from({ length: 3 }, (_, i) =>
    `<div class="result">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(`https://example.com/page${i + 1}`)}">DDG Title ${i + 1}</a>
      <a class="result__snippet">DDG Snippet ${i + 1} about search result</a>
    </div>`
  ).join('\n');
  const html = `<!DOCTYPE html><html><body><div class="results">${results}</div>${padding}</body></html>`;
  return new Response(html, { status: 200 });
}

/** 创建 Wikipedia 正常响应 */
function wikiWithResults(): Response {
  return new Response(JSON.stringify({
    query: {
      search: [
        { title: '哈尔滨工业大学', snippet: '哈尔滨工业大学是中华人民共和国工业和信息化部直属的全国重点大学' },
        { title: '哈尔滨工业大学（深圳）', snippet: '哈尔滨工业大学（深圳）是哈工大在深圳市设立的校区' },
      ],
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** 创建 Wikipedia 空结果 */
function wikiNoResults(): Response {
  return new Response(JSON.stringify({ query: { search: [] } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** 创建 Bing 正常响应 */
function bingWithResults(): Response {
  return new Response(JSON.stringify({
    webPages: {
      value: [
        { name: 'Bing Result 1', url: 'https://bing.com/1', snippet: 'Bing Snippet 1' },
        { name: 'Bing Result 2', url: 'https://bing.com/2', snippet: 'Bing Snippet 2' },
      ],
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// ─── 三引擎切换逻辑测试（mock fetch） ───────────────────────────────────────

describe('searchWeb — 引擎切换逻辑', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as any;
    // Mock AbortSignal.timeout 以避免真实的定时器延迟
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(new AbortController().signal);
    // 禁用重试延迟：fake timers 使 setTimeout 立即触发
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ─── 场景 1：DDG 正常 → 直接返回 DDG 结果，不查 Wikipedia ───
  it('DDG 正常时直接返回结果，不查 Wikipedia', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('duckduckgo')) return ddgWithResults();
      return new Response('not found', { status: 404 });
    });

    const results = await searchWeb({ query: '哈工大', maxResults: 2 });

    const ddgCalls = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes('duckduckgo'));
    expect(ddgCalls.length).toBe(1);

    const wikiCalls = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes('wikipedia'));
    expect(wikiCalls.length).toBe(0);

    expect(results.length).toBeGreaterThan(0);
  });

  // ─── 场景 2：DDG 限流 → 降级 Wikipedia ───
  it('DDG 限流(202)时降级到 Wikipedia', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('duckduckgo')) return ddgRateLimited();
      if (url.includes('wikipedia')) return wikiWithResults();
      return new Response('not found', { status: 404 });
    });

    const results = await searchWeb({ query: '哈工大', maxResults: 2 });

    // DDG 被调用 3 次（全部限流）
    const ddgCalls = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes('duckduckgo'));
    expect(ddgCalls.length).toBe(3);

    // Wikipedia 被调用 1 次
    const wikiCalls = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes('wikipedia'));
    expect(wikiCalls.length).toBe(1);

    // 返回 Wikipedia 结果
    expect(results.length).toBe(2);
    expect(results[0].title).toBe('哈尔滨工业大学');
    expect(results[0].url).toContain('wikipedia.org');
  }, 15000);

  // ─── 场景 3：DDG + Wikipedia 都失败 → 降级 Bing ───
  it('DDG + Wikipedia 都失败时降级到 Bing', async () => {
    const origKey = process.env.BING_SEARCH_API_KEY;
    process.env.BING_SEARCH_API_KEY = 'test-bing-key-123';

    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('duckduckgo')) return ddgRateLimited();
      if (url.includes('wikipedia')) return wikiNoResults();
      if (url.includes('bing.microsoft')) return bingWithResults();
      return new Response('not found', { status: 404 });
    });

    const results = await searchWeb({ query: '哈工大', maxResults: 2 });

    // Bing 被调用
    const bingCalls = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes('bing.microsoft'));
    expect(bingCalls.length).toBe(1);

    // 验证 Bing 请求头含 API Key
    const bingHeaders = bingCalls[0][1]?.headers;
    expect(bingHeaders?.['Ocp-Apim-Subscription-Key']).toBe('test-bing-key-123');

    // 返回 Bing 结果
    expect(results.length).toBe(2);
    expect(results[0].title).toBe('Bing Result 1');

    if (origKey !== undefined) process.env.BING_SEARCH_API_KEY = origKey;
    else delete process.env.BING_SEARCH_API_KEY;
  }, 15000);

  // ─── 场景 4：三引擎全部失败 + 无 Bing Key → 返回空 ───
  it('三引擎全部失败且无 Bing Key 时返回空数组', async () => {
    delete process.env.BING_SEARCH_API_KEY;

    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('duckduckgo')) return ddgRateLimited();
      if (url.includes('wikipedia')) return wikiNoResults();
      return new Response('not found', { status: 404 });
    });

    const results = await searchWeb({ query: '哈工大', maxResults: 2 });

    // Bing 不应被调用（无 API Key）
    const bingCalls = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes('bing.microsoft'));
    expect(bingCalls.length).toBe(0);

    expect(results).toEqual([]);
  }, 15000);

  // ─── 场景 5：DDG 第一次限流但重试成功 → 不降级 ───
  it('DDG 第一次限流但重试成功后不降级', async () => {
    let ddgCallCount = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('duckduckgo')) {
        ddgCallCount++;
        if (ddgCallCount === 1) return ddgRateLimited();
        return ddgWithResults();
      }
      return new Response('not found', { status: 404 });
    });

    const results = await searchWeb({ query: '哈工大', maxResults: 2 });

    // DDG 被调用 2 次
    const ddgCalls = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes('duckduckgo'));
    expect(ddgCalls.length).toBe(2);

    // Wikipedia 不应被调用
    const wikiCalls = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes('wikipedia'));
    expect(wikiCalls.length).toBe(0);

    expect(results.length).toBeGreaterThan(0);
  }, 15000);
});

// ─── Wikipedia 实时查询测试（使用真实网络） ─────────────────────────────────

describe('Wikipedia API — 实时查询', () => {
  it('中文 Wikipedia 能查到哈尔滨工业大学', async () => {
    const results = await searchWeb({ query: '哈尔滨工业大学', maxResults: 3 });

    // DDG 可能限流，结果可能来自 DDG 或 Wikipedia
    // 但 Wikipedia 保底，至少应有结果
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBeTruthy();
    expect(results[0].url).toBeTruthy();
  }, 30000);

  it('executeWebSearch 返回格式化文本', async () => {
    const output = await executeWebSearch({ query: '哈尔滨工业大学', maxResults: 3 });

    expect(output).toBeTruthy();
    expect(typeof output).toBe('string');

    // 应有结果（Wikipedia 保底）
    if (!output.includes('未找到')) {
      expect(output).toContain('**'); // markdown bold for titles
    }
  }, 30000);
});
