// 阳光高考 (gaokao.chsi.com.cn) 爬虫
// 采集院校信息 — 从列表页批量解析

import { BaseCrawler } from './base-crawler';
import type { CrawlResult, CrawlerConfig, CrawledUniversity } from './types';

/**
 * 阳光高考院校信息爬虫
 *
 * 目标：院校搜索页 gaokao.chsi.com.cn/sch/search--ss-on,searchType-1,option-qg,start-{N}.dhtml
 * 每页约 20 所院校，约 140+ 页覆盖全国 ~2800 所高校
 *
 * 页面结构：Vue SSR，每条院校在 div.sch-item 中，
 * 点击事件 @click="window.open('/sch/schoolInfo--schId-{id}.dhtml')"
 */
export class GaokaoCrawler extends BaseCrawler {
  private readonly baseUrl = 'https://gaokao.chsi.com.cn';
  private readonly pageSize = 20;

  constructor(config?: CrawlerConfig) {
    super(config);
  }

  get sourceName(): string {
    return '阳光高考';
  }

  async crawl(): Promise<CrawlResult> {
    const start = Date.now();
    const universities: CrawledUniversity[] = [];

    try {
      // Phase 1: 批量采集院校列表（分页）
      const unis = await this.crawlAllPages();
      universities.push(...unis);

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
      admissionScores: [],
      majors: [],
      duration: Date.now() - start,
      errors: this.errors,
    };
  }

  /**
   * 分页采集所有院校
   */
  private async crawlAllPages(): Promise<CrawledUniversity[]> {
    const results: CrawledUniversity[] = [];
    let start = 0;
    let emptyPages = 0;

    while (emptyPages < 2) {
      const url = `${this.baseUrl}/sch/search--ss-on,searchType-1,option-qg,start-${start}.dhtml`;

      try {
        const html = await this.fetchPage(url);
        const items = this.parseSchoolItems(html);

        if (items.length === 0) {
          emptyPages++;
          if (emptyPages >= 2) break;
        } else {
          emptyPages = 0;
          results.push(...items);
        }

        this.reportProgress({
          total: -1, // unknown total
          completed: results.length,
          current: `第 ${Math.floor(start / this.pageSize) + 1} 页`,
          errors: this.errors.length,
        });

        start += this.pageSize;
      } catch (err) {
        this.errors.push(`Page start=${start}: ${err}`);
        // 遇到连续错误停 3 页后放弃
        if (this.errors.length > 10) break;
        start += this.pageSize;
      }
    }

    return results;
  }

  /**
   * 从单页 HTML 中提取院校数据
   *
   * HTML 结构：
   *   <div class="sch-item" @click="window.open('/sch/schoolInfo--schId-{id}.dhtml')">
   *     <span class="name js-yxk-yxmc">{name}</span>
   *     <div class="sch-department">{province}|主管部门：{dept}</div>
   *     <div class="sch-level">
   *       <div class="sch-level-tag">本科</div>
   *       <div class="sch-level-tag">"双一流"建设高校</div>
   *     </div>
   *     <div class="manyidu-star-box">...<a class="num">4.6</a></div>
   *   </div>
   */
  private parseSchoolItems(html: string): CrawledUniversity[] {
    const results: CrawledUniversity[] = [];

    // 匹配每个 sch-item 块
    const blockPattern = /<div\s+class="sch-item"[^>]*@click="window\.open\('([^']+)'[^"]*"\)[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*(?:<div\s+class="manyidu|<\/div>\s*<\/div>\s*<div\s+class="manyidu)/g;

    // 简化：先按 sch-item 分割，再逐个解析
    const blocks = html.split('class="sch-item"');

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      try {
        const uni = this.parseBlock(block);
        if (uni) results.push(uni);
      } catch {
        // skip unparseable blocks
      }
    }

    return results;
  }

  private parseBlock(block: string): CrawledUniversity | null {
    // 提取 schId URL
    const urlMatch = block.match(/window\.open\('([^']+)'/);
    if (!urlMatch) return null;
    const sourceUrl = this.baseUrl + urlMatch[1];

    // 提取院校名称
    const nameMatch = block.match(/class="name[^"]*"[^>]*>\s*([\u4e00-\u9fa5A-Za-z\s·]+?)\s*<\/span>/);
    if (!nameMatch) return null;
    const name = this.cleanText(nameMatch[1]);
    if (!name) return null;

    // 提取省份（在 sch-department 中，| 分隔符前）
    const deptMatch = block.match(/class="sch-department"[\s\S]*?iconfont[^>]*>[^<]*<\/i>([^<|]+)/);
    const province = deptMatch ? this.cleanText(deptMatch[1]) : '';

    // 提取主管部门
    const adminMatch = block.match(/主管部门：<\/span>([^<]+)/);
    const affiliated = adminMatch ? this.cleanText(adminMatch[1]) : undefined;

    // 提取层次标签
    const tags: string[] = [];
    const tagPattern = /class="sch-level-tag">([^<]+)<\/div>/g;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagPattern.exec(block)) !== null) {
      tags.push(this.cleanText(tagMatch[1]));
    }

    const tier = this.normalizeTier(tags.join(' '));
    const schoolType = this.normalizeSchoolType(tags.join(' '));
    const is985 = tags.some(t => /985/.test(t));
    const is211 = tags.some(t => /211/.test(t));
    const isDualFirstClass = tags.some(t => /双一流/.test(t));

    return {
      name,
      province,
      tier,
      schoolType,
      is985,
      is211,
      isDualFirstClass,
      affiliated,
      sourceUrl,
      sourceName: this.sourceName,
      tags: tags.length > 0 ? tags : undefined,
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

  /** 标准化学校类型 */
  private normalizeSchoolType(raw: string): string | undefined {
    const types = ['综合', '理工', '师范', '医药', '农林', '财经', '政法', '语言', '艺术', '体育', '民族', '军事'];
    for (const t of types) {
      if (raw.includes(t)) return t;
    }
    return undefined;
  }
}
