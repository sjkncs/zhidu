// 爬虫数据入库管道 — 将爬取的数据写入 Supabase

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CrawlResult, CrawledUniversity, CrawledAdmissionScore, CrawledMajor } from './types';

/**
 * 将爬虫结果写入数据库
 * 使用 upsert（ON CONFLICT）保证幂等性
 */
export async function ingestCrawlResult(
  db: SupabaseClient,
  result: CrawlResult,
): Promise<{
  universities: { inserted: number; errors: number };
  scores: { inserted: number; errors: number };
  majors: { inserted: number; errors: number };
}> {
  const stats = {
    universities: { inserted: 0, errors: 0 },
    scores: { inserted: 0, errors: 0 },
    majors: { inserted: 0, errors: 0 },
  };

  // 1. 写入院校
  for (const uni of result.universities) {
    try {
      await ingestUniversity(db, uni);
      stats.universities.inserted++;
    } catch (err) {
      console.error(`[Ingest] University ${uni.name}:`, err);
      stats.universities.errors++;
    }
  }

  // 2. 写入分数线
  for (const score of result.admissionScores) {
    try {
      await ingestAdmissionScore(db, score);
      stats.scores.inserted++;
    } catch (err) {
      console.error(`[Ingest] Score ${score.universityName}:`, err);
      stats.scores.errors++;
    }
  }

  // 3. 写入专业
  for (const major of result.majors) {
    try {
      await ingestMajor(db, major);
      stats.majors.inserted++;
    } catch (err) {
      console.error(`[Ingest] Major ${major.name}:`, err);
      stats.majors.errors++;
    }
  }

  return stats;
}

/**
 * 写入单条院校（upsert by name）
 */
async function ingestUniversity(db: SupabaseClient, uni: CrawledUniversity): Promise<void> {
  const row: Record<string, unknown> = {
    name: uni.name,
    province: uni.province,
    city: uni.city,
    tier: uni.tier || '普通本科',
    is_public: uni.isPublic ?? true,
    website: uni.website,
    school_type: uni.schoolType,
    founding_year: uni.foundingYear,
    is_985: uni.is985 ?? false,
    is_211: uni.is211 ?? false,
    is_dual_first_class: uni.isDualFirstClass ?? false,
    education_level: uni.educationLevel,
    affiliated: uni.affiliated,
    description: uni.description,
    motto: uni.motto,
    tags: uni.tags ?? [],
    data_source: uni.sourceName,
    data_year: new Date().getFullYear(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from('universities')
    .upsert(row, { onConflict: 'name,province' });

  if (error) throw error;
}

/**
 * 写入单条分数线
 */
async function ingestAdmissionScore(
  db: SupabaseClient,
  score: CrawledAdmissionScore,
): Promise<void> {
  // 先查找 university_id
  const { data: uni } = await db
    .from('universities')
    .select('id')
    .eq('name', score.universityName)
    .maybeSingle();

  // 如果有 major 名称，查找 major_id
  let majorId: string | undefined;
  if (score.majorName) {
    const { data: major } = await db
      .from('majors')
      .select('id')
      .eq('name', score.majorName)
      .maybeSingle();
    majorId = major?.id;
  }

  if (!uni) {
    console.warn(`[Ingest] University not found: ${score.universityName}, skipping score`);
    return;
  }

  const row: Record<string, unknown> = {
    university_id: uni.id,
    major_id: majorId,
    province: score.province,
    year: score.year,
    min_score: score.minScore,
    avg_score: score.avgScore,
    min_rank: score.minRank,
    batch: score.batch,
  };

  const { error } = await db
    .from('admission_scores')
    .upsert(row, { onConflict: 'university_id,province,year' });

  if (error) throw error;
}

/**
 * 写入单条专业
 */
async function ingestMajor(db: SupabaseClient, major: CrawledMajor): Promise<void> {
  const row: Record<string, unknown> = {
    name: major.name,
    major_code: major.code,
    category: major.category,
    discipline_category: major.disciplineCategory,
    duration: major.duration ?? 4,
    degree: major.degree ?? '学士',
    description: major.description,
    employment_rate: major.employmentRate,
    core_courses: major.coreCourses ?? [],
    data_source: major.sourceName,
    data_year: new Date().getFullYear(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from('majors')
    .upsert(row, { onConflict: 'name' });

  if (error) throw error;
}
