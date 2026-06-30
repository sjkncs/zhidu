// 爬虫模块导出

export { BaseCrawler } from './base-crawler';
export { GaokaoCrawler } from './gaokao-crawler';
export { EolCrawler } from './eol-crawler';
export { ingestCrawlResult } from './ingest';

export type {
  CrawlerConfig,
  CrawlResult,
  CrawlProgress,
  CrawledUniversity,
  CrawledAdmissionScore,
  CrawledMajor,
} from './types';
