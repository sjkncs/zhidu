'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  Loader2,
  BookOpen,
  Filter,
  ChevronDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Course {
  id: string;
  userId: string;
  name: string;
  credit: number;
  grade?: number;
  gradePoint?: number;
  semester?: string;
  category: string;
  teacher?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Semester {
  id: string;
  userId: string;
  name: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
}

interface CourseFormData {
  name: string;
  credit: string;
  grade: string;
  semester: string;
  category: string;
  teacher: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = ['必修', '选修', '公选', '体育', '通识'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  '必修': 'bg-blue/10 text-blue',
  '选修': 'bg-emerald-500/10 text-emerald-600',
  '公选': 'bg-amber-500/10 text-amber-600',
  '体育': 'bg-rose-500/10 text-rose-600',
  '通识': 'bg-purple-500/10 text-purple-600',
};

const EMPTY_FORM: CourseFormData = {
  name: '',
  credit: '',
  grade: '',
  semester: '',
  category: '必修',
  teacher: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreToGradePoint(score: number): number {
  if (score >= 90) return 4.0;
  if (score >= 85) return 3.7;
  if (score >= 82) return 3.3;
  if (score >= 78) return 3.0;
  if (score >= 75) return 2.7;
  if (score >= 72) return 2.3;
  if (score >= 68) return 2.0;
  if (score >= 64) return 1.5;
  if (score >= 60) return 1.0;
  return 0;
}

function gradeLabel(grade?: number, gradePoint?: number): string {
  if (grade != null) return `${grade}分`;
  if (gradePoint != null) return `${gradePoint.toFixed(1)}绩点`;
  return '-';
}

function gradeColor(grade?: number): string {
  if (grade == null) return 'text-text-tertiary';
  if (grade >= 90) return 'text-emerald-600';
  if (grade >= 80) return 'text-blue';
  if (grade >= 70) return 'text-amber-600';
  if (grade >= 60) return 'text-orange-500';
  return 'text-red-500';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CourseManager({
  semesters,
  onSemesterCreated,
}: {
  semesters: Semester[];
  onSemesterCreated?: (s: Semester) => void;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseFormData>(EMPTY_FORM);
  const [filterSemester, setFilterSemester] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSemesterForm, setShowSemesterForm] = useState(false);
  const [newSemesterName, setNewSemesterName] = useState('');

  // ─── Fetch courses ───
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSemester) params.set('semester', filterSemester);
      if (filterCategory) params.set('category', filterCategory);
      const res = await fetch(`/api/courses?${params}`);
      if (res.ok) {
        const json = await res.json();
        setCourses(json.data ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filterSemester, filterCategory]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // ─── Form handlers ───
  const resetForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (course: Course) => {
    setForm({
      name: course.name,
      credit: String(course.credit),
      grade: course.grade != null ? String(course.grade) : '',
      semester: course.semester ?? '',
      category: course.category,
      teacher: course.teacher ?? '',
      notes: course.notes ?? '',
    });
    setEditingId(course.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.credit) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      credit: parseFloat(form.credit) || 0,
      grade: form.grade ? parseFloat(form.grade) : undefined,
      semester: form.semester || undefined,
      category: form.category,
      teacher: form.teacher || undefined,
      notes: form.notes || undefined,
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/courses/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const json = await res.json();
          setCourses((prev) => prev.map((c) => (c.id === editingId ? json.data : c)));
        }
      } else {
        const res = await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const json = await res.json();
          setCourses((prev) => [json.data, ...prev]);
        }
      }
      resetForm();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCourses((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      // silently fail
    }
  };

  const handleAddSemester = async () => {
    if (!newSemesterName.trim()) return;
    try {
      const res = await fetch('/api/semesters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSemesterName.trim(), isCurrent: semesters.length === 0 }),
      });
      if (res.ok) {
        const json = await res.json();
        onSemesterCreated?.(json.data);
        setNewSemesterName('');
        setShowSemesterForm(false);
      }
    } catch {
      // silently fail
    }
  };

  // ─── Derived state ───
  const uniqueSemesters = [...new Set(courses.map((c) => c.semester).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Semester filter */}
        <div className="relative">
          <select
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            className="appearance-none rounded-lg border border-border bg-surface py-2 pl-3 pr-8 text-sm text-text-primary focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
          >
            <option value="">全部学期</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}{s.isCurrent ? ' (当前)' : ''}
              </option>
            ))}
            {uniqueSemesters
              .filter((s) => !semesters.some((sem) => sem.name === s))
              .map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="appearance-none rounded-lg border border-border bg-surface py-2 pl-3 pr-8 text-sm text-text-primary focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
          >
            <option value="">全部类别</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        </div>

        <div className="flex-1" />

        {/* Manage semesters */}
        <button
          onClick={() => setShowSemesterForm(!showSemesterForm)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-elevated"
        >
          <Filter className="h-4 w-4" />
          学期管理
        </button>

        {/* Add course */}
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue/90"
        >
          <Plus className="h-4 w-4" />
          添加课程
        </button>
      </div>

      {/* Semester creation form */}
      {showSemesterForm && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <input
            type="text"
            placeholder="学期名称（如 2025-2026 第一学期）"
            value={newSemesterName}
            onChange={(e) => setNewSemesterName(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
          />
          <button
            onClick={handleAddSemester}
            disabled={!newSemesterName.trim()}
            className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue/90 disabled:opacity-50"
          >
            创建
          </button>
          <button
            onClick={() => setShowSemesterForm(false)}
            className="rounded-lg p-2 text-text-secondary hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-surface p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-text-primary">
            {editingId ? '编辑课程' : '添加课程'}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Name */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                课程名称 *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如：高等数学"
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
              />
            </div>

            {/* Credit */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                学分 *
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.credit}
                onChange={(e) => setForm((f) => ({ ...f, credit: e.target.value }))}
                placeholder="如：4"
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
              />
            </div>

            {/* Grade */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                成绩（百分制）
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.grade}
                onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                placeholder="如：85"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
              />
              {form.grade && (
                <p className="mt-1 text-xs text-text-tertiary">
                  对应绩点: {scoreToGradePoint(parseFloat(form.grade) || 0).toFixed(1)}
                </p>
              )}
            </div>

            {/* Semester */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                学期
              </label>
              <select
                value={form.semester}
                onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
                className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-blue focus:outline-none"
              >
                <option value="">未选择</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                类别
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-blue focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Teacher */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                教师
              </label>
              <input
                type="text"
                value={form.teacher}
                onChange={(e) => setForm((f) => ({ ...f, teacher: e.target.value }))}
                placeholder="如：张教授"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              备注
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="可选备注..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-elevated"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingId ? '保存修改' : '添加'}
            </button>
          </div>
        </form>
      )}

      {/* Course list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <BookOpen className="mb-3 h-12 w-12 text-text-tertiary/40" />
          <p className="text-sm text-text-secondary">暂无课程记录</p>
          <p className="mt-1 text-xs text-text-tertiary">
            点击"添加课程"开始记录你的学业成绩
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-elevated">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">课程</th>
                <th className="px-4 py-3 text-center font-medium text-text-secondary">学分</th>
                <th className="px-4 py-3 text-center font-medium text-text-secondary">成绩</th>
                <th className="px-4 py-3 text-center font-medium text-text-secondary">绩点</th>
                <th className="hidden px-4 py-3 text-left font-medium text-text-secondary sm:table-cell">类别</th>
                <th className="hidden px-4 py-3 text-left font-medium text-text-secondary md:table-cell">学期</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr
                  key={course.id}
                  className="border-b border-border last:border-0 transition hover:bg-surface-elevated/50"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-text-primary">{course.name}</p>
                      {course.teacher && (
                        <p className="text-xs text-text-tertiary">{course.teacher}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-text-primary">
                    {course.credit}
                  </td>
                  <td className={`px-4 py-3 text-center font-medium ${gradeColor(course.grade)}`}>
                    {gradeLabel(course.grade)}
                  </td>
                  <td className="px-4 py-3 text-center text-text-primary">
                    {course.gradePoint != null ? course.gradePoint.toFixed(1) : '-'}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[course.category] ?? 'bg-gray-500/10 text-gray-500'}`}>
                      {course.category}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                    {course.semester ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(course)}
                        className="rounded-md p-1.5 text-text-tertiary transition hover:bg-surface-elevated hover:text-text-primary"
                        title="编辑"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(course.id)}
                        className="rounded-md p-1.5 text-text-tertiary transition hover:bg-red-500/10 hover:text-red-500"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
