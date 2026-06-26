'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Eye,
  FolderOpen,
  Loader2,
  AlertCircle,
  Briefcase,
  GraduationCap,
  Award,
  Wrench,
  User,
  Calendar,
  Building2,
  ChevronRight,
  Download,
  Pencil,
  X,
  Check,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Resume {
  id: string;
  userId: string;
  title: string;
  data: ResumeData;
  targetRole?: string;
  createdAt: string;
  updatedAt: string;
}

interface ResumeData {
  personalSummary: string;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  skills: SkillEntry[];
  awards: AwardEntry[];
}

interface EducationEntry {
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
  gpa?: string;
}

interface ExperienceEntry {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
  achievements: string[];
}

interface SkillEntry {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

interface AwardEntry {
  title: string;
  organization: string;
  date: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SKILL_LEVELS: { value: SkillEntry['level']; label: string }[] = [
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '熟练' },
  { value: 'advanced', label: '精通' },
  { value: 'expert', label: '专家' },
];

function emptyEducation(): EducationEntry {
  return { school: '', degree: '', major: '', startDate: '', endDate: '', gpa: '' };
}

function emptyExperience(): ExperienceEntry {
  return { company: '', role: '', startDate: '', endDate: '', description: '', achievements: [''] };
}

function emptyAward(): AwardEntry {
  return { title: '', organization: '', date: '' };
}

function emptyResumeData(): ResumeData {
  return {
    personalSummary: '',
    education: [emptyEducation()],
    experience: [emptyExperience()],
    skills: [],
    awards: [],
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Tab 1: My Resumes
// ---------------------------------------------------------------------------

function MyResumesTab({
  resumes,
  loading,
  onSelect,
  onDelete,
  onRefresh,
}: {
  resumes: Resume[];
  loading: boolean;
  onSelect: (r: Resume) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
        <span className="ml-2 text-text-secondary">加载中...</span>
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue/10">
          <FolderOpen className="h-8 w-8 text-blue" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">还没有简历</h3>
        <p className="mt-2 text-sm text-text-secondary">
          切换到"创建简历"标签，开始制作你的第一份简历
        </p>
        <button
          onClick={onRefresh}
          className="mt-4 text-sm text-blue hover:text-blue-dark transition-colors"
        >
          刷新列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">共 {resumes.length} 份简历</p>
        <button
          onClick={onRefresh}
          className="text-sm text-blue hover:text-blue-dark transition-colors"
        >
          刷新
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resumes.map((r) => (
          <div
            key={r.id}
            className="group relative rounded-xl border border-border bg-surface p-5 transition-all hover:border-blue/40 hover:bg-surface-elevated cursor-pointer"
            onClick={() => onSelect(r)}
          >
            <div className="mb-3 flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy/10">
                <FileText className="h-5 w-5 text-navy" />
              </div>
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(r);
                  }}
                  className="rounded-lg p-1.5 text-text-tertiary hover:bg-background hover:text-blue transition-colors"
                  title="编辑"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {confirmId === r.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(r.id);
                        setConfirmId(null);
                      }}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 transition-colors"
                      title="确认删除"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmId(null);
                      }}
                      className="rounded-lg p-1.5 text-text-tertiary hover:bg-background transition-colors"
                      title="取消"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmId(r.id);
                    }}
                    className="rounded-lg p-1.5 text-text-tertiary hover:bg-background hover:text-red-500 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <h3 className="font-semibold text-text-primary truncate">{r.title}</h3>
            {r.targetRole && (
              <p className="mt-1 flex items-center gap-1 text-sm text-text-secondary">
                <Briefcase className="h-3.5 w-3.5" />
                {r.targetRole}
              </p>
            )}
            <p className="mt-2 text-xs text-text-tertiary">
              更新于 {formatDate(r.updatedAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Create / Edit Resume
// ---------------------------------------------------------------------------

function CreateResumeTab({
  editResume,
  onSave,
  onClear,
}: {
  editResume: Resume | null;
  onSave: (title: string, targetRole: string, data: ResumeData) => void;
  onClear: () => void;
}) {
  const [title, setTitle] = useState(editResume?.title ?? '');
  const [targetRole, setTargetRole] = useState(editResume?.targetRole ?? '');
  const [resumeData, setResumeData] = useState<ResumeData>(
    editResume?.data ?? emptyResumeData(),
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genBackground, setGenBackground] = useState('');
  const [genIndustry, setGenIndustry] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [error, setError] = useState('');

  // Sync when editResume changes
  useEffect(() => {
    if (editResume) {
      setTitle(editResume.title);
      setTargetRole(editResume.targetRole ?? '');
      setResumeData(editResume.data ?? emptyResumeData());
    }
  }, [editResume]);

  // --- AI Generate ---
  const handleGenerate = useCallback(async () => {
    if (!genBackground.trim() || !targetRole.trim()) {
      setError('请填写个人背景和目标岗位');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/resume/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          background: genBackground,
          targetRole,
          targetIndustry: genIndustry || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '生成失败');
      const d = json.data as ResumeData;
      setResumeData({
        personalSummary: d.personalSummary ?? '',
        education: d.education?.length ? d.education : [emptyEducation()],
        experience: d.experience?.length ? d.experience : [emptyExperience()],
        skills: d.skills ?? [],
        awards: d.awards ?? [],
      });
    } catch (err: any) {
      setError(err.message || 'AI 生成失败');
    } finally {
      setGenerating(false);
    }
  }, [genBackground, genIndustry, targetRole]);

  // --- Save ---
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError('请填写简历标题');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(title, targetRole, resumeData);
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [title, targetRole, resumeData, onSave]);

  // --- Education helpers ---
  const updateEducation = useCallback(
    (idx: number, field: keyof EducationEntry, value: string) => {
      setResumeData((prev) => {
        const next = [...prev.education];
        next[idx] = { ...next[idx], [field]: value };
        return { ...prev, education: next };
      });
    },
    [],
  );

  const addEducation = useCallback(() => {
    setResumeData((prev) => ({
      ...prev,
      education: [...prev.education, emptyEducation()],
    }));
  }, []);

  const removeEducation = useCallback(
    (idx: number) => {
      setResumeData((prev) => ({
        ...prev,
        education: prev.education.filter((_, i) => i !== idx),
      }));
    },
    [],
  );

  // --- Experience helpers ---
  const updateExperience = useCallback(
    (idx: number, field: keyof ExperienceEntry, value: string | string[]) => {
      setResumeData((prev) => {
        const next = [...prev.experience];
        next[idx] = { ...next[idx], [field]: value };
        return { ...prev, experience: next };
      });
    },
    [],
  );

  const updateAchievement = useCallback(
    (expIdx: number, achIdx: number, value: string) => {
      setResumeData((prev) => {
        const next = [...prev.experience];
        const achs = [...next[expIdx].achievements];
        achs[achIdx] = value;
        next[expIdx] = { ...next[expIdx], achievements: achs };
        return { ...prev, experience: next };
      });
    },
    [],
  );

  const addAchievement = useCallback((expIdx: number) => {
    setResumeData((prev) => {
      const next = [...prev.experience];
      next[expIdx] = { ...next[expIdx], achievements: [...next[expIdx].achievements, ''] };
      return { ...prev, experience: next };
    });
  }, []);

  const removeAchievement = useCallback((expIdx: number, achIdx: number) => {
    setResumeData((prev) => {
      const next = [...prev.experience];
      next[expIdx] = {
        ...next[expIdx],
        achievements: next[expIdx].achievements.filter((_, i) => i !== achIdx),
      };
      return { ...prev, experience: next };
    });
  }, []);

  const addExperience = useCallback(() => {
    setResumeData((prev) => ({
      ...prev,
      experience: [...prev.experience, emptyExperience()],
    }));
  }, []);

  const removeExperience = useCallback(
    (idx: number) => {
      setResumeData((prev) => ({
        ...prev,
        experience: prev.experience.filter((_, i) => i !== idx),
      }));
    },
    [],
  );

  // --- Skills helpers ---
  const addSkill = useCallback(() => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    setResumeData((prev) => ({
      ...prev,
      skills: [...prev.skills, { name: trimmed, level: 'intermediate' }],
    }));
    setSkillInput('');
  }, [skillInput]);

  const updateSkillLevel = useCallback(
    (idx: number, level: SkillEntry['level']) => {
      setResumeData((prev) => {
        const next = [...prev.skills];
        next[idx] = { ...next[idx], level };
        return { ...prev, skills: next };
      });
    },
    [],
  );

  const removeSkill = useCallback((idx: number) => {
    setResumeData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== idx),
    }));
  }, []);

  // --- Awards helpers ---
  const updateAward = useCallback(
    (idx: number, field: keyof AwardEntry, value: string) => {
      setResumeData((prev) => {
        const next = [...prev.awards];
        next[idx] = { ...next[idx], [field]: value };
        return { ...prev, awards: next };
      });
    },
    [],
  );

  const addAward = useCallback(() => {
    setResumeData((prev) => ({
      ...prev,
      awards: [...prev.awards, emptyAward()],
    }));
  }, []);

  const removeAward = useCallback(
    (idx: number) => {
      setResumeData((prev) => ({
        ...prev,
        awards: prev.awards.filter((_, i) => i !== idx),
      }));
    },
    [],
  );

  // --- Section wrapper ---
  const sectionTitle = (icon: React.ReactNode, label: string) => (
    <div className="flex items-center gap-2">
      {icon}
      <span className="font-semibold text-text-primary">{label}</span>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* AI Generate panel */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        {sectionTitle(<Sparkles className="h-5 w-5 text-blue" />, 'AI 智能生成')}
        <p className="text-sm text-text-secondary">
          填写你的背景信息和目标岗位，AI 将自动生成结构化简历内容
        </p>
        <div className="space-y-3">
          <textarea
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none resize-none"
            rows={3}
            placeholder="简要描述你的背景（如：某某大学计算机专业大三学生，有 Python 和 Web 开发经验，参加过 ACM 竞赛...）"
            value={genBackground}
            onChange={(e) => setGenBackground(e.target.value)}
          />
          <div className="flex gap-3">
            <input
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
              placeholder="目标行业（可选，如：人工智能、金融科技）"
              value={genIndustry}
              onChange={(e) => setGenIndustry(e.target.value)}
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-blue/10 px-5 py-2.5 text-sm font-medium text-blue hover:bg-blue/20 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating ? '生成中...' : 'AI 智能生成'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Basic info */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        {sectionTitle(<User className="h-5 w-5 text-navy" />, '基本信息')}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              简历标题 <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
              placeholder="如：张三-前端工程师简历"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              目标岗位
            </label>
            <input
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
              placeholder="如：前端工程师"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Personal Summary */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        {sectionTitle(<FileText className="h-5 w-5 text-navy" />, '个人简介')}
        <textarea
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none resize-none"
          rows={4}
          placeholder="2-3 句话介绍自己的核心优势和职业目标..."
          value={resumeData.personalSummary}
          onChange={(e) =>
            setResumeData((prev) => ({ ...prev, personalSummary: e.target.value }))
          }
        />
      </div>

      {/* Education */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          {sectionTitle(<GraduationCap className="h-5 w-5 text-navy" />, '教育经历')}
          <button
            onClick={addEducation}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-blue hover:bg-blue/10 transition-colors"
          >
            <Plus className="h-4 w-4" /> 添加
          </button>
        </div>
        {resumeData.education.map((edu, i) => (
          <div key={i} className="rounded-lg border border-border bg-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-tertiary">教育经历 {i + 1}</span>
              {resumeData.education.length > 1 && (
                <button
                  onClick={() => removeEducation(i)}
                  className="rounded p-1 text-text-tertiary hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="学校名称"
                value={edu.school}
                onChange={(e) => updateEducation(i, 'school', e.target.value)}
              />
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="学历（本科/硕士/博士）"
                value={edu.degree}
                onChange={(e) => updateEducation(i, 'degree', e.target.value)}
              />
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="专业名称"
                value={edu.major}
                onChange={(e) => updateEducation(i, 'major', e.target.value)}
              />
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="GPA（可选）"
                value={edu.gpa ?? ''}
                onChange={(e) => updateEducation(i, 'gpa', e.target.value)}
              />
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="入学时间（如 2020-09）"
                value={edu.startDate}
                onChange={(e) => updateEducation(i, 'startDate', e.target.value)}
              />
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="毕业时间（如 2024-06）"
                value={edu.endDate}
                onChange={(e) => updateEducation(i, 'endDate', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Experience */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          {sectionTitle(<Briefcase className="h-5 w-5 text-navy" />, '工作/实习经历')}
          <button
            onClick={addExperience}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-blue hover:bg-blue/10 transition-colors"
          >
            <Plus className="h-4 w-4" /> 添加
          </button>
        </div>
        {resumeData.experience.map((exp, i) => (
          <div key={i} className="rounded-lg border border-border bg-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-tertiary">经历 {i + 1}</span>
              {resumeData.experience.length > 1 && (
                <button
                  onClick={() => removeExperience(i)}
                  className="rounded p-1 text-text-tertiary hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="公司/组织名称"
                value={exp.company}
                onChange={(e) => updateExperience(i, 'company', e.target.value)}
              />
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="职位/角色"
                value={exp.role}
                onChange={(e) => updateExperience(i, 'role', e.target.value)}
              />
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="开始时间（如 2023-06）"
                value={exp.startDate}
                onChange={(e) => updateExperience(i, 'startDate', e.target.value)}
              />
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="结束时间（如 2023-09）"
                value={exp.endDate}
                onChange={(e) => updateExperience(i, 'endDate', e.target.value)}
              />
            </div>
            <textarea
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none resize-none"
              rows={2}
              placeholder="工作内容概述..."
              value={exp.description}
              onChange={(e) => updateExperience(i, 'description', e.target.value)}
            />
            <div className="space-y-2">
              <span className="text-xs font-medium text-text-tertiary">主要成就</span>
              {exp.achievements.map((ach, j) => (
                <div key={j} className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                    placeholder={`成就 ${j + 1}`}
                    value={ach}
                    onChange={(e) => updateAchievement(i, j, e.target.value)}
                  />
                  {exp.achievements.length > 1 && (
                    <button
                      onClick={() => removeAchievement(i, j)}
                      className="rounded p-1 text-text-tertiary hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => addAchievement(i)}
                className="inline-flex items-center gap-1 text-xs text-blue hover:text-blue-dark transition-colors"
              >
                <Plus className="h-3 w-3" /> 添加成就
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Skills */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        {sectionTitle(<Wrench className="h-5 w-5 text-navy" />, '技能')}
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
            placeholder="输入技能名称后回车添加（如：Python）"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSkill();
              }
            }}
          />
          <button
            onClick={addSkill}
            className="inline-flex items-center gap-1 rounded-lg bg-blue/10 px-4 py-2.5 text-sm font-medium text-blue hover:bg-blue/20 transition-colors"
          >
            <Plus className="h-4 w-4" /> 添加
          </button>
        </div>
        {resumeData.skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {resumeData.skills.map((skill, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5"
              >
                <span className="text-sm text-text-primary">{skill.name}</span>
                <select
                  className="rounded border-0 bg-transparent text-xs text-text-secondary focus:outline-none cursor-pointer"
                  value={skill.level}
                  onChange={(e) =>
                    updateSkillLevel(i, e.target.value as SkillEntry['level'])
                  }
                >
                  {SKILL_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeSkill(i)}
                  className="text-text-tertiary hover:text-red-500 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Awards */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          {sectionTitle(<Award className="h-5 w-5 text-navy" />, '荣誉奖项')}
          <button
            onClick={addAward}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-blue hover:bg-blue/10 transition-colors"
          >
            <Plus className="h-4 w-4" /> 添加
          </button>
        </div>
        {resumeData.awards.map((award, i) => (
          <div key={i} className="rounded-lg border border-border bg-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-tertiary">奖项 {i + 1}</span>
              <button
                onClick={() => removeAward(i)}
                className="rounded p-1 text-text-tertiary hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="奖项名称"
                value={award.title}
                onChange={(e) => updateAward(i, 'title', e.target.value)}
              />
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="颁发机构"
                value={award.organization}
                onChange={(e) => updateAward(i, 'organization', e.target.value)}
              />
              <input
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none"
                placeholder="获奖时间（如 2023-12）"
                value={award.date}
                onChange={(e) => updateAward(i, 'date', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex justify-end gap-3">
        {editResume && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-background transition-colors"
          >
            新建空白简历
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-navy px-6 py-2.5 text-sm font-medium text-white hover:bg-navy/90 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? '保存中...' : editResume ? '更新简历' : '保存简历'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Preview
// ---------------------------------------------------------------------------

function PreviewTab({ resume }: { resume: Resume | null }) {
  if (!resume) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue/10">
          <Eye className="h-8 w-8 text-blue" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">暂无预览</h3>
        <p className="mt-2 text-sm text-text-secondary">
          请先选择或创建一份简历
        </p>
      </div>
    );
  }

  const data: ResumeData = resume.data ?? emptyResumeData();

  const handleExport = () => {
    alert('导出功能即将上线');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary">{resume.title}</h2>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/90 transition-colors"
        >
          <Download className="h-4 w-4" />
          导出
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {/* Header */}
        <div className="bg-navy px-8 py-6 text-white">
          <h1 className="text-2xl font-bold">{resume.title}</h1>
          {resume.targetRole && (
            <p className="mt-1 flex items-center gap-1.5 text-sm opacity-90">
              <Briefcase className="h-4 w-4" />
              目标岗位: {resume.targetRole}
            </p>
          )}
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Personal Summary */}
          {data.personalSummary && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-navy border-b border-border pb-2">
                <User className="h-4 w-4" />
                个人简介
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                {data.personalSummary}
              </p>
            </section>
          )}

          {/* Education */}
          {data.education?.length > 0 && data.education.some((e) => e.school) && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-navy border-b border-border pb-2">
                <GraduationCap className="h-4 w-4" />
                教育经历
              </h2>
              <div className="space-y-4">
                {data.education
                  .filter((e) => e.school)
                  .map((edu, i) => (
                    <div key={i}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-text-primary">{edu.school}</h3>
                          <p className="text-sm text-text-secondary">
                            {edu.degree} - {edu.major}
                            {edu.gpa ? ` | GPA: ${edu.gpa}` : ''}
                          </p>
                        </div>
                        <span className="flex items-center gap-1 text-xs text-text-tertiary shrink-0">
                          <Calendar className="h-3 w-3" />
                          {edu.startDate} ~ {edu.endDate}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Experience */}
          {data.experience?.length > 0 && data.experience.some((e) => e.company) && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-navy border-b border-border pb-2">
                <Briefcase className="h-4 w-4" />
                工作/实习经历
              </h2>
              <div className="space-y-5">
                {data.experience
                  .filter((e) => e.company)
                  .map((exp, i) => (
                    <div key={i}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-text-primary">{exp.company}</h3>
                          <p className="text-sm text-text-secondary">{exp.role}</p>
                        </div>
                        <span className="flex items-center gap-1 text-xs text-text-tertiary shrink-0">
                          <Calendar className="h-3 w-3" />
                          {exp.startDate} ~ {exp.endDate}
                        </span>
                      </div>
                      {exp.description && (
                        <p className="mt-2 text-sm text-text-secondary">{exp.description}</p>
                      )}
                      {exp.achievements?.filter(Boolean).length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {exp.achievements
                            .filter(Boolean)
                            .map((ach, j) => (
                              <li
                                key={j}
                                className="flex items-start gap-2 text-sm text-text-secondary"
                              >
                                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue" />
                                {ach}
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Skills */}
          {data.skills?.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-navy border-b border-border pb-2">
                <Wrench className="h-4 w-4" />
                技能
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.skills.map((skill, i) => {
                  const levelLabel =
                    SKILL_LEVELS.find((l) => l.value === skill.level)?.label ?? skill.level;
                  return (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm"
                    >
                      <span className="text-text-primary">{skill.name}</span>
                      <span className="rounded bg-blue/10 px-1.5 py-0.5 text-xs text-blue">
                        {levelLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Awards */}
          {data.awards?.length > 0 && data.awards.some((a) => a.title) && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-navy border-b border-border pb-2">
                <Award className="h-4 w-4" />
                荣誉奖项
              </h2>
              <div className="space-y-3">
                {data.awards
                  .filter((a) => a.title)
                  .map((award, i) => (
                    <div key={i} className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">
                          {award.title}
                        </h3>
                        <p className="text-xs text-text-secondary">
                          {award.organization}
                          {award.date ? ` | ${award.date}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type TabKey = 'list' | 'create' | 'preview';

export default function ResumeBuilder() {
  const [tab, setTab] = useState<TabKey>('list');
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [toast, setToast] = useState('');

  // --- Fetch resumes ---
  const fetchResumes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/resume');
      const json = await res.json();
      if (res.ok) {
        setResumes(json.data ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  // --- Show toast briefly ---
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  // --- Select resume for editing ---
  const handleSelect = useCallback((r: Resume) => {
    setSelectedResume(r);
    setTab('create');
  }, []);

  // --- Delete resume ---
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/resume/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('删除失败');
        setResumes((prev) => prev.filter((r) => r.id !== id));
        if (selectedResume?.id === id) setSelectedResume(null);
        showToast('简历已删除');
      } catch {
        showToast('删除失败，请重试');
      }
    },
    [selectedResume, showToast],
  );

  // --- Save (create or update) ---
  const handleSave = useCallback(
    async (title: string, targetRole: string, data: ResumeData) => {
      if (selectedResume) {
        // Update existing
        const res = await fetch(`/api/resume/${selectedResume.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, targetRole, data }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '更新失败');
        setSelectedResume(json.data);
        showToast('简历已更新');
      } else {
        // Create new
        const res = await fetch('/api/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, targetRole, data }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '创建失败');
        setSelectedResume(json.data);
        showToast('简历已创建');
      }
      await fetchResumes();
      setTab('preview');
    },
    [selectedResume, showToast, fetchResumes],
  );

  // --- Clear selected for new resume ---
  const handleClear = useCallback(() => {
    setSelectedResume(null);
  }, []);

  // --- Tab config ---
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'list', label: '我的简历', icon: <FolderOpen className="h-4 w-4" /> },
    { key: 'create', label: '创建简历', icon: <Plus className="h-4 w-4" /> },
    { key: 'preview', label: '预览', icon: <Eye className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-navy text-white shadow-sm'
                : 'text-text-secondary hover:bg-background hover:text-text-primary'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-navy px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Tab content */}
      {tab === 'list' && (
        <MyResumesTab
          resumes={resumes}
          loading={loading}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onRefresh={fetchResumes}
        />
      )}

      {tab === 'create' && (
        <CreateResumeTab
          editResume={selectedResume}
          onSave={handleSave}
          onClear={handleClear}
        />
      )}

      {tab === 'preview' && <PreviewTab resume={selectedResume} />}
    </div>
  );
}
