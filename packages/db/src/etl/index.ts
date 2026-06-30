// @zhidu/db — ETL Pipeline: Excel -> Supabase
// Imports university, major, ranking, discipline evaluation, and salary data
//
// Usage: cd E:\duiji\zhidu\packages\db && npx tsx src/etl/index.ts
//
// Required env vars (loaded from apps/web/.env.local):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
// Optional:
//   SUPABASE_SERVICE_ROLE_KEY (needed for RLS-protected writes)

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const ENV_FILE = path.join(PROJECT_ROOT, 'apps', 'web', '.env.local');

// Base directory for Excel source files
const EXCEL_BASE = path.join(
  PROJECT_ROOT,
  '一张AI表格管理你的大学四年',
  '一张AI表格管理你的大学四年',
  'Ding表格',
  '报考志愿必备资料中国大学及专业详解',
);

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap: load env vars
// ─────────────────────────────────────────────────────────────────────────────

dotenv.config({ path: ENV_FILE });

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[FATAL] Missing Supabase credentials.');
  console.error('  NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in');
  console.error(`  ${ENV_FILE}`);
  process.exit(1);
}

const usingServiceRole = !!(
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
);

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client
// ─────────────────────────────────────────────────────────────────────────────

const db: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function cellStr(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '是' : '否';
  // Handle rich text, formula, etc.
  if (typeof v === 'object' && 'result' in v) return String((v as any).result ?? '');
  return String(v).trim();
}

function cellNum(cell: ExcelJS.Cell | undefined): number | null {
  if (!cell) return null;
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  // Parse "333个", "1911年" etc.
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function parseBool985(val: string): boolean {
  return val === '985' || val === '是';
}

function parseBool211(val: string): boolean {
  return val === '211' || val === '是';
}

function parseBoolDualFirstClass(val: string): boolean {
  return val.includes('双一流') || val === '是';
}

function normalizeProvince(raw: string): string {
  if (!raw) return raw;
  return raw
    .replace(/壮族自治区$/, '')
    .replace(/回族自治区$/, '')
    .replace(/维吾尔自治区$/, '')
    .replace(/自治区$/, '')
    .replace(/特别行政区$/, '')
    .replace(/省$/, '')
    .replace(/市$/, '');
}

function deriveTier(is985: boolean, is211: boolean, isDual: boolean, eduLevel: string): string {
  if (is985) return '985';
  if (is211) return '211';
  if (isDual) return '双一流';
  if (eduLevel === '专科') return '专科';
  return '普通本科';
}

/** Parse discipline_evaluation JSON from Excel column 30.
 *  Format: {"name":"0101 哲学","value":"A+"},{"name":"0201 理论经济学","value":"A"} ...
 *  We wrap it in [...] to make valid JSON.
 */
function parseDisciplineEval(raw: string): Record<string, string> {
  if (!raw || raw === '-' || raw === 'null') return {};
  try {
    const arr = JSON.parse(`[${raw}]`);
    const obj: Record<string, string> = {};
    for (const item of arr) {
      if (item?.name && item?.value) {
        obj[item.name] = item.value;
      }
    }
    return obj;
  } catch {
    return {};
  }
}

/** Parse gender ratio from two columns (female%, male%) */
function formatGenderRatio(female: string, male: string): string | null {
  if (!female && !male) return null;
  return `男${male || '?'}:女${female || '?'}`;
}

/** Parse "{year,salary},{year,salary},..." format */
function parseSalaryData(raw: string): Array<{ year: number; salary: number }> {
  if (!raw) return [];
  const results: Array<{ year: number; salary: number }> = [];
  const re = /\{(\d+),(\d+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    results.push({ year: parseInt(m[1], 10), salary: parseInt(m[2], 10) });
  }
  return results;
}

/** Parse offering schools from "name,level,rating,rank,discipline_rating|..." format */
function parseOfferingSchools(raw: string): Array<{ name: string; rating?: string; level?: string }> {
  if (!raw) return [];
  return raw.split('|').map((entry) => {
    const parts = entry.split(',');
    return {
      name: parts[0]?.trim() || '',
      level: parts[1]?.trim() || undefined,
      rating: parts[2]?.trim() || undefined,
    };
  }).filter((s) => s.name);
}

/** Split specialties by ; or , or / */
function splitSpecialties(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[;；,，/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse employment rate from "2015年：70%-75%、2016年：85%-90%、..." */
function parseEmploymentRates(raw: string): Record<string, string> {
  if (!raw) return {};
  const result: Record<string, string> = {};
  const re = /(\d{4})年[：:]\s*([\d.%\-–~]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    result[m[1]] = m[2].trim();
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch upsert helper
// ─────────────────────────────────────────────────────────────────────────────

async function batchUpsert(
  table: string,
  rows: Record<string, unknown>[],
  conflictKey: string,
  label: string,
): Promise<{ inserted: number; errors: number }> {
  let inserted = 0;
  let errors = 0;
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { error } = await (db.from(table) as any).upsert(batch, {
      onConflict: conflictKey,
    });

    if (error) {
      errors++;
      console.error(`  [ERR] ${label} batch ${batchNum}/${totalBatches}: ${error.message}`);
      // Log first failing row for debugging
      if (batchNum === 1 && batch.length > 0) {
        console.error(`    Sample row keys: ${Object.keys(batch[0]).join(', ')}`);
      }
      continue;
    }

    inserted += batch.length;
    if (batchNum % 5 === 0 || batchNum === totalBatches) {
      console.log(`  ${label}: batch ${batchNum}/${totalBatches} done (${inserted} rows total)`);
    }
  }

  return { inserted, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. University Importer
// ─────────────────────────────────────────────────────────────────────────────

interface UniversityRecord {
  name: string;
  province: string;
  city: string;
  tier: string;
  is_public: boolean;
  is_985: boolean;
  is_211: boolean;
  is_dual_first_class: boolean;
  founding_year: number | null;
  school_type: string | null;
  education_level: string | null;
  master_programs: number;
  doctoral_programs: number;
  gender_ratio: string | null;
  admission_phone: string | null;
  national_specialties: string[];
  discipline_evaluation: Record<string, string>;
  description: string | null;
  website: string | null;
  tags: string[];
  data_source: string;
  data_year: number;
}

async function importUniversities(): Promise<UniversityRecord[]> {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  1/5  Importing Universities');
  console.log('═══════════════════════════════════════════════════════');

  const filePath = path.join(EXCEL_BASE, '2、院校介绍', '院校基础信息-版本2.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.getWorksheet('Sheet2') ?? wb.worksheets[0];
  console.log(`  Sheet: "${ws.name}", rows: ${ws.rowCount}`);

  const records: UniversityRecord[] = [];
  const seenNames = new Set<string>();

  // Row 1 is header, data starts at row 2
  for (let rowIdx = 2; rowIdx <= ws.rowCount; rowIdx++) {
    const row = ws.getRow(rowIdx);

    const name = cellStr(row.getCell(1)); // 学校名称
    if (!name || seenNames.has(name)) continue;
    seenNames.add(name);

    const province = normalizeProvince(cellStr(row.getCell(4))); // 所在省
    const city = cellStr(row.getCell(5)); // 城市
    const schoolType = cellStr(row.getCell(6)) || null; // 类型
    const is985 = parseBool985(cellStr(row.getCell(8))); // 是否985
    const is211 = parseBool211(cellStr(row.getCell(9))); // 是否211
    const isDual = parseBoolDualFirstClass(cellStr(row.getCell(20))); // 是否双一流
    const eduLevel = cellStr(row.getCell(14)); // 本科/专科
    const tier = deriveTier(is985, is211, isDual, eduLevel);
    const masterPrograms = cellNum(row.getCell(21)) ?? 0; // 硕士点（个）
    const doctoralPrograms = cellNum(row.getCell(22)) ?? 0; // 博士点（个）
    const foundingYear = cellNum(row.getCell(23)); // 成立时间
    const femaleRatio = cellStr(row.getCell(24)); // 女生比例
    const maleRatio = cellStr(row.getCell(25)); // 男生比例
    const genderRatio = formatGenderRatio(femaleRatio, maleRatio);
    const admissionPhone = cellStr(row.getCell(26)) || null; // 招办电话
    const nationalSpecs = splitSpecialties(cellStr(row.getCell(16))); // 国家特色专业
    const discEval = parseDisciplineEval(cellStr(row.getCell(30))); // 评估结果
    const description = cellStr(row.getCell(31)) || null; // 大学简介
    const website = cellStr(row.getCell(29)) || null; // 官网
    const isPublic = cellStr(row.getCell(13)) === '公办'; // 公私性质

    // Build tags
    const tags: string[] = [];
    if (schoolType) tags.push(`${schoolType}类`);
    if (is985) tags.push('985');
    if (is211) tags.push('211');
    if (isDual) tags.push('双一流');
    if (cellStr(row.getCell(12))) tags.push(cellStr(row.getCell(12))); // 国重/省重

    records.push({
      name,
      province,
      city,
      tier,
      is_public: isPublic,
      is_985: is985,
      is_211: is211,
      is_dual_first_class: isDual,
      founding_year: foundingYear,
      school_type: schoolType,
      education_level: eduLevel || null,
      master_programs: masterPrograms,
      doctoral_programs: doctoralPrograms,
      gender_ratio: genderRatio,
      admission_phone: admissionPhone,
      national_specialties: nationalSpecs,
      discipline_evaluation: discEval,
      description,
      website,
      tags,
      data_source: 'excel',
      data_year: 2023,
    });
  }

  console.log(`  Parsed ${records.length} unique universities`);

  // Convert to DB rows for upsert
  const dbRows = records.map((r) => ({
    name: r.name,
    province: r.province,
    city: r.city,
    tier: r.tier,
    is_public: r.is_public,
    is_985: r.is_985,
    is_211: r.is_211,
    is_dual_first_class: r.is_dual_first_class,
    founding_year: r.founding_year,
    school_type: r.school_type,
    education_level: r.education_level,
    master_programs: r.master_programs,
    doctoral_programs: r.doctoral_programs,
    gender_ratio: r.gender_ratio,
    admission_phone: r.admission_phone,
    national_specialties: r.national_specialties,
    discipline_evaluation: r.discipline_evaluation,
    description: r.description,
    website: r.website,
    tags: r.tags,
    data_source: r.data_source,
    data_year: r.data_year,
  }));

  const result = await batchUpsert('universities', dbRows, 'name', 'Universities');
  console.log(`  [OK] Universities: ${result.inserted} inserted/updated, ${result.errors} errors`);

  return records;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Major Importer (专业基本介绍.xlsx)
// ─────────────────────────────────────────────────────────────────────────────

interface MajorRecord {
  name: string;
  major_code: string;
  category: string;
  discipline_category: string;
  duration: number;
  degree: string;
  gender_ratio: string | null;
  employment_rates: Record<string, string>;
  what_description: string | null;
  study_description: string | null;
  career_description: string | null;
  description: string | null;
}

async function importMajorsBasic(): Promise<MajorRecord[]> {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  2/5  Importing Majors (basic info)');
  console.log('═══════════════════════════════════════════════════════');

  const filePath = path.join(EXCEL_BASE, '3、专业介绍', '专业基本介绍.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.getWorksheet('Sheet1') ?? wb.worksheets[0];
  console.log(`  Sheet: "${ws.name}", rows: ${ws.rowCount}`);

  const records: MajorRecord[] = [];
  const seenNames = new Set<string>();

  for (let rowIdx = 2; rowIdx <= ws.rowCount; rowIdx++) {
    const row = ws.getRow(rowIdx);

    const name = cellStr(row.getCell(4)); // 专业名称
    if (!name || seenNames.has(name)) continue;
    seenNames.add(name);

    const disciplineCategory = cellStr(row.getCell(1)); // 学科门类
    const majorCategory = cellStr(row.getCell(2)); // 专业类
    const majorCode = cellStr(row.getCell(5)); // 专业代码
    const durationStr = cellStr(row.getCell(6)); // 修业年限
    const duration = parseInt(durationStr.replace(/\D/g, ''), 10) || 4;
    const degree = cellStr(row.getCell(7)); // 授予学位
    const genderRatio = cellStr(row.getCell(11)) || null; // 性别比例
    const employmentRates = parseEmploymentRates(cellStr(row.getCell(12))); // 就业率
    const whatDesc = cellStr(row.getCell(13)) || null; // 专业是什么
    const studyDesc = cellStr(row.getCell(14)) || null; // 专业学什么
    const careerDesc = cellStr(row.getCell(15)) || null; // 专业干什么

    records.push({
      name,
      major_code: majorCode,
      category: disciplineCategory,
      discipline_category: majorCategory,
      duration,
      degree,
      gender_ratio: genderRatio,
      employment_rates: employmentRates,
      what_description: whatDesc,
      study_description: studyDesc,
      career_description: careerDesc,
      description: whatDesc,
    });
  }

  console.log(`  Parsed ${records.length} unique majors`);

  const dbRows = records.map((r) => ({
    name: r.name,
    major_code: r.major_code,
    category: r.category,
    discipline_category: r.discipline_category,
    duration: r.duration,
    degree: r.degree,
    gender_ratio: r.gender_ratio,
    employment_rates: r.employment_rates,
    what_description: r.what_description,
    study_description: r.study_description,
    career_description: r.career_description,
    description: r.description,
    data_source: 'excel',
    data_year: 2023,
  }));

  const result = await batchUpsert('majors', dbRows, 'name', 'Majors (basic)');
  console.log(`  [OK] Majors: ${result.inserted} inserted/updated, ${result.errors} errors`);

  return records;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Salary & Extended Major Importer (专业介绍及薪酬表.xlsx)
// ─────────────────────────────────────────────────────────────────────────────

async function importSalaryAndExtendedMajors(): Promise<number> {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  3/5  Importing Salary Data & Extended Major Info');
  console.log('═══════════════════════════════════════════════════════');

  const filePath = path.join(EXCEL_BASE, '3、专业介绍', '专业介绍及薪酬表.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.getWorksheet('Content') ?? wb.worksheets[0];
  console.log(`  Sheet: "${ws.name}", rows: ${ws.rowCount}`);

  const majorUpdateRows: Record<string, unknown>[] = [];
  const salaryRows: Record<string, unknown>[] = [];
  const seenMajors = new Set<string>();

  for (let rowIdx = 2; rowIdx <= ws.rowCount; rowIdx++) {
    const row = ws.getRow(rowIdx);

    const majorName = cellStr(row.getCell(5)); // 专业
    if (!majorName) continue;

    // Extended major info (update existing records)
    if (!seenMajors.has(majorName)) {
      seenMajors.add(majorName);

      const coreCourses = splitSpecialties(cellStr(row.getCell(16))); // 主要课程
      const graduatePaths = splitSpecialties(cellStr(row.getCell(15))); // 考研方向
      const certifications = splitSpecialties(cellStr(row.getCell(27))); // 职业资格证书
      const notableAlumni = splitSpecialties(cellStr(row.getCell(17))); // 社会名人
      const offeringSchoolsRaw = cellStr(row.getCell(25)); // 开设学校
      const offeringSchools = parseOfferingSchools(offeringSchoolsRaw);
      const maleRatio = cellStr(row.getCell(19)); // 男生比例
      const femaleRatio = cellStr(row.getCell(20)); // 女生比例
      const genderRatio = (maleRatio || femaleRatio)
        ? `男${maleRatio || '?'}:女${femaleRatio || '?'}`
        : null;
      const degree = cellStr(row.getCell(21)); // 学位
      const durationStr = cellStr(row.getCell(8)); // 年限
      const disciplineCategory = cellStr(row.getCell(1)); // 学科门类

      majorUpdateRows.push({
        name: majorName,
        category: disciplineCategory || '未分类', // Required NOT NULL field
        core_courses: coreCourses.length > 0 ? coreCourses : undefined,
        graduate_paths: graduatePaths.length > 0 ? graduatePaths : undefined,
        certifications: certifications.length > 0 ? certifications : undefined,
        notable_alumni: notableAlumni.length > 0 ? notableAlumni : undefined,
        offering_schools: offeringSchools.length > 0 ? offeringSchools : undefined,
        gender_ratio: genderRatio,
        degree: degree || undefined,
        data_source: 'excel_salary',
        data_year: 2023,
      });
    }

    // Salary data
    const salaryRaw = cellStr(row.getCell(9)); // 薪资
    const salaries = parseSalaryData(salaryRaw);
    for (const s of salaries) {
      salaryRows.push({
        major_name: majorName,
        year: s.year,
        avg_monthly_salary: s.salary,
        data_source: 'excel',
      });
    }
  }

  console.log(`  Parsed ${majorUpdateRows.length} majors with extended info`);
  console.log(`  Parsed ${salaryRows.length} salary data points`);

  // Update majors with extended info (upsert will add columns to existing rows)
  const majorResult = await batchUpsert(
    'majors',
    majorUpdateRows.filter((r) => {
      // Only include rows that have at least one non-name extended field
      return r.core_courses || r.graduate_paths || r.certifications ||
        r.notable_alumni || r.offering_schools || r.gender_ratio;
    }),
    'name',
    'Majors (extended)',
  );
  console.log(`  [OK] Majors extended: ${majorResult.inserted} updated, ${majorResult.errors} errors`);

  // Insert salary data
  const salaryResult = await batchUpsert(
    'major_salary_data',
    salaryRows,
    'major_name,year',
    'Salary data',
  );
  console.log(`  [OK] Salary: ${salaryResult.inserted} inserted, ${salaryResult.errors} errors`);

  return salaryResult.inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ranking Importer (2023软科排名总榜.xlsx)
// ─────────────────────────────────────────────────────────────────────────────

async function importRankings(): Promise<number> {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  4/5  Importing University Rankings');
  console.log('═══════════════════════════════════════════════════════');

  const filePath = path.join(EXCEL_BASE, '1、大学排名', '2023软科排名总榜.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.getWorksheet('软科2023排名') ?? wb.worksheets[0];
  console.log(`  Sheet: "${ws.name}", rows: ${ws.rowCount}`);

  const rows: Record<string, unknown>[] = [];

  for (let rowIdx = 2; rowIdx <= ws.rowCount; rowIdx++) {
    const row = ws.getRow(rowIdx);

    const universityName = cellStr(row.getCell(2)); // 学校名称
    if (!universityName) continue;

    const rank = cellNum(row.getCell(3)); // 排名
    const tagsRaw = cellStr(row.getCell(4)); // 院校标签 (e.g. "双一流/985/211")
    const type = cellStr(row.getCell(5)) || null; // 类型
    const region = cellStr(row.getCell(6)) || null; // 地区
    const scoreRaw = cellStr(row.getCell(7)); // 分数
    const score = scoreRaw ? parseFloat(scoreRaw) : null;

    const tags = tagsRaw ? tagsRaw.split('/').map((t) => t.trim()).filter(Boolean) : [];

    rows.push({
      university_name: universityName,
      source: 'ruanke',
      year: 2023,
      rank,
      score: score && !isNaN(score) ? score : null,
      tags,
      region,
      type,
    });
  }

  console.log(`  Parsed ${rows.length} ranking entries`);

  const result = await batchUpsert(
    'university_rankings',
    rows,
    'university_name,source,year',
    'Rankings',
  );
  console.log(`  [OK] Rankings: ${result.inserted} inserted, ${result.errors} errors`);

  return result.inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Discipline Evaluation Importer (全国第四轮学科评估.xlsx)
// ─────────────────────────────────────────────────────────────────────────────

async function importDisciplineEvaluations(): Promise<number> {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  5/5  Importing Discipline Evaluations');
  console.log('═══════════════════════════════════════════════════════');

  const filePath = path.join(EXCEL_BASE, '3、专业介绍', '全国第四轮学科评估.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.getWorksheet('全国第四轮学科评估') ?? wb.worksheets[0];
  console.log(`  Sheet: "${ws.name}", rows: ${ws.rowCount}`);

  const rows: Record<string, unknown>[] = [];

  for (let rowIdx = 2; rowIdx <= ws.rowCount; rowIdx++) {
    const row = ws.getRow(rowIdx);

    const disciplineName = cellStr(row.getCell(3)); // 专业类
    const universityName = cellStr(row.getCell(5)); // 学校名称
    let rating = cellStr(row.getCell(2)); // 评估结果

    if (!universityName || !disciplineName || !rating) continue;

    // Clean rating (may have trailing space or be "A " etc)
    rating = rating.trim();
    if (!rating) continue;

    rows.push({
      university_name: universityName.trim(),
      discipline_name: disciplineName,
      evaluation_round: '4',
      rating,
    });
  }

  console.log(`  Parsed ${rows.length} discipline evaluation entries`);

  const result = await batchUpsert(
    'discipline_evaluations',
    rows,
    'university_name,discipline_name,evaluation_round',
    'Discipline evaluations',
  );
  console.log(`  [OK] Discipline evals: ${result.inserted} inserted, ${result.errors} errors`);

  return result.inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch update helper (individual .update() calls to avoid nulling other fields)
// ─────────────────────────────────────────────────────────────────────────────

async function batchUpdateFK(
  table: string,
  updates: Array<{ id: string; university_id: string }>,
  label: string,
): Promise<number> {
  // Group by university_id to batch update using .in() filter
  const groups = new Map<string, string[]>();
  for (const u of updates) {
    if (!groups.has(u.university_id)) {
      groups.set(u.university_id, []);
    }
    groups.get(u.university_id)!.push(u.id);
  }

  let updated = 0;
  const totalGroups = groups.size;
  let processed = 0;

  for (const [uniId, ids] of groups) {
    const { error } = await db
      .from(table)
      .update({ university_id: uniId })
      .in('id', ids);
    if (error) {
      console.error(`  [ERR] ${label}: ${error.message}`);
    } else {
      updated += ids.length;
    }
    processed++;
    if (processed % 100 === 0 || processed === totalGroups) {
      console.log(`  ${label}: ${processed}/${totalGroups} groups (${updated} rows)`);
    }
  }

  return updated;
}

/** Fetch all universities (handles Supabase 1000-row pagination limit) */
async function fetchAllUniversities(): Promise<Array<{ id: string; name: string }>> {
  const allRows: Array<{ id: string; name: string }> = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await db
      .from('universities')
      .select('id, name')
      .range(offset, offset + pageSize - 1);

    if (error || !data) {
      console.error(`  [ERR] Fetching universities at offset ${offset}: ${error?.message}`);
      break;
    }

    allRows.push(...(data as Array<{ id: string; name: string }>));
    hasMore = data.length === pageSize;
    offset += pageSize;
  }

  return allRows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-processing: Link rankings to university IDs
// ─────────────────────────────────────────────────────────────────────────────

async function linkRankingsToUniversities(): Promise<number> {
  console.log('\n───────────────────────────────────────────────────────');
  console.log('  Post-processing: Linking rankings -> university_id FK');
  console.log('───────────────────────────────────────────────────────');

  const uniRows = await fetchAllUniversities();
  const nameToId = new Map<string, string>();
  for (const u of uniRows) {
    nameToId.set(u.name, u.id);
  }
  console.log(`  Loaded ${nameToId.size} universities for name matching`);

  // Fetch all rankings without university_id (paginated)
  const allRankings: Array<{ id: string; university_name: string }> = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await db
      .from('university_rankings')
      .select('id, university_name')
      .is('university_id', null)
      .range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    allRankings.push(...(data as Array<{ id: string; university_name: string }>));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`  Found ${allRankings.length} unlinked rankings`);

  const updates: Array<{ id: string; university_id: string }> = [];
  for (const r of allRankings) {
    const uniId = nameToId.get(r.university_name);
    if (uniId) {
      updates.push({ id: r.id, university_id: uniId });
    }
  }

  const updated = await batchUpdateFK('university_rankings', updates, 'Linking rankings');
  console.log(`  [OK] Linked ${updated}/${allRankings.length} ranking entries to university IDs`);
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-processing: Link discipline evaluations to university IDs
// ─────────────────────────────────────────────────────────────────────────────

async function linkDiscEvalsToUniversities(): Promise<number> {
  console.log('\n───────────────────────────────────────────────────────');
  console.log('  Post-processing: Linking discipline_evaluations -> university_id FK');
  console.log('───────────────────────────────────────────────────────');

  const uniRows = await fetchAllUniversities();
  const nameToId = new Map<string, string>();
  for (const u of uniRows) {
    nameToId.set(u.name, u.id);
  }
  console.log(`  Loaded ${nameToId.size} universities for name matching`);

  // Fetch all evaluations without university_id (paginated)
  const allEvals: Array<{ id: string; university_name: string }> = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await db
      .from('discipline_evaluations')
      .select('id, university_name')
      .is('university_id', null)
      .range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    allEvals.push(...(data as Array<{ id: string; university_name: string }>));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`  Found ${allEvals.length} unlinked evaluations`);

  const updates: Array<{ id: string; university_id: string }> = [];
  for (const e of allEvals) {
    const uniId = nameToId.get(e.university_name.trim());
    if (uniId) {
      updates.push({ id: e.id, university_id: uniId });
    }
  }

  const updated = await batchUpdateFK('discipline_evaluations', updates, 'Linking evaluations');
  console.log(`  [OK] Linked ${updated}/${allEvals.length} evaluations to university IDs`);
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge text generation
// ─────────────────────────────────────────────────────────────────────────────

async function generateKnowledgeTexts(universities: UniversityRecord[]): Promise<number> {
  console.log('\n───────────────────────────────────────────────────────');
  console.log('  Post-processing: Generating knowledge documents');
  console.log('───────────────────────────────────────────────────────');

  const docRows: Record<string, unknown>[] = [];

  for (const uni of universities) {
    const parts: string[] = [];

    // Basic info
    parts.push(
      `${uni.name}位于${uni.province}${uni.city}，是一所${uni.school_type || '综合'}类大学，${uni.tier}院校。`,
    );

    if (uni.founding_year) {
      parts.push(`建校于${uni.founding_year}年。`);
    }

    if (uni.master_programs > 0 || uni.doctoral_programs > 0) {
      parts.push(
        `拥有${uni.master_programs}个硕士点、${uni.doctoral_programs}个博士点。`,
      );
    }

    if (uni.national_specialties.length > 0) {
      const specs = uni.national_specialties.slice(0, 10).join('、');
      parts.push(`国家级特色专业包括${specs}${uni.national_specialties.length > 10 ? '等' : ''}。`);
    }

    // Discipline evaluation highlights
    const evalEntries = Object.entries(uni.discipline_evaluation);
    const topDiscs = evalEntries
      .filter(([, v]) => v.startsWith('A'))
      .sort(([, a], [, b]) => {
        const order = { 'A+': 0, A: 1, 'A-': 2 };
        return (order[a as keyof typeof order] ?? 9) - (order[b as keyof typeof order] ?? 9);
      })
      .slice(0, 5);

    if (topDiscs.length > 0) {
      const discText = topDiscs
        .map(([k, v]) => `${k.replace(/^\d+\s*/, '')}(${v})`)
        .join('、');
      parts.push(`学科评估优势学科：${discText}。`);
    }

    // Add original description if available (truncated for the document content)
    const fullContent = parts.join('') +
      (uni.description ? `\n\n${uni.description.substring(0, 2000)}` : '');

    docRows.push({
      title: `${uni.name}院校简介`,
      collection: 'general',
      content: fullContent,
      source_url: uni.website,
      metadata: {
        university_name: uni.name,
        province: uni.province,
        city: uni.city,
        tier: uni.tier,
        school_type: uni.school_type,
        generated_by: 'etl_pipeline',
      },
    });
  }

  console.log(`  Generated ${docRows.length} knowledge documents`);

  // Delete existing ETL-generated knowledge docs (cascade deletes chunks)
  console.log('  Cleaning up old ETL knowledge documents...');
  const { data: oldDocs } = await db
    .from('knowledge_documents')
    .select('id')
    .eq('collection', 'general')
    .eq('metadata->>generated_by', 'etl_pipeline');

  if (oldDocs && oldDocs.length > 0) {
    const oldIds = (oldDocs as Array<{ id: string }>).map((d) => d.id);
    // Delete chunks first
    await db.from('knowledge_chunks').delete().in('document_id', oldIds);
    // Delete documents
    await db.from('knowledge_documents').delete().in('id', oldIds);
    console.log(`  Deleted ${oldIds.length} old knowledge documents and their chunks`);
  }

  // Insert knowledge documents (plain INSERT, no upsert needed)
  let docInserted = 0;
  let docErrors = 0;
  const totalDocBatches = Math.ceil(docRows.length / BATCH_SIZE);
  for (let i = 0; i < docRows.length; i += BATCH_SIZE) {
    const batch = docRows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const { error } = await (db.from('knowledge_documents') as any).insert(batch);
    if (error) {
      docErrors++;
      console.error(`  [ERR] Knowledge docs batch ${batchNum}/${totalDocBatches}: ${error.message}`);
    } else {
      docInserted += batch.length;
    }
    if (batchNum % 10 === 0 || batchNum === totalDocBatches) {
      console.log(`  Knowledge docs: batch ${batchNum}/${totalDocBatches} done (${docInserted} rows)`);
    }
  }
  console.log(`  [OK] Knowledge docs: ${docInserted} inserted, ${docErrors} errors`);

  // Create knowledge chunks (split by paragraph)
  const chunkRows: Record<string, unknown>[] = [];

  // Fetch the created document IDs
  const { data: docs, error: docFetchErr } = await db
    .from('knowledge_documents')
    .select('id, title, content')
    .eq('collection', 'general')
    .eq('metadata->>generated_by', 'etl_pipeline');

  if (docFetchErr || !docs) {
    console.error(`  [ERR] Failed to fetch knowledge docs for chunking: ${docFetchErr?.message}`);
    return docInserted;
  }

  for (const doc of docs as Array<{ id: string; title: string; content: string }>) {
    // Split content into chunks of ~500 chars
    const text = doc.content;
    const chunkSize = 500;
    let idx = 0;

    for (let offset = 0; offset < text.length; offset += chunkSize) {
      const chunk = text.substring(offset, offset + chunkSize);
      if (chunk.trim().length < 20) continue; // Skip tiny fragments

      chunkRows.push({
        document_id: doc.id,
        chunk_index: idx++,
        content: chunk,
        metadata: { university_name: doc.title.replace('院校简介', '') },
      });
    }
  }

  if (chunkRows.length > 0) {
    const chunkResult = await batchUpsert(
      'knowledge_chunks',
      chunkRows,
      'document_id,chunk_index',
      'Knowledge chunks',
    );
    console.log(`  [OK] Knowledge chunks: ${chunkResult.inserted} inserted, ${chunkResult.errors} errors`);
  }

  return docInserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();

  console.log('========================================================');
  console.log('  Zhidu ETL Pipeline: Excel -> Supabase');
  console.log('========================================================');
  console.log('');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  Auth mode:    ${usingServiceRole ? 'service_role (full access)' : 'anon key (RLS may block writes)'}`);
  console.log(`  Excel base:   ${EXCEL_BASE}`);
  console.log(`  Batch size:   ${BATCH_SIZE}`);

  if (!usingServiceRole) {
    console.log('');
    console.log('  WARNING: No SUPABASE_SERVICE_ROLE_KEY found.');
    console.log('  Writes to RLS-protected tables may fail.');
    console.log('  Set SUPABASE_SERVICE_ROLE_KEY env var for full access.');
  }

  // Check Excel base directory exists
  if (!fs.existsSync(EXCEL_BASE)) {
    console.error(`\n[FATAL] Excel base directory not found: ${EXCEL_BASE}`);
    process.exit(1);
  }

  // ── Step 1: Import universities ──
  const universities = await importUniversities();

  // ── Step 2: Import majors (basic info) ──
  await importMajorsBasic();

  // ── Step 3: Import salary data & extended major info ──
  await importSalaryAndExtendedMajors();

  // ── Step 4: Import rankings ──
  await importRankings();

  // ── Step 5: Import discipline evaluations ──
  await importDisciplineEvaluations();

  // ── Post-processing ──
  console.log('\n========================================================');
  console.log('  Post-processing');
  console.log('========================================================');

  await linkRankingsToUniversities();
  await linkDiscEvalsToUniversities();
  await generateKnowledgeTexts(universities);

  // ── Summary ──
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n========================================================');
  console.log('  ETL Pipeline Complete!');
  console.log('========================================================');
  console.log(`  Duration: ${elapsed}s`);
  console.log(`  Universities imported: ${universities.length}`);
  console.log('');
}

main().catch((err) => {
  console.error('[FATAL] ETL pipeline failed:', err);
  process.exit(1);
});
