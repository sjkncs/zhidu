'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Microscope,
  User,
  Calendar,
  CalendarRange,
  FileText,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Save,
  BarChart3,
  BookOpen,
  FlaskConical,
  GraduationCap,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResearchProject {
  id: string;
  userId: string;
  title: string;
  role: string;
  description?: string;
  advisor?: string;
  startDate: string;
  endDate?: string;
  status: 'ONGOING' | 'COMPLETED';
}

type FilterTab = 'ALL' | 'ONGOING' | 'COMPLETED';

interface FormData {
  title: string;
  role: string;
  advisor: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'ONGOING' | 'COMPLETED';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_FORM: FormData = {
  title: '',
  role: '',
  advisor: '',
  description: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  status: 'ONGOING',
};

const ROLE_SUGGESTIONS = [
  '研究员',
  '负责人',
  '助理研究员',
  '实验员',
  '数据分析员',
  '论文第一作者',
  '论文通讯作者',
  '项目顾问',
];

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'ONGOING', label: '进行中' },
  { key: 'COMPLETED', label: '已完成' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResearchManager() {
  // ── State ──────────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filter
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  // Expanded card
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Fetch Projects ─────────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        activeTab === 'ALL'
          ? '/api/research'
          : `/api/research?status=${activeTab}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('请求失败');
      const json = await res.json();
      setProjects(json.data ?? []);
    } catch (err) {
      console.error('[ResearchManager] fetch error:', err);
      setError('加载科研项目失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ── Submit (Create / Update) ───────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title.trim() || !formData.role.trim() || !formData.startDate) {
        setError('请填写项目名称、角色和开始日期');
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        if (editingId) {
          // Update
          const res = await fetch(`/api/research/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: formData.title.trim(),
              role: formData.role.trim(),
              advisor: formData.advisor.trim() || undefined,
              description: formData.description.trim() || undefined,
              startDate: formData.startDate,
              endDate: formData.endDate || undefined,
              status: formData.status,
            }),
          });
          if (!res.ok) throw new Error('更新失败');
        } else {
          // Create
          const res = await fetch('/api/research', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: formData.title.trim(),
              role: formData.role.trim(),
              advisor: formData.advisor.trim() || undefined,
              description: formData.description.trim() || undefined,
              startDate: formData.startDate,
              endDate: formData.endDate || undefined,
              status: formData.status,
            }),
          });
          if (!res.ok) throw new Error('创建失败');
        }

        // Reset form
        setFormData(EMPTY_FORM);
        setEditingId(null);
        setShowForm(false);
        await fetchProjects();
      } catch (err) {
        console.error('[ResearchManager] submit error:', err);
        setError(editingId ? '更新项目失败' : '创建项目失败');
      } finally {
        setSubmitting(false);
      }
    },
    [formData, editingId, fetchProjects],
  );

  // ── Edit ───────────────────────────────────────────────────────────────
  const handleEdit = useCallback((project: ResearchProject) => {
    setEditingId(project.id);
    setFormData({
      title: project.title,
      role: project.role,
      advisor: project.advisor ?? '',
      description: project.description ?? '',
      startDate: project.startDate?.slice(0, 10) ?? '',
      endDate: project.endDate?.slice(0, 10) ?? '',
      status: project.status,
    });
    setShowForm(true);
    setExpandedId(null);
  }, []);

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/research/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('删除失败');
        setDeletingId(null);
        setExpandedId(null);
        await fetchProjects();
      } catch (err) {
        console.error('[ResearchManager] delete error:', err);
        setError('删除项目失败');
      }
    },
    [fetchProjects],
  );

  // ── Cancel editing ─────────────────────────────────────────────────────
  const handleCancelForm = useCallback(() => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }, []);

  // ── Form field change ─────────────────────────────────────────────────
  const handleFieldChange = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // ── Computed stats ─────────────────────────────────────────────────────
  const totalCount = projects.length;
  const ongoingCount = projects.filter((p) => p.status === 'ONGOING').length;
  const completedCount = projects.filter((p) => p.status === 'COMPLETED').length;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Stats Summary ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs font-medium">总项目</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-blue">
            <FlaskConical className="h-4 w-4" />
            <span className="text-xs font-medium">进行中</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{ongoingCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium">已完成</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{completedCount}</p>
        </div>
      </div>

      {/* ── Add / Edit Form (Collapsible) ─────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => {
            if (showForm) {
              handleCancelForm();
            } else {
              setShowForm(true);
              setEditingId(null);
              setFormData(EMPTY_FORM);
            }
          }}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface-elevated/50"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/10">
              {editingId ? (
                <Pencil className="h-4 w-4 text-navy" />
              ) : (
                <Plus className="h-4 w-4 text-navy" />
              )}
            </div>
            <span className="text-sm font-semibold text-text-primary">
              {editingId ? '编辑项目' : '添加项目'}
            </span>
          </div>
          {showForm ? (
            <ChevronUp className="h-4 w-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-tertiary" />
          )}
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="border-t border-border px-5 py-5">
            <div className="space-y-4">
              {/* Row 1: Title + Role */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <FileText className="h-3.5 w-3.5" />
                    项目名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    placeholder="例：基于深度学习的图像识别研究"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <User className="h-3.5 w-3.5" />
                    角色 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => handleFieldChange('role', e.target.value)}
                    placeholder="例：研究员、负责人"
                    list="role-suggestions"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
                    required
                  />
                  <datalist id="role-suggestions">
                    {ROLE_SUGGESTIONS.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Row 2: Advisor + Status */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <GraduationCap className="h-3.5 w-3.5" />
                    指导老师
                  </label>
                  <input
                    type="text"
                    value={formData.advisor}
                    onChange={(e) => handleFieldChange('advisor', e.target.value)}
                    placeholder="例：张教授"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <Clock className="h-3.5 w-3.5" />
                    状态
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleFieldChange('status', 'ONGOING')}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                        formData.status === 'ONGOING'
                          ? 'border-blue bg-blue/10 text-blue'
                          : 'border-border bg-background text-text-secondary hover:border-text-tertiary'
                      }`}
                    >
                      进行中
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFieldChange('status', 'COMPLETED')}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                        formData.status === 'COMPLETED'
                          ? 'border-green-600 bg-green-600/10 text-green-600'
                          : 'border-border bg-background text-text-secondary hover:border-text-tertiary'
                      }`}
                    >
                      已完成
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Dates */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <Calendar className="h-3.5 w-3.5" />
                    开始日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleFieldChange('startDate', e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <CalendarRange className="h-3.5 w-3.5" />
                    结束日期
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleFieldChange('endDate', e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
                  />
                </div>
              </div>

              {/* Row 4: Description */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <BookOpen className="h-3.5 w-3.5" />
                  项目描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="简要描述研究内容、方法和目标..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated"
                >
                  <X className="h-3.5 w-3.5" />
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {editingId ? '保存修改' : '添加项目'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Filter Tabs ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-navy text-white shadow-sm'
                : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
            }`}
          >
            {tab.label}
            {tab.key === 'ALL' && (
              <span className="ml-1.5 text-xs opacity-70">{totalCount}</span>
            )}
            {tab.key === 'ONGOING' && (
              <span className="ml-1.5 text-xs opacity-70">{ongoingCount}</span>
            )}
            {tab.key === 'COMPLETED' && (
              <span className="ml-1.5 text-xs opacity-70">{completedCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
          <span className="ml-2 text-sm text-text-tertiary">加载科研项目...</span>
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────── */}
      {!loading && projects.length === 0 && (
        <div className="rounded-xl border border-border bg-surface py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated">
            <Microscope className="h-7 w-7 text-text-tertiary" />
          </div>
          <p className="text-sm font-medium text-text-secondary">暂无科研项目</p>
          <p className="mt-1 text-xs text-text-tertiary">
            点击"添加项目"开始记录你的科研经历
          </p>
        </div>
      )}

      {/* ── Project Cards Grid ────────────────────────────────────────── */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const isExpanded = expandedId === project.id;
            const isOngoing = project.status === 'ONGOING';

            return (
              <div
                key={project.id}
                className="group relative rounded-xl border border-border bg-surface transition-colors hover:border-text-tertiary/40"
              >
                {/* Card Header */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : project.id)}
                  className="w-full px-5 pt-4 pb-3 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Title */}
                      <h3 className="truncate text-sm font-semibold text-text-primary">
                        {project.title}
                      </h3>
                      {/* Role badge + Advisor */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy">
                          <User className="h-3 w-3" />
                          {project.role}
                        </span>
                        {project.advisor && (
                          <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                            <GraduationCap className="h-3 w-3" />
                            {project.advisor}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        isOngoing
                          ? 'bg-blue/10 text-blue'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isOngoing ? 'bg-blue' : 'bg-green-500'
                        }`}
                      />
                      {isOngoing ? '进行中' : '已完成'}
                    </span>
                  </div>

                  {/* Date range */}
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-text-tertiary">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatDate(project.startDate)} — {formatDate(project.endDate)}
                    </span>
                  </div>

                  {/* Description preview */}
                  {project.description && !isExpanded && (
                    <p className="mt-2 text-xs leading-relaxed text-text-tertiary">
                      {truncate(project.description, 80)}
                    </p>
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && project.description && (
                  <div className="border-t border-border px-5 py-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                      {project.description}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 border-t border-border px-4 py-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(project)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
                    title="编辑"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </button>
                  {deletingId === project.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(project.id)}
                        className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                      >
                        确认删除
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeletingId(project.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-red-50 hover:text-red-600"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
