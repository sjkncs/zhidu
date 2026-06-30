// 阳光高考 (gaokao.chsi.com.cn) 爬虫
// 采集院校信息和录取分数线数据

import { BaseCrawler } from './base-crawler';
import type { CrawlResult, CrawlerConfig, CrawledUniversity, CrawledAdmissionScore } from './types';

/**
 * 阳光高考院校信息爬虫
 *
 * 目标页面：
 * - 院校列表: gaokao.chsi.com.cn/sch/search--ss-on,searchType-1.dhtml
 * - 院校详情: gaokao.chsi.com.cn/sch/schoolInfo--schId-xxx.dhtml
 * - 录取分数: gaokao.chsi.com.cn/sch/schoolInfoScore--schId-xxx.dhtml
 *
 * 注意：阳光高考部分页面需要 JavaScript 渲染，如果 fetch 获取不到数据，
 * 需要切换为 Playwright 浏览器自动化方式。此版本使用 fetch + HTML 解析。
 */
export class GaokaoCrawler extends BaseCrawler {
  private readonly baseUrl = 'https://gaokao.chsi.com.cn';

  constructor(config?: CrawlerConfig) {
    super(config);
  }

  get sourceName(): string {
    return '阳光高考';
  }

  async crawl(): Promise<CrawlResult> {
    const start = Date.now();
    const universities: CrawledUniversity[] = [];
    const admissionScores: CrawledAdmissionScore[] = [];

    try {
      // Phase 1: 采集院校列表
      const unis = await this.crawlUniversityList();
      universities.push(...unis);

      // Phase 2: 采集各校详情（可选，数量大时建议分批）
      // const details = await this.crawlUniversityDetails(universities);

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
      majors: [],
      duration: Date.now() - start,
      errors: this.errors,
    };
  }

  /**
   * 爬取院校列表（分页）
   * 阳光高考的院校搜索页面是分页 HTML
   */
  private async crawlUniversityList(): Promise<CrawledUniversity[]> {
    const results: CrawledUniversity[] = [];

    // 阳光高考院校搜索 URL 模式
    // 注意：实际 URL 结构需要在浏览器中验证
    const listUrl = `${this.baseUrl}/sch/search--ss-on,searchType-1,option-qg.dhtml`;

    try {
      const html = await this.fetchPage(listUrl);

      // 解析 HTML 提取院校列表
      // 这里使用简单的正则提取，生产环境建议使用 cheerio
      const schoolLinks = this.extractSchoolLinks(html);

      for (let i = 0; i < schoolLinks.length; i++) {
        const link = schoolLinks[i];
        try {
          const uni = await this.parseSchoolPage(link.url, link.name);
          if (uni) results.push(uni);
        } catch (err) {
          this.errors.push(`Parse school ${link.name}: ${err}`);
        }

        if (i % 10 === 0) {
          this.reportProgress({
            total: schoolLinks.length,
            completed: i,
            current: link.name,
            errors: this.errors.length,
          });
        }
      }
    } catch (err) {
      this.errors.push(`Crawl university list: ${err}`);
    }

    return results;
  }

  /**
   * 从 HTML 中提取院校链接
   * 实际实现需要根据页面结构调整选择器
   */
  private extractSchoolLinks(html: string): Array<{ url: string; name: string }> {
    const links: Array<{ url: string; name: string }> = [];

    // 匹配院校链接的模式
    // 实际 URL 格式: /sch/schoolInfo--schId-xxx.dhtml
    const pattern = /href="(\/sch\/schoolInfo--schId-[^"]+\.dhtml)"[^>]*>([^<]+)<\/a>/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) !== null) {
      links.push({
        url: this.baseUrl + match[1],
        name: this.cleanText(match[2]),
      });
    }

    return links;
  }

  /**
   * 解析单个院校详情页面
   */
  private async parseSchoolPage(url: string, name: string): Promise<CrawledUniversity | null> {
    const html = await this.fetchPage(url);

    // 从 HTML 中提取院校信息
    // 实际实现需要根据页面 DOM 结构调整
    const province = this.extractField(html, '院校隶属|所在省份') ?? '';
    const tier = this.extractField(html, '院校类型|院校层次') ?? '';
    const schoolType = this.extractField(html, '院校特性|办学类型') ?? '';
    const website = this.extractField(html, '官方网址|学校网址') ?? '';

    if (!province) return null;

    return {
      name,
      province,
      tier: this.normalizeTier(tier),
      schoolType: this.normalizeSchoolType(schoolType),
      website: website.startsWith('http') ? website : undefined,
      is985: /985/.test(tier),
      is211: /211/.test(tier),
      isDualFirstClass: /双一流/.test(tier),
      sourceUrl: url,
      sourceName: this.sourceName,
    };
  }

  /**
   * 从 HTML 中通过标签文本提取字段值
   */
  private extractField(html: string, labelPattern: string): string | undefined {
    const regex = new RegExp(
      `(?:${labelPattern})[^<]*<[^>]*>[^<]*<[^>]*>\\s*([^<]+)`,
      'i',
    );
    const match = html.match(regex);
    return match ? this.cleanText(match[1]) : undefined;
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

  /** 标准化学校类型 */
  private normalizeSchoolType(raw: string): string | undefined {
    const types = ['综合', '理工', '师范', '医药', '农林', '财经', '政法', '语言', '艺术', '体育', '民族', '军事'];
    for (const t of types) {
      if (raw.includes(t)) return t;
    }
    return undefined;
  }
}
