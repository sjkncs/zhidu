/**
 * 一分一段表数据生成脚本（修正版）
 * cumulative_rank = 该分及以上的人数（位次），分数越高位次越小
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://zxslbszyurfomlfjdlqp.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

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

function normalPDF(x, mean, std) {
  const exp = -0.5 * Math.pow((x - mean) / std, 2);
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(exp);
}

function generateProvinceData(province, config, year) {
  const rows = [];
  const yearOffset = (year - 2024) * 2;

  for (const [subjectType, subjectConfig] of Object.entries(config.subjects)) {
    const totalCandidates = Math.round(config.total * subjectConfig.ratio);
    const mean = subjectConfig.mean + yearOffset + (Math.random() - 0.5) * 3;
    const std = subjectConfig.std + (Math.random() - 0.5) * 2;

    // 计算每个分数的 PDF 值
    const scoreData = [];
    let totalPDF = 0;

    for (let score = config.maxScore; score >= config.minScore; score--) {
      const pdf = normalPDF(score, mean, std);
      scoreData.push({ score, pdf });
      totalPDF += pdf;
    }

    // 将 PDF 转换为人数，从高到低（分数越高，位次越小）
    // 先计算每个分数的人数
    let countsFromTop = [];
    for (const { score, pdf } of scoreData) {
      const countAtScore = Math.max(1, Math.round((pdf / totalPDF) * totalCandidates));
      countsFromTop.push({ score, countAtScore });
    }

    // 缩放使总人数匹配
    const totalGenerated = countsFromTop.reduce((s, e) => s + e.countAtScore, 0);
    const scaleFactor = totalCandidates / totalGenerated;
    for (const entry of countsFromTop) {
      entry.countAtScore = Math.max(1, Math.round(entry.countAtScore * scaleFactor));
    }

    // 从最高分开始累加得到位次（cumulative_rank = 该分及以上人数）
    let cumulativeRank = 0;
    for (const entry of countsFromTop) {
      cumulativeRank += entry.countAtScore;
      entry.cumulativeRank = cumulativeRank;
    }

    // 转为数据库行
    for (const entry of countsFromTop) {
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

async function main() {
  console.log('开始生成一分一段表数据（修正版）...');

  // 先清空旧数据
  console.log('清空旧的 score_rank_tables 数据...');
  const { error: deleteErr } = await supabase.from('score_rank_tables').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteErr) console.error('清空失败:', deleteErr.message);
  else console.log('清空成功');

  const allRows = [];
  const years = [2023, 2024, 2025];

  for (const [province, config] of Object.entries(PROVINCE_DATA)) {
    for (const year of years) {
      const rows = generateProvinceData(province, config, year);
      allRows.push(...rows);
      console.log(`  ${province} ${year}: ${rows.length} 条`);
    }
  }

  console.log(`\n共生成 ${allRows.length} 条记录，开始写入...`);

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
      if ((i / BATCH_SIZE) % 5 === 0) console.log(`  已写入 ${inserted}/${allRows.length}`);
    }
  }

  console.log(`\n完成！共写入 ${inserted} 条。`);

  // 验证：广东 2025 物理类 620 分
  const { data: sample } = await supabase
    .from('score_rank_tables')
    .select('score, count_at_score, cumulative_rank')
    .eq('province', '广东')
    .eq('year', 2025)
    .eq('subject_type', '物理类')
    .in('score', [600, 620, 650, 680, 700])
    .order('score', { ascending: false });

  console.log('\n验证 广东 2025 物理类:');
  if (sample) {
    for (const r of sample) {
      console.log(`  ${r.score}分: 位次 ${r.cumulative_rank} (该分人数 ${r.count_at_score})`);
    }
  }
}

main().catch(console.error);
