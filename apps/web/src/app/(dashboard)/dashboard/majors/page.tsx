'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Clock,
  Award,
  Briefcase,
  GraduationCap,
  TrendingUp,
  Building2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { Badge } from '@zhidu/ui';

// ─────────────────────────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────────────────────────

interface Major {
  id: string;
  name: string;
  category: string;
  duration: number;
  degree: string;
  major_code?: string;
  discipline_category?: string;
  employment_rate?: number;
  description?: string;
  what_description?: string;
  study_description?: string;
  career_description?: string;
  core_courses?: string[];
  graduate_paths?: string[];
  certifications?: string[];
  offering_schools?: Array<{ name: string; tier?: string }>;
}

interface SalaryData {
  id: string;
  year: number;
  avg_monthly_salary?: number;
  median_monthly_salary?: number;
  sample_size?: number;
  top_industries?: Array<{ name: string; ratio?: number }>;
  top_cities?: Array<{ name: string; ratio?: number }>;
  top_occupations?: Array<{ name: string; ratio?: number }>;
}

interface OfferingUniversity {
  id: string;
  name: string;
  province: string;
  tier: string;
  is_985?: boolean;
  is_211?: boolean;
  school_type?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────────────

const categories = [
  '哲学', '经济学', '法学', '教育学', '文学', '历史学',
  '理学', '工学', '农学', '医学', '管理学', '艺术学', '交叉学科',
];

const degrees = ['学士', '硕士', '博士'];

// ─────────────────────────────────────────────────────────────────────────────
// 页面组件
// ─────────────────────────────────────────────────────────────────────────────

export default function MajorsPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState('');
  const [degree, setDegree] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [majors, setMajors] = useState<Major[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{
    major: Major;
    salaryData: SalaryData[];
    offeringUniversities: OfferingUniversity[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const fetchMajors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('name', debouncedQuery);
      if (category) params.set('category', category);
      if (degree) params.set('degree', degree);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/data/majors?${params}`);
      const json = await res.json();
      if (json.success) {
        setMajors(json.data.majors);
        setTotal(json.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch majors:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, category, degree, page, pageSize]);

  useEffect(() => {
    fetchMajors();
  }, [fetchMajors]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/data/majors/${id}`);
      const json = await res.json();
      if (json.success) {
        setDetailData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch major detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSelect = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setDetailData(null);
    } else {
      setSelectedId(id);
      fetchDetail(id);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
            <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">专业库</h1>
            <p className="text-sm text-text-secondary">
              浏览 {total.toLocaleString()} 个专业，了解学科内涵、就业前景与薪酬数据
            </p>
          </div>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="搜索专业名称..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-tertiary hover:text-text-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 学科门类 */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => { setCategory(category === c ? '' : c); setPage(1); }}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                category === c
                  ? 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'border-border text-text-secondary hover:bg-surface-elevated',
              ].join(' ')}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 学位 + 清除 */}
        <div className="flex items-center gap-2">
          {degrees.map((d) => (
            <button
              key={d}
              onClick={() => { setDegree(degree === d ? '' : d); setPage(1); }}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                degree === d
                  ? 'border-blue bg-blue/10 text-blue'
                  : 'border-border text-text-secondary hover:bg-surface-elevated',
              ].join(' ')}
            >
              {d}
            </button>
          ))}
          {(category || degree || query) && (
            <button
              onClick={() => { setCategory(''); setDegree(''); setQuery(''); setPage(1); }}
              className="text-xs text-text-tertiary hover:text-text-secondary"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* 结果列表 */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          </div>
        ) : majors.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-text-tertiary" />
            <p className="mt-3 text-sm text-text-secondary">没有找到匹配的专业</p>
          </div>
        ) : (
          majors.map((major) => (
            <MajorRow
              key={major.id}
              major={major}
              isSelected={selectedId === major.id}
              onSelect={() => handleSelect(major.id)}
              detailData={selectedId === major.id ? detailData : null}
              detailLoading={selectedId === major.id ? detailLoading : false}
            />
          ))
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-text-tertiary">
            共 {total.toLocaleString()} 条，第 {page}/{totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              上一页
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 专业行
// ─────────────────────────────────────────────────────────────────────────────

function MajorRow({
  major,
  isSelected,
  onSelect,
  detailData,
  detailLoading,
}: {
  major: Major;
  isSelected: boolean;
  onSelect: () => void;
  detailData: { major: Major; salaryData: SalaryData[]; offeringUniversities: OfferingUniversity[] } | null;
  detailLoading: boolean;
}) {
  return (
    <div className={[
      'rounded-xl border transition-colors',
      isSelected ? 'border-green-500/50 bg-green-500/[0.02]' : 'border-border bg-surface hover:border-green-500/30',
    ].join(' ')}>
      <button
        onClick={onSelect}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-text-primary">{major.name}</span>
            {major.employment_rate !== undefined && major.employment_rate !== null && (
              <Badge color={major.employment_rate >= 90 ? 'green' : major.employment_rate >= 80 ? 'blue' : 'yellow'}>
                就业率 {major.employment_rate}%
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-text-secondary">
            <span>{major.category}</span>
            {major.discipline_category && (
              <span className="text-text-tertiary">{major.discipline_category}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {major.duration}年
            </span>
            <span className="flex items-center gap-1">
              <Award className="h-3 w-3" />
              {major.degree}
            </span>
          </div>
        </div>

        {major.major_code && (
          <span className="hidden text-xs text-text-tertiary sm:block">{major.major_code}</span>
        )}

        {isSelected
          ? <ChevronUp className="h-4 w-4 shrink-0 text-text-tertiary" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />
        }
      </button>

      {isSelected && (
        <div className="border-t border-border px-4 py-4">
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-green-600" />
            </div>
          ) : detailData ? (
            <MajorDetailPanel data={detailData} />
          ) : (
            <p className="py-4 text-center text-sm text-text-tertiary">加载失败</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 详情面板
// ─────────────────────────────────────────────────────────────────────────────

function MajorDetailPanel({ data }: {
  data: { major: Major; salaryData: SalaryData[]; offeringUniversities: OfferingUniversity[] };
}) {
  const { major, salaryData, offeringUniversities } = data;

  return (
    <div className="space-y-4">
      {/* 专业简介 */}
      {major.what_description && (
        <div>
          <h4 className="mb-1 text-xs font-medium text-text-secondary">专业简介</h4>
          <p className="text-sm leading-relaxed text-text-secondary">{major.what_description}</p>
        </div>
      )}

      {/* 学习内容 */}
      {major.study_description && (
        <div>
          <h4 className="mb-1 text-xs font-medium text-text-secondary">学什么</h4>
          <p className="text-sm leading-relaxed text-text-secondary">{major.study_description}</p>
        </div>
      )}

      {/* 核心课程 */}
      {major.core_courses && major.core_courses.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-text-secondary">核心课程</h4>
          <div className="flex flex-wrap gap-1.5">
            {major.core_courses.map((c) => (
              <Badge key={c} color="blue">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* 就业方向 */}
      {major.career_description && (
        <div>
          <h4 className="mb-1 text-xs font-medium text-text-secondary">就业方向</h4>
          <p className="text-sm leading-relaxed text-text-secondary">{major.career_description}</p>
        </div>
      )}

      {/* 毕业去向 */}
      {major.graduate_paths && major.graduate_paths.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-text-secondary">毕业去向</h4>
          <div className="flex flex-wrap gap-1.5">
            {major.graduate_paths.map((p) => (
              <Badge key={p} color="gray">{p}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* 薪酬数据 */}
      {salaryData.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-text-secondary">薪酬数据</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {salaryData.slice(0, 3).map((s) => (
              <div key={s.id} className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-[10px] text-text-tertiary">{s.year}年</p>
                {s.avg_monthly_salary && (
                  <p className="flex items-center gap-1 text-sm font-semibold text-text-primary">
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    {s.avg_monthly_salary.toLocaleString()} 元/月
                  </p>
                )}
                {s.median_monthly_salary && (
                  <p className="mt-0.5 text-xs text-text-secondary">
                    中位数 {s.median_monthly_salary.toLocaleString()} 元
                  </p>
                )}
              </div>
            ))}
          </div>
          {/* 热门行业 */}
          {salaryData[0]?.top_industries && salaryData[0].top_industries.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-[10px] text-text-tertiary">热门就业行业</p>
              <div className="flex flex-wrap gap-1">
                {salaryData[0].top_industries.slice(0, 5).map((ind, i) => (
                  <span key={i} className="rounded-md bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary">
                    {ind.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 开设院校 */}
      {offeringUniversities.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-text-secondary">
            开设院校（{offeringUniversities.length} 所）
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {offeringUniversities.slice(0, 10).map((u) => (
              <span
                key={u.id}
                className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-text-primary"
              >
                <Building2 className="h-3 w-3 text-text-tertiary" />
                {u.name}
                {u.is_985 && <span className="text-[9px] text-red-500">985</span>}
                {u.is_211 && !u.is_985 && <span className="text-[9px] text-orange-500">211</span>}
              </span>
            ))}
            {offeringUniversities.length > 10 && (
              <span className="rounded-md px-2 py-1 text-xs text-text-tertiary">
                +{offeringUniversities.length - 10} 所
              </span>
            )}
          </div>
        </div>
      )}

      {/* 资格证书 */}
      {major.certifications && major.certifications.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-text-secondary">相关证书</h4>
          <div className="flex flex-wrap gap-1.5">
            {major.certifications.slice(0, 8).map((c) => (
              <Badge key={c} color="purple">{c}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
