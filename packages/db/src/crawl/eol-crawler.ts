// 掌上高考 (gkcx.eol.cn) 爬虫
// 采集院校信息、录取分数线和专业数据

import { BaseCrawler } from './base-crawler';
import type {
  CrawlResult,
  CrawlerConfig,
  CrawledUniversity,
  CrawledAdmissionScore,
  CrawledMajor,
} from './types';

/**
 * 掌上高考数据爬虫
 *
 * 目标 API：
 * - 院校搜索: gkcx.eol.cn/api 系列接口
 * - 院校详情: gkcx.eol.cn/school/xxx
 * - 分数线: gkcx.eol.cn/school/xxx/score
 *
 * 掌上高考提供了相对友好的 JSON API，本爬虫优先尝试 API 调用
 */
export class EolCrawler extends BaseCrawler {
  private readonly baseUrl = 'https://gkcx.eol.cn';
  private readonly apiBase = 'https://gkcx.eol.cn/api';

  constructor(config?: CrawlerConfig) {
    super(config);
  }

  get sourceName(): string {
    return '掌上高考';
  }

  async crawl(): Promise<CrawlResult> {
    const start = Date.now();
    const universities: CrawledUniversity[] = [];
    const admissionScores: CrawledAdmissionScore[] = [];
    const majors: CrawledMajor[] = [];

    try {
      // Phase 1: 采集院校列表
      const unis = await this.crawlUniversities();
      universities.push(...unis);

      // Phase 2: 采集分数线（按省份+年份）
      // const scores = await this.crawlScores(province, year);
      // admissionScores.push(...scores);

      // Phase 3: 采集专业数据
      // const majorData = await this.crawlMajors();
      // majors.push(...majorData);

      this.reportProgress({
        total: universities.length,
        completed: universities.length,
        current: '完成',
        errors: this.errors.length,
      });
    } catch (err) {
      this.errors.push(`Crawl failed: ${err instanceof Error ? err.message : err}`);
    }

    return {
      source: this.sourceName,
      universities,
      admissionScores,
      majors,
      duration: Date.now() - start,
      errors: this.errors,
    };
  }

  /**
   * 爬取院校列表
   * 掌上高考的院校 API 返回 JSON 格式数据
   */
  private async crawlUniversities(): Promise<CrawledUniversity[]> {
    const results: CrawledUniversity[] = [];
    let page = 1;
    const pageSize = 20;

    while (true) {
      try {
        // 院校列表 API
        // 实际 URL 需要通过浏览器 DevTools 验证
        const url = `${this.apiBase}/school/list?page=${page}&size=${pageSize}`;

        const data = await this.fetchJSON<any>(url, {
          'Referer': this.baseUrl,
        });

        if (!data?.data?.items?.length) break;

        for (const item of data.data.items) {
          const uni = this.parseUniversityItem(item);
          if (uni) results.push(uni);
        }

        this.reportProgress({
          total: data.data.total ?? results.length,
          completed: results.length,
          current: `第 ${page} 页`,
          errors: this.errors.length,
        });

        if (results.length >= (data.data.total ?? 0)) break;
        page++;
      } catch (err) {
        this.errors.push(`Crawl universities page ${page}: ${err}`);
        break;
      }
    }

    return results;
  }

  /**
   * 解析单个院校 API 返回的数据
   */
  private parseUniversityItem(item: any): CrawledUniversity | null {
    if (!item?.name) return null;

    return {
      name: item.name,
      province: item.province || item.provinceName || '',
      city: item.city || item.cityName,
      tier: this.normalizeTier(item.levelName || item.typeName || ''),
      isPublic: item.nature !== '民办' && item.nature !== '独立',
      website: item.website || item.officialSite,
      schoolType: item.typeName || item.categoryName,
      foundingYear: this.parseInt(item.foundYear || item.createYear),
      is985: item.is985 === 1 || item.is985 === true || /985/.test(item.levelName || ''),
      is211: item.is211 === 1 || item.is211 === true || /211/.test(item.levelName || ''),
      isDualFirstClass: item.isDoubleFirstClass === 1 || item.isDoubleFirstClass === true,
      affiliated: item.belong || item.affiliation,
      sourceUrl: `${this.baseUrl}/school/${item.schoolId || item.id}`,
      sourceName: this.sourceName,
    };
  }

  /**
   * 爬取录取分数线
   * @param province 省份（如 "广东"）
   * @param year 年份（如 2024）
   */
  async crawlScores(province: string, year: number): Promise<CrawledAdmissionScore[]> {
    const results: CrawledAdmissionScore[] = [];
    let page = 1;

    while (true) {
      try {
        const url = `${this.apiBase}/score/list?page=${page}&size=20&province=${encodeURIComponent(province)}&year=${year}`;

        const data = await this.fetchJSON<any>(url, {
          'Referer': this.baseUrl,
        });

        if (!data?.data?.items?.length) break;

        for (const item of data.data.items) {
          const score = this.parseScoreItem(item, province, year);
          if (score) results.push(score);
        }

        if (results.length >= (data.data.total ?? 0)) break;
        page++;
      } catch (err) {
        this.errors.push(`Crawl scores page ${page}: ${err}`);
        break;
      }
    }

    return results;
  }

  /** 解析分数线数据 */
  private parseScoreItem(
    item: any,
    province: string,
    year: number,
  ): CrawledAdmissionScore | null {
    const minScore = this.parseInt(item.minScore || item.lowestScore);
    if (!minScore) return null;

    return {
      universityName: item.schoolName || item.universityName || '',
      majorName: item.specialName || item.majorName,
      province,
      year,
      minScore,
      avgScore: this.parseInt(item.avgScore || item.averageScore),
      minRank: this.parseInt(item.minRank || item.lowestRank),
      batch: item.batch || item.batchName,
      subjectType: item.type || item.subjectType,
      sourceUrl: `${this.baseUrl}/school/${item.schoolId}`,
      sourceName: this.sourceName,
    };
  }

  /**
   * 爬取专业列表
   */
  async crawlMajors(): Promise<CrawledMajor[]> {
    const results: CrawledMajor[] = [];
    let page = 1;

    while (true) {
      try {
        const url = `${this.apiBase}/special/list?page=${page}&size=20`;

        const data = await this.fetchJSON<any>(url, {
          'Referer': this.baseUrl,
        });

        if (!data?.data?.items?.length) break;

        for (const item of data.data.items) {
          const major = this.parseMajorItem(item);
          if (major) results.push(major);
        }

        if (results.length >= (data.data.total ?? 0)) break;
        page++;
      } catch (err) {
        this.errors.push(`Crawl majors page ${page}: ${err}`);
        break;
      }
    }

    return results;
  }

  /** 解析专业数据 */
  private parseMajorItem(item: any): CrawledMajor | null {
    if (!item?.name && !item?.specialName) return null;

    return {
      name: item.name || item.specialName,
      code: item.code || item.specialCode,
      category: item.category || item.categoryName,
      disciplineCategory: item.levelName || item.disciplineCategory,
      duration: this.parseInt(item.year || item.duration),
      degree: item.degree || item.degreeName,
      description: item.introduction || item.description,
      sourceUrl: `${this.baseUrl}/special/${item.id || item.specialId}`,
      sourceName: this.sourceName,
    };
  }

  /** 标准化院校层次 */
  private normalizeTier(raw: string): string | undefined {
    if (/985/.test(raw)) return '985';
    if (/211/.test(raw)) return '211';
    if (/双一流/.test(raw)) return '双一流';
    if (/本科/.test(raw)) return '普通本科';
    if (/专科|高职/.test(raw)) return '专科';
    return undefined;
  }
}
