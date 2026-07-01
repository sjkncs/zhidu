// @zhidu/db — 课程、学期、学业统计

import { getDb } from '../utils';
import type { CourseRow, SemesterRow, AcademicSummaryRow } from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// Course 课程管理
// ─────────────────────────────────────────────────────────────────────────────

export async function createCourse(userId: string, course: {
  name: string;
  credit: number;
  grade?: number;
  gradePoint?: number;
  semester?: string;
  category?: string;
  teacher?: string;
  notes?: string;
}): Promise<CourseRow | null> {
  try {
    const row: Record<string, any> = {
      user_id: userId,
      name: course.name,
      credit: course.credit,
      category: course.category ?? '必修',
    };
    if (course.grade !== undefined) row.grade = course.grade;
    if (course.gradePoint !== undefined) row.grade_point = course.gradePoint;
    if (course.semester) row.semester = course.semester;
    if (course.teacher) row.teacher = course.teacher;
    if (course.notes) row.notes = course.notes;

    const { data, error } = await getDb()
      .from('courses')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('[createCourse]', error.message); return null; }
    return mapCourse(data);
  } catch (err) {
    console.error('[createCourse]', err);
    return null;
  }
}

export async function getUserCourses(userId: string, filters?: {
  semester?: string;
  category?: string;
}): Promise<CourseRow[]> {
  try {
    let query = getDb()
      .from('courses')
      .select('*')
      .eq('user_id', userId);
    if (filters?.semester) query = query.eq('semester', filters.semester);
    if (filters?.category) query = query.eq('category', filters.category);
    const { data, error } = await query
      .order('semester', { ascending: false })
      .order('name', { ascending: true });
    if (error) { console.error('[getUserCourses]', error.message); return []; }
    return (data ?? []).map(mapCourse);
  } catch (err) {
    console.error('[getUserCourses]', err);
    return [];
  }
}

export async function updateCourse(id: string, updates: {
  name?: string;
  credit?: number;
  grade?: number;
  gradePoint?: number;
  semester?: string;
  category?: string;
  teacher?: string;
  notes?: string;
}): Promise<CourseRow | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.credit !== undefined) dbUpdates.credit = updates.credit;
    if (updates.grade !== undefined) dbUpdates.grade = updates.grade;
    if (updates.gradePoint !== undefined) dbUpdates.grade_point = updates.gradePoint;
    if (updates.semester !== undefined) dbUpdates.semester = updates.semester;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.teacher !== undefined) dbUpdates.teacher = updates.teacher;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    const { data, error } = await getDb()
      .from('courses')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateCourse]', error.message); return null; }
    return mapCourse(data);
  } catch (err) {
    console.error('[updateCourse]', err);
    return null;
  }
}

export async function deleteCourse(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('courses').delete().eq('id', id);
    if (error) { console.error('[deleteCourse]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteCourse]', err);
    return false;
  }
}

function mapCourse(row: any): CourseRow {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    credit: Number(row.credit) || 0,
    grade: row.grade != null ? Number(row.grade) : undefined,
    gradePoint: row.grade_point != null ? Number(row.grade_point) : undefined,
    semester: row.semester,
    category: row.category,
    teacher: row.teacher,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Semester 学期管理
// ─────────────────────────────────────────────────────────────────────────────

export async function createSemester(userId: string, semester: {
  name: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
}): Promise<SemesterRow | null> {
  try {
    // If setting as current, unset others first
    if (semester.isCurrent) {
      await getDb()
        .from('semesters')
        .update({ is_current: false })
        .eq('user_id', userId);
    }

    const row: Record<string, any> = {
      user_id: userId,
      name: semester.name,
      is_current: semester.isCurrent ?? false,
    };
    if (semester.startDate) row.start_date = semester.startDate;
    if (semester.endDate) row.end_date = semester.endDate;

    const { data, error } = await getDb()
      .from('semesters')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('[createSemester]', error.message); return null; }
    return mapSemester(data);
  } catch (err) {
    console.error('[createSemester]', err);
    return null;
  }
}

export async function getUserSemesters(userId: string): Promise<SemesterRow[]> {
  try {
    const { data, error } = await getDb()
      .from('semesters')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false });
    if (error) { console.error('[getUserSemesters]', error.message); return []; }
    return (data ?? []).map(mapSemester);
  } catch (err) {
    console.error('[getUserSemesters]', err);
    return [];
  }
}

export async function getCurrentSemester(userId: string): Promise<SemesterRow | null> {
  try {
    const { data, error } = await getDb()
      .from('semesters')
      .select('*')
      .eq('user_id', userId)
      .eq('is_current', true)
      .maybeSingle();
    if (error) { console.error('[getCurrentSemester]', error.message); return null; }
    return data ? mapSemester(data) : null;
  } catch (err) {
    console.error('[getCurrentSemester]', err);
    return null;
  }
}

export async function updateSemester(id: string, updates: {
  name?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  userId?: string;
}): Promise<SemesterRow | null> {
  try {
    // If setting as current, unset others first
    if (updates.isCurrent && updates.userId) {
      await getDb()
        .from('semesters')
        .update({ is_current: false })
        .eq('user_id', updates.userId);
    }

    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.isCurrent !== undefined) dbUpdates.is_current = updates.isCurrent;

    const { data, error } = await getDb()
      .from('semesters')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateSemester]', error.message); return null; }
    return mapSemester(data);
  } catch (err) {
    console.error('[updateSemester]', err);
    return null;
  }
}

export async function deleteSemester(id: string): Promise<boolean> {
  try {
    const { error } = await getDb().from('semesters').delete().eq('id', id);
    if (error) { console.error('[deleteSemester]', error.message); return false; }
    return true;
  } catch (err) {
    console.error('[deleteSemester]', err);
    return false;
  }
}

function mapSemester(row: any): SemesterRow {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Academic Summary 学业统计（调用 calculate_gpa SQL 函数）
// ─────────────────────────────────────────────────────────────────────────────

export async function getAcademicSummary(
  userId: string,
  semester?: string,
): Promise<AcademicSummaryRow | null> {
  try {
    const { data, error } = await getDb()
      .rpc('calculate_gpa', {
        p_user_id: userId,
        p_semester: semester ?? null,
      });
    if (error) { console.error('[getAcademicSummary]', error.message); return null; }
    // RPC returns array of rows
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      gpa: Number(row.gpa) || 0,
      weightedAvg: Number(row.weighted_avg) || 0,
      totalCredits: Number(row.total_credits) || 0,
      earnedCredits: Number(row.earned_credits) || 0,
      courseCount: Number(row.course_count) || 0,
    };
  } catch (err) {
    console.error('[getAcademicSummary]', err);
    return null;
  }
}

/** 获取各学期 GPA 趋势 */
export async function getGpaBySemester(userId: string): Promise<Array<{
  semester: string;
  gpa: number;
  weightedAvg: number;
  courseCount: number;
  totalCredits: number;
}>> {
  try {
    // Get distinct semesters
    const { data: semesters, error: semErr } = await getDb()
      .from('courses')
      .select('semester')
      .eq('user_id', userId)
      .not('semester', 'is', null)
      .order('semester', { ascending: true });
    if (semErr) { console.error('[getGpaBySemester]', semErr.message); return []; }

    const uniqueSemesters = [...new Set((semesters ?? []).map((s: any) => s.semester).filter(Boolean))];

    const results: Array<{
      semester: string;
      gpa: number;
      weightedAvg: number;
      courseCount: number;
      totalCredits: number;
    }> = [];

    for (const sem of uniqueSemesters) {
      const summary = await getAcademicSummary(userId, sem);
      if (summary) {
        results.push({
          semester: sem,
          gpa: summary.gpa,
          weightedAvg: summary.weightedAvg,
          courseCount: summary.courseCount,
          totalCredits: summary.totalCredits,
        });
      }
    }

    return results;
  } catch (err) {
    console.error('[getGpaBySemester]', err);
    return [];
  }
}

/** 获取课程类别分布统计 */
export async function getCourseCategoryStats(userId: string): Promise<Array<{
  category: string;
  count: number;
  totalCredits: number;
  avgGrade: number;
}>> {
  try {
    const { data, error } = await getDb()
      .from('courses')
      .select('category, credit, grade')
      .eq('user_id', userId);
    if (error) { console.error('[getCourseCategoryStats]', error.message); return []; }

    const courses = data ?? [];
    const grouped: Record<string, { count: number; credits: number; gradeSum: number; gradeCount: number }> = {};

    for (const c of courses) {
      const cat = (c as any).category || '其他';
      if (!grouped[cat]) grouped[cat] = { count: 0, credits: 0, gradeSum: 0, gradeCount: 0 };
      grouped[cat].count++;
      grouped[cat].credits += Number((c as any).credit) || 0;
      if ((c as any).grade != null) {
        grouped[cat].gradeSum += Number((c as any).grade);
        grouped[cat].gradeCount++;
      }
    }

    return Object.entries(grouped).map(([category, stats]) => ({
      category,
      count: stats.count,
      totalCredits: stats.credits,
      avgGrade: stats.gradeCount > 0 ? Math.round(stats.gradeSum / stats.gradeCount) : 0,
    }));
  } catch (err) {
    console.error('[getCourseCategoryStats]', err);
    return [];
  }
}
