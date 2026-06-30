// 爬虫类型定义

/** 院校数据（爬虫采集格式） */
export interface CrawledUniversity {
  name: string;
  province: string;
  city?: string;
  tier?: string;
  isPublic?: boolean;
  website?: string;
  schoolType?: string;
  foundingYear?: number;
  is985?: boolean;
  is211?: boolean;
  isDualFirstClass?: boolean;
  educationLevel?: string;
  affiliated?: string;
  description?: string;
  motto?: string;
  tags?: string[];
  /** 数据来源 URL */
  sourceUrl: string;
  /** 数据来源名称 */
  sourceName: string;
}

/** 录取分数线（爬虫采集格式） */
export interface CrawledAdmissionScore {
  universityName: string;
  majorName?: string;
  province: string;
  year: number;
  minScore: number;
  avgScore?: number;
  minRank?: number;
  batch?: string;
  subjectType?: string;
  sourceUrl: string;
  sourceName: string;
}

/** 专业数据（爬虫采集格式） */
export interface CrawledMajor {
  name: string;
  code?: string;
  category?: string;
  disciplineCategory?: string;
  duration?: number;
  degree?: string;
  description?: string;
  employmentRate?: number;
  coreCourses?: string[];
  sourceUrl: string;
  sourceName: string;
}

/** 爬虫进度回调 */
export interface CrawlProgress {
  total: number;
  completed: number;
  current: string;
  errors: number;
}

/** 爬虫运行结果 */
export interface CrawlResult {
  source: string;
  universities: CrawledUniversity[];
  admissionScores: CrawledAdmissionScore[];
  majors: CrawledMajor[];
  duration: number;
  errors: string[];
}

/** 爬虫配置 */
export interface CrawlerConfig {
  /** 请求间隔(ms)，默认 1000 */
  requestDelay?: number;
  /** 最大并发请求数，默认 2 */
  concurrency?: number;
  /** 请求超时(ms)，默认 30000 */
  timeout?: number;
  /** 失败重试次数，默认 3 */
  maxRetries?: number;
  /** 数据年份，默认当年 */
  dataYear?: number;
  /** 代理 URL */
  proxyUrl?: string;
}
