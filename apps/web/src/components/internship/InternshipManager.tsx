'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  ChevronDown,
  ChevronUp,
  Calendar,
  Edit3,
  Trash2,
  Check,
  X,
  Clock,
  TrendingUp,
  Award,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Internship {
  id: string;
  userId: string;
  company: string;
  role: string;
  description?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
}

interface InternshipFormData {
  company: string;
  role: string;
  description: string;
  startDate: string;
  endDate: string;
  current: boolean;
}

const EMPTY_FORM: InternshipFormData = {
  company: '',
  role: '',
  description: '',
  startDate: '',
  endDate: '',
  current: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function calcMonths(start: string, end?: string, current?: boolean): number {
  if (!start) return 0;
  const s = new Date(start);
  const e = current ? new Date() : end ? new Date(end) : s;
  const diff =
    (e.getFullYear() - s.getFullYear()) * 12 +
    (e.getMonth() - s.getMonth()) +
    1;
  return Math.max(diff, 1);
}

function totalExperienceMonths(internships: Internship[]): number {
  return internships.reduce(
    (acc, i) => acc + calcMonths(i.startDate, i.endDate, i.current),
    0,
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatsBar({ internships }: { internships: Internship[] }) {
  const total = internships.length;
  const current = internships.filter((i) => i.current).length;
  const months = totalExperienceMonths(internships);

  const stats = [
    {
      label: '实习总数',
      value: total,
      icon: Briefcase,
      color: 'text-navy',
      bg: 'bg-navy/10',
    },
    {
      label: '进行中',
      value: current,
      icon: Clock,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '累计月数',
      value: months,
      suffix: '个月',
      icon: TrendingUp,
      color: 'text-blue',
      bg: 'bg-blue/10',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.bg}`}
          >
            <s.icon className={`h-4 w-4 ${s.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-tertiary">{s.label}</p>
            <p className="text-lg font-bold text-text-primary">
              {s.value}
              {s.suffix ? (
                <span className="ml-0.5 text-xs font-normal text-text-tertiary">
                  {s.suffix}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add / Edit form
// ---------------------------------------------------------------------------

function InternshipForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
}: {
  initial?: InternshipFormData;
  onSubmit: (data: InternshipFormData) => void;
  onCancel?: () => void;
  loading: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<InternshipFormData>(
    initial ?? { ...EMPTY_FORM },
  );

  const set = <K extends keyof InternshipFormData>(
    key: K,
    val: InternshipFormData[K],
  ) => setForm((f) => ({ ...f, [key]: val }));

  const handleCurrentToggle = (checked: boolean) => {
    set('current', checked);
    if (checked) set('endDate', '');
  };

  const canSubmit =
    form.company.trim() !== '' &&
    form.role.trim() !== '' &&
    form.startDate !== '';

  return (
    <div className="space-y-4">
      {/* Row 1: company + role */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            公司名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => set('company', e.target.value)}
            placeholder="例如: 字节跳动"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-navy focus:ring-1 focus:ring-navy/30"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            岗位 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            placeholder="例如: 前端开发实习生"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-navy focus:ring-1 focus:ring-navy/30"
          />
        </div>
      </div>

      {/* Row 2: dates */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            开始日期 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-navy focus:ring-1 focus:ring-navy/30"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-medium text-text-secondary">
              结束日期
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={form.current}
                onChange={(e) => handleCurrentToggle(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border accent-navy"
              />
              至今
            </label>
          </div>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => set('endDate', e.target.value)}
            disabled={form.current}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-navy focus:ring-1 focus:ring-navy/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {/* Row 3: description */}
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">
          描述
        </label>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="简述工作内容、项目经历、收获等..."
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-navy focus:ring-1 focus:ring-navy/30"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSubmit(form)}
          disabled={!canSubmit || loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-background"
          >
            <X className="h-4 w-4" />
            取消
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline card
// ---------------------------------------------------------------------------

function TimelineCard({
  internship,
  onEdit,
  onDelete,
}: {
  internship: Internship;
  onEdit: (i: Internship) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const duration = calcMonths(
    internship.startDate,
    internship.endDate,
    internship.current,
  );

  return (
    <div
      className="group relative flex gap-4"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setConfirmDelete(false);
      }}
    >
      {/* Timeline rail */}
      <div className="flex flex-col items-center">
        <div
          className={`relative z-10 flex h-3 w-3 shrink-0 rounded-full border-2 ${
            internship.current
              ? 'border-green-500 bg-green-500'
              : 'border-navy bg-surface'
          }`}
        >
          {internship.current && (
            <span className="absolute -inset-1 animate-ping rounded-full bg-green-400 opacity-30" />
          )}
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>

      {/* Card */}
      <div className="mb-6 min-w-0 flex-1 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-navy/20">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-text-primary">
                {internship.company}
              </h3>
              {internship.current && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  进行中
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-text-secondary">
              {internship.role}
            </p>
          </div>

          {/* Actions */}
          <div
            className={`flex shrink-0 items-center gap-1 transition-opacity ${
              hovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {!confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(internship)}
                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-background hover:text-navy"
                  title="编辑"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-red-50 hover:text-red-500"
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onDelete(internship.id)}
                  className="rounded-md bg-red-500 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-600"
                >
                  确认删除
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-background"
                >
                  取消
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(internship.startDate)} &ndash;{' '}
            {internship.current ? '至今' : internship.endDate ? formatDate(internship.endDate) : '未知'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {duration} 个月
          </span>
        </div>

        {/* Description */}
        {internship.description && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
            {internship.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy/10">
        <Briefcase className="h-6 w-6 text-navy" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-text-primary">
        暂无实习经历
      </h3>
      <p className="mt-1 max-w-xs text-center text-sm text-text-tertiary">
        点击上方「添加实习」按钮，记录你的第一段实习经历
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function InternshipManager() {
  // State
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form visibility
  const [showAddForm, setShowAddForm] = useState(false);

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<InternshipFormData | null>(
    null,
  );

  // ---- Data fetching ----

  const fetchInternships = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/internship');
      if (!res.ok) throw new Error('请求失败');
      const json = await res.json();
      setInternships(json.data ?? []);
    } catch {
      setError('加载实习经历失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchInternships();
  }, [fetchInternships]);

  // ---- CRUD operations ----

  const handleCreate = useCallback(
    async (data: InternshipFormData) => {
      setSubmitting(true);
      try {
        const res = await fetch('/api/internship', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company: data.company.trim(),
            role: data.role.trim(),
            description: data.description.trim() || undefined,
            startDate: data.startDate,
            endDate: data.current ? undefined : data.endDate || undefined,
            current: data.current,
          }),
        });
        if (!res.ok) throw new Error('创建失败');
        setShowAddForm(false);
        await fetchInternships();
      } catch {
        setError('创建失败，请重试');
      } finally {
        setSubmitting(false);
      }
    },
    [fetchInternships],
  );

  const handleUpdate = useCallback(
    async (data: InternshipFormData) => {
      if (!editingId) return;
      setSubmitting(true);
      try {
        const res = await fetch(`/api/internship/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company: data.company.trim(),
            role: data.role.trim(),
            description: data.description.trim() || undefined,
            startDate: data.startDate,
            endDate: data.current ? undefined : data.endDate || undefined,
            current: data.current,
          }),
        });
        if (!res.ok) throw new Error('更新失败');
        setEditingId(null);
        setEditingForm(null);
        await fetchInternships();
      } catch {
        setError('更新失败，请重试');
      } finally {
        setSubmitting(false);
      }
    },
    [editingId, fetchInternships],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/internship/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('删除失败');
        await fetchInternships();
      } catch {
        setError('删除失败，请重试');
      }
    },
    [fetchInternships],
  );

  const startEdit = useCallback((i: Internship) => {
    setEditingId(i.id);
    setEditingForm({
      company: i.company,
      role: i.role,
      description: i.description ?? '',
      startDate: i.startDate,
      endDate: i.endDate ?? '',
      current: i.current,
    });
    // Scroll to top so the user sees the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingForm(null);
  }, []);

  // ---- Sorted internships ----

  const sortedInternships = useMemo(
    () =>
      [...internships].sort((a, b) => {
        // Current internships first, then by start_date desc
        if (a.current && !b.current) return -1;
        if (!a.current && b.current) return 1;
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      }),
    [internships],
  );

  // ---- Render ----

  return (
    <div className="space-y-5">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats bar */}
      {!loading && internships.length > 0 && (
        <StatsBar internships={internships} />
      )}

      {/* Add form (collapsible) */}
      <div className="rounded-xl border border-border bg-surface">
        {/* Toggle header */}
        <button
          type="button"
          onClick={() => {
            setShowAddForm((v) => !v);
            if (editingId) cancelEdit();
          }}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface-elevated"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/10">
              <Plus className="h-4 w-4 text-navy" />
            </div>
            <span className="text-sm font-semibold text-text-primary">
              添加实习
            </span>
          </div>
          {showAddForm ? (
            <ChevronUp className="h-4 w-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-tertiary" />
          )}
        </button>

        {/* Form body */}
        {showAddForm && (
          <div className="border-t border-border px-5 py-4">
            <InternshipForm
              onSubmit={handleCreate}
              onCancel={() => setShowAddForm(false)}
              loading={submitting}
              submitLabel="保存"
            />
          </div>
        )}
      </div>

      {/* Edit form (shown when editing) */}
      {editingId && editingForm && (
        <div className="rounded-xl border border-navy/30 bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Edit3 className="h-4 w-4 text-navy" />
            <span className="text-sm font-semibold text-text-primary">
              编辑实习经历
            </span>
          </div>
          <div className="px-5 py-4">
            <InternshipForm
              initial={editingForm}
              onSubmit={handleUpdate}
              onCancel={cancelEdit}
              loading={submitting}
              submitLabel="更新"
            />
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-navy" />
            <span className="ml-2 text-sm text-text-tertiary">加载中...</span>
          </div>
        ) : sortedInternships.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="relative">
            {/* Section heading */}
            <div className="mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-navy" />
              <h2 className="text-sm font-semibold text-text-primary">
                实习经历
              </h2>
              <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy">
                {internships.length}
              </span>
            </div>

            {/* Timeline entries */}
            <div>
              {sortedInternships.map((internship) => (
                <TimelineCard
                  key={internship.id}
                  internship={internship}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
