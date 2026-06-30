// 爬虫 CLI 入口
// 用法: npx tsx src/crawl/cli.ts [--source gaokao|eol|all] [--province 广东] [--year 2024] [--ingest]

import { GaokaoCrawler } from './gaokao-crawler';
import { EolCrawler } from './eol-crawler';
import { ingestCrawlResult } from './ingest';
import { createClient } from '../index';
import type { CrawlerConfig, CrawlResult } from './types';

interface CLIArgs {
  source: 'gaokao' | 'eol' | 'all';
  province?: string;
  year?: number;
  ingest: boolean;
  delay: number;
  concurrency: number;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    source: 'all',
    ingest: false,
    delay: 1000,
    concurrency: 2,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
        result.source = args[++i] as CLIArgs['source'];
        break;
      case '--province':
        result.province = args[++i];
        break;
      case '--year':
        result.year = parseInt(args[++i], 10);
        break;
      case '--ingest':
        result.ingest = true;
        break;
      case '--delay':
        result.delay = parseInt(args[++i], 10);
        break;
      case '--concurrency':
        result.concurrency = parseInt(args[++i], 10);
        break;
      case '--help':
        printUsage();
        process.exit(0);
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
智渡数据爬虫 CLI

用法:
  npx tsx src/crawl/cli.ts [options]

选项:
  --source <gaokao|eol|all>  数据来源（默认 all）
  --province <省份>          指定省份爬取分数线
  --year <年份>              指定年份（默认当年）
  --ingest                   将爬取的数据写入数据库
  --delay <ms>               请求间隔毫秒数（默认 1000）
  --concurrency <n>          最大并发数（默认 2）
  --help                     显示帮助

示例:
  # 仅爬取院校信息（不入库）
  npx tsx src/crawl/cli.ts --source all

  # 爬取阳光高考并入库
  npx tsx src/crawl/cli.ts --source gaokao --ingest

  # 爬取广东省 2024 年分数线
  npx tsx src/crawl/cli.ts --source eol --province 广东 --year 2024 --ingest
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('=== 智渡数据爬虫 ===');
  console.log(`来源: ${args.source}`);
  console.log(`省份: ${args.province ?? '全部'}`);
  console.log(`年份: ${args.year ?? new Date().getFullYear()}`);
  console.log(`入库: ${args.ingest ? '是' : '否'}`);
  console.log('');

  const config: CrawlerConfig = {
    requestDelay: args.delay,
    concurrency: args.concurrency,
    dataYear: args.year,
  };

  const results: CrawlResult[] = [];

  // 运行爬虫
  if (args.source === 'gaokao' || args.source === 'all') {
    console.log('\n--- 阳光高考 ---');
    const crawler = new GaokaoCrawler(config);
    const result = await crawler.crawl();
    results.push(result);
    printResult(result);
  }

  if (args.source === 'eol' || args.source === 'all') {
    console.log('\n--- 掌上高考 ---');
    const crawler = new EolCrawler(config);
    const result = await crawler.crawl();
    results.push(result);
    printResult(result);
  }

  // 入库
  if (args.ingest) {
    console.log('\n--- 数据入库 ---');
    const db = createClient({
      url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      anonKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    });

    for (const result of results) {
      console.log(`\n入库来源: ${result.source}`);
      const stats = await ingestCrawlResult(db, result);
      console.log(`  院校: ${stats.universities.inserted} 成功, ${stats.universities.errors} 失败`);
      console.log(`  分数线: ${stats.scores.inserted} 成功, ${stats.scores.errors} 失败`);
      console.log(`  专业: ${stats.majors.inserted} 成功, ${stats.majors.errors} 失败`);
    }
  }

  // 汇总
  const totalUnis = results.reduce((s, r) => s + r.universities.length, 0);
  const totalScores = results.reduce((s, r) => s + r.admissionScores.length, 0);
  const totalMajors = results.reduce((s, r) => s + r.majors.length, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

  console.log('\n=== 汇总 ===');
  console.log(`院校: ${totalUnis}`);
  console.log(`分数线: ${totalScores}`);
  console.log(`专业: ${totalMajors}`);
  console.log(`错误: ${totalErrors}`);

  if (totalErrors > 0) {
    console.log('\n错误详情:');
    for (const r of results) {
      for (const e of r.errors) {
        console.log(`  [${r.source}] ${e}`);
      }
    }
  }
}

function printResult(result: CrawlResult): void {
  console.log(`  院校: ${result.universities.length}`);
  console.log(`  分数线: ${result.admissionScores.length}`);
  console.log(`  专业: ${result.majors.length}`);
  console.log(`  耗时: ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`  错误: ${result.errors.length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
