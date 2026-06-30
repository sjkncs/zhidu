// 爬虫基类 — 提供通用的请求管理、限速、重试、日志

import type { CrawlerConfig, CrawlResult, CrawlProgress } from './types';

const DEFAULT_CONFIG: Required<CrawlerConfig> = {
  requestDelay: 1000,
  concurrency: 2,
  timeout: 30000,
  maxRetries: 3,
  dataYear: new Date().getFullYear(),
  proxyUrl: '',
};

export abstract class BaseCrawler {
  protected config: Required<CrawlerConfig>;
  protected errors: string[] = [];
  protected progressCallback?: (progress: CrawlProgress) => void;

  constructor(config?: CrawlerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  abstract get sourceName(): string;

  /** 子类实现：执行爬取 */
  abstract crawl(): Promise<CrawlResult>;

  /** 设置进度回调 */
  onProgress(cb: (progress: CrawlProgress) => void): void {
    this.progressCallback = cb;
  }

  /** 发送 HTTP GET 请求，自带限速+重试 */
  protected async fetchPage(url: string, headers?: Record<string, string>): Promise<string> {
    await this.delay(this.config.requestDelay);

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            ...headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
      } catch (err) {
        const msg = `Fetch failed [${url}] attempt ${attempt}/${this.config.maxRetries}: ${err instanceof Error ? err.message : err}`;
        if (attempt === this.config.maxRetries) {
          this.errors.push(msg);
          throw new Error(msg);
        }
        console.warn(msg);
        await this.delay(this.config.requestDelay * attempt);
      }
    }

    throw new Error(`Unreachable: fetchPage ${url}`);
  }

  /** 发送 JSON API 请求 */
  protected async fetchJSON<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const text = await this.fetchPage(url, {
      'Accept': 'application/json',
      ...headers,
    });
    return JSON.parse(text) as T;
  }

  /** 报告进度 */
  protected reportProgress(progress: CrawlProgress): void {
    this.progressCallback?.(progress);
    console.log(`[${this.sourceName}] ${progress.completed}/${progress.total} ${progress.current}`);
  }

  /** 延时工具 */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** 安全解析整数 */
  protected parseInt(text: string | undefined | null): number | undefined {
    if (!text) return undefined;
    const n = parseInt(text.replace(/[^\d]/g, ''), 10);
    return isNaN(n) ? undefined : n;
  }

  /** 安全解析浮点数 */
  protected parseFloat(text: string | undefined | null): number | undefined {
    if (!text) return undefined;
    const n = parseFloat(text.replace(/[^\d.]/g, ''));
    return isNaN(n) ? undefined : n;
  }

  /** 清洗文本（去除空白和特殊字符） */
  protected cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}
