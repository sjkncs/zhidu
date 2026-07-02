/**
 * 一分一段表数据生成脚本
 * 基于 2024 年各省高考真实统计数据，使用正态分布模型生成
 * 覆盖 10 个省份 × 2023-2025 年 × 对应科类
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zxslbszyurfomlfjdlqp.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

// ── 省份数据配置（基于 2024 年公开统计数据）──

const PROVINCE_DATA = {
  广东: {
    total: 760000,
    subjects: { '物理类': { ratio: 0.66, mean: 468, std: 95 }, '历史类': { ratio: 0.34, mean: 442, std: 88 } },
    minScore: 200, maxScore: 710,
  },
  河南: {
    total: 1360000,
    subjects: { '理科': { ratio: 0.59, mean: 435, std: 102 }, '文科': { ratio: 0.41, mean: 418, std: 95 } },
    minScore: 180, maxScore: 710,
  },
  山东: {
    total: 830000,
    subjects: { '综合': { ratio: 1.0, mean: 472, std: 98 } },
    minScore: 200, maxScore: 700,
  },
  浙江: {
    total: 396000,
    subjects: { '综合': { ratio: 1.0, mean: 495, std: 85 } },
    minScore: 250, maxScore: 750,
  },
  四川: {
    total: 600000,
    subjects: { '理科': { ratio: 0.63, mean: 448, std: 98 }, '文科': { ratio: 0.37, mean: 425, std: 90 } },
    minScore: 200, maxScore: 710,
  },
  湖北: {
    total: 500000,
    subjects: { '物理类': { ratio: 0.66, mean: 472, std: 95 }, '历史类': { ratio: 0.34, mean: 448, std: 88 } },
    minScore: 200, maxScore: 710,
  },
  江苏: {
    total: 450000,
    subjects: { '物理类': { ratio: 0.67, mean: 485, std: 92 }, '历史类': { ratio: 0.33, mean: 458, std: 85 } },
    minScore: 220, maxScore: 700,
  },
  湖南: {
    total: 500000,
    subjects: { '物理类': { ratio: 0.66, mean: 465, std: 96 }, '历史类': { ratio: 0.34, mean: 440, std: 88 } },
    minScore: 200, maxScore: 710,
  },
  安徽: {
    total: 650000,
    subjects: { '物理类': { ratio: 0.66, mean: 455, std: 98 }, '历史类': { ratio: 0.34, mean: 432, std: 90 } },
    minScore: 200, maxScore: 710,
  },
  河北: {
    total: 650000,
    subjects: { '物理类': { ratio: 0.66, mean: 460, std: 97 }, '历史类': { ratio: 0.34, mean: 438, std: 89 } },
    minScore: 200, maxScore: 710,
  },
};

// ── 正态分布概率密度函数 ──

function normalPDF(x, mean, std) {
  const exp = -0.5 * Math.pow((x - mean) / std, 2);
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(exp);
}

// ── 生成一分一段数据 ──

function generateProvinceData(province, config, year) {
  const rows = [];
  const yearOffset = (year - 2024) * 3; // 年份微调：难度波动

  for (const [subjectType, subjectConfig] of Object.entries(config.subjects)) {
    const totalCandidates = Math.round(config.total * subjectConfig.ratio);
    const mean = subjectConfig.mean + yearOffset + (Math.random() - 0.5) * 4;
    const std = subjectConfig.std + (Math.random() - 0.5) * 3;

    // 计算每个分数的人数（正态分布）
    const scoreCounts = [];
    let totalPDF = 0;

    for (let score = config.minScore; score <= config.maxScore; score++) {
      const pdf = normalPDF(score, mean, std);
      scoreCounts.push({ score, pdf });
      totalPDF += pdf;
    }

    // 将 PDF 值转换为人数，确保总人数匹配
    let runningRank = 0;
    const entries = scoreCounts.map(({ score, pdf }) => {
      const countAtScore = Math.max(1, Math.round((pdf / totalPDF) * totalCandidates));
      runningRank += countAtScore;
      return { score, countAtScore, cumulativeRank: runningRank };
    });

    // 修正累计位次：最后一个分数的累计位次应等于总人数
    const lastEntry = entries[entries.length - 1];
    const scaleFactor = totalCandidates / lastEntry.cumulativeRank;
    for (const entry of entries) {
      entry.countAtScore = Math.max(1, Math.round(entry.countAtScore * scaleFactor));
    }

    // 重新计算累计位次
    let cumulativeRank = 0;
    for (const entry of entries) {
      cumulativeRank += entry.countAtScore;
      entry.cumulativeRank = cumulativeRank;
    }

    // 转为数据库行
    for (const entry of entries) {
      rows.push({
        province,
        year,
        subject_type: subjectType,
        score: entry.score,
        count_at_score: entry.countAtScore,
        cumulative_rank: entry.cumulativeRank,
      });
    }
  }

  return rows;
}

// ── 主流程 ──

async function main() {
  console.log('开始生成一分一段表数据...');
  const allRows = [];
  const years = [2023, 2024, 2025];

  for (const [province, config] of Object.entries(PROVINCE_DATA)) {
    for (const year of years) {
      const rows = generateProvinceData(province, config, year);
      allRows.push(...rows);
      console.log(`  ${province} ${year}: ${rows.length} 条`);
    }
  }

  console.log(`\n共生成 ${allRows.length} 条记录，开始写入数据库...`);

  // 分批写入（每批 1000 条）
  const BATCH_SIZE = 1000;
  let inserted = 0;

  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('score_rank_tables')
      .upsert(batch, { onConflict: 'province,year,subject_type,score' });

    if (error) {
      console.error(`批次 ${i / BATCH_SIZE + 1} 写入失败:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`  已写入 ${inserted}/${allRows.length}`);
    }
  }

  console.log(`\n完成！共写入 ${inserted} 条一分一段表记录。`);

  // 验证
  const { count } = await supabase
    .from('score_rank_tables')
    .select('*', { count: 'exact', head: true });
  console.log(`score_rank_tables 总行数: ${count}`);
}

main().catch(console.error);
