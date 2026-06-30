'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
  Award,
  Star,
  BookOpen,
  Phone,
  Globe,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { Badge } from '@zhidu/ui';

// ─────────────────────────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────────────────────────

interface University {
  id: string;
  name: string;
  province: string;
  city: string;
  tier: string;
  is_public: boolean;
  website?: string;
  tags?: string[];
  is_985?: boolean;
  is_211?: boolean;
  is_dual_first_class?: boolean;
  founding_year?: number;
  school_type?: string;
  education_level?: string;
  master_programs?: number;
  doctoral_programs?: number;
  gender_ratio?: string;
  admission_phone?: string;
  national_specialties?: string[];
  discipline_evaluation?: Record<string, string>;
  description?: string;
  motto?: string;
  affiliated?: string;
}

interface Ranking {
  id: string;
  source: string;
  year: number;
  rank?: number;
  score?: number;
  tags?: string[];
}

interface DisciplineEval {
  id: string;
  discipline_name: string;
  evaluation_round: string;
  rating: string;
  ranking_position?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────────────

const provinces = [
  '北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南',
  '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海',
  '内蒙古', '广西', '西藏', '宁夏', '新疆',
];

const tiers = ['985', '211', '双一流', '普通本科', '专科'];
const schoolTypes = ['综合', '理工', '师范', '医药', '农林', '财经', '政法', '语言', '艺术', '体育', '民族', '军事'];

// ─────────────────────────────────────────────────────────────────────────────
// 页面组件
// ─────────────────────────────────────────────────────────────────────────────

export default function UniversitiesPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [province, setProvince] = useState('');
  const [tier, setTier] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [is985, setIs985] = useState(false);
  const [is211, setIs211] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{
    university: University;
    rankings: Ranking[];
    disciplineEvaluations: DisciplineEval[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // 搜索词变化时重置页码
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  // 查询院校列表
  const fetchUniversities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('name', debouncedQuery);
      if (province) params.set('province', province);
      if (tier) params.set('tier', tier);
      if (schoolType) params.set('school_type', schoolType);
      if (is985) params.set('is_985', 'true');
      if (is211) params.set('is_211', 'true');
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/data/universities?${params}`);
      const json = await res.json();
      if (json.success) {
        setUniversities(json.data.universities);
        setTotal(json.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch universities:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, province, tier, schoolType, is985, is211, page, pageSize]);

  useEffect(() => {
    fetchUniversities();
  }, [fetchUniversities]);

  // 查询院校详情
  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/data/universities/${id}`);
      const json = await res.json();
      if (json.success) {
        setDetailData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch university detail:', err);
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

  // 筛选变更时重置页码
  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const handleToggle985 = () => { setIs985(!is985); setPage(1); };
  const handleToggle211 = () => { setIs211(!is211); setPage(1); };

  const activeFilters = [province, tier, schoolType, is985, is211].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
            <Building2 className="h-5 w-5 text-blue" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">院校库</h1>
            <p className="text-sm text-text-secondary">
              浏览 {total.toLocaleString()} 所高校，筛选查询院校详情
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
            placeholder="搜索院校名称..."
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

        {/* 筛选条件 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 省份 */}
          <select
            value={province}
            onChange={(e) => handleFilterChange(setProvince, e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-blue focus:outline-none"
          >
            <option value="">全部省份</option>
            {provinces.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* 层次 */}
          <div className="flex gap-1">
            {tiers.map((t) => (
              <button
                key={t}
                onClick={() => handleFilterChange(setTier, tier === t ? '' : t)}
                className={[
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  tier === t
                    ? 'border-blue bg-blue/10 text-blue'
                    : 'border-border text-text-secondary hover:bg-surface-elevated',
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>

          {/* 985/211 开关 */}
          <button
            onClick={handleToggle985}
            className={[
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              is985
                ? 'border-red-400 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
                : 'border-border text-text-secondary hover:bg-surface-elevated',
            ].join(' ')}
          >
            仅 985
          </button>
          <button
            onClick={handleToggle211}
            className={[
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              is211
                ? 'border-orange-400 bg-orange-50 text-orange-600 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400'
                : 'border-border text-text-secondary hover:bg-surface-elevated',
            ].join(' ')}
          >
            仅 211
          </button>

          {/* 学校类型 */}
          <select
            value={schoolType}
            onChange={(e) => handleFilterChange(setSchoolType, e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-blue focus:outline-none"
          >
            <option value="">全部类型</option>
            {schoolTypes.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          {activeFilters > 0 && (
            <button
              onClick={() => {
                setProvince(''); setTier(''); setSchoolType('');
                setIs985(false); setIs211(false); setPage(1);
              }}
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
            <Loader2 className="h-6 w-6 animate-spin text-blue" />
          </div>
        ) : universities.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface py-16 text-center">
            <Building2 className="mx-auto h-10 w-10 text-text-tertiary" />
            <p className="mt-3 text-sm text-text-secondary">没有找到匹配的院校</p>
          </div>
        ) : (
          universities.map((uni) => (
            <UniversityRow
              key={uni.id}
              university={uni}
              isSelected={selectedId === uni.id}
              onSelect={() => handleSelect(uni.id)}
              detailData={selectedId === uni.id ? detailData : null}
              detailLoading={selectedId === uni.id ? detailLoading : false}
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
// 院校行
// ─────────────────────────────────────────────────────────────────────────────

function UniversityRow({
  university,
  isSelected,
  onSelect,
  detailData,
  detailLoading,
}: {
  university: University;
  isSelected: boolean;
  onSelect: () => void;
  detailData: { university: University; rankings: Ranking[]; disciplineEvaluations: DisciplineEval[] } | null;
  detailLoading: boolean;
}) {
  const uni = university;

  return (
    <div className={[
      'rounded-xl border transition-colors',
      isSelected ? 'border-blue bg-blue/[0.02]' : 'border-border bg-surface hover:border-blue/30',
    ].join(' ')}>
      {/* 主行 */}
      <button
        onClick={onSelect}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {/* 院校名称区 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-text-primary">{uni.name}</span>
            {uni.is_985 && <Badge color="red">985</Badge>}
            {uni.is_211 && !uni.is_985 && <Badge color="yellow">211</Badge>}
            {uni.is_dual_first_class && !uni.is_211 && <Badge color="blue">双一流</Badge>}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {uni.province}{uni.city && uni.city !== uni.province ? ` ${uni.city}` : ''}
            </span>
            {uni.school_type && <span>{uni.school_type}</span>}
            {uni.founding_year && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {uni.founding_year}年
              </span>
            )}
          </div>
        </div>

        {/* 标签 */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <Badge color="gray">{uni.tier}</Badge>
          {uni.tags?.slice(0, 2).map((tag) => (
            <Badge key={tag} color="gray">{tag}</Badge>
          ))}
        </div>

        {/* 展开指示器 */}
        {isSelected
          ? <ChevronUp className="h-4 w-4 shrink-0 text-text-tertiary" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />
        }
      </button>

      {/* 详情面板 */}
      {isSelected && (
        <div className="border-t border-border px-4 py-4">
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-blue" />
            </div>
          ) : detailData ? (
            <DetailPanel data={detailData} />
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

function DetailPanel({ data }: {
  data: { university: University; rankings: Ranking[]; disciplineEvaluations: DisciplineEval[] };
}) {
  const { university: uni, rankings, disciplineEvaluations } = data;

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      {uni.description && (
        <p className="text-sm leading-relaxed text-text-secondary">{uni.description}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {uni.affiliated && (
          <InfoItem icon={<Award className="h-3.5 w-3.5" />} label="隶属" value={uni.affiliated} />
        )}
        {uni.education_level && (
          <InfoItem icon={<BookOpen className="h-3.5 w-3.5" />} label="办学层次" value={uni.education_level} />
        )}
        {uni.master_programs !== undefined && uni.master_programs > 0 && (
          <InfoItem icon={<Star className="h-3.5 w-3.5" />} label="硕士点" value={String(uni.master_programs)} />
        )}
        {uni.doctoral_programs !== undefined && uni.doctoral_programs > 0 && (
          <InfoItem icon={<Star className="h-3.5 w-3.5" />} label="博士点" value={String(uni.doctoral_programs)} />
        )}
        {uni.gender_ratio && (
          <InfoItem icon={<Users className="h-3.5 w-3.5" />} label="男女比" value={uni.gender_ratio} />
        )}
        {uni.admission_phone && (
          <InfoItem icon={<Phone className="h-3.5 w-3.5" />} label="招办电话" value={uni.admission_phone} />
        )}
        {uni.website && (
          <InfoItem icon={<Globe className="h-3.5 w-3.5" />} label="官网" value={uni.website} />
        )}
        {uni.motto && (
          <InfoItem icon={<BookOpen className="h-3.5 w-3.5" />} label="校训" value={uni.motto} />
        )}
      </div>

      {/* 国家特色专业 */}
      {uni.national_specialties && uni.national_specialties.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-text-secondary">国家特色专业</h4>
          <div className="flex flex-wrap gap-1.5">
            {uni.national_specialties.map((s) => (
              <Badge key={s} color="blue">{s}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* 排名 */}
      {rankings.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-text-secondary">院校排名</h4>
          <div className="flex flex-wrap gap-2">
            {rankings.slice(0, 6).map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
                <span className="text-text-secondary">{r.source} {r.year}</span>
                {r.rank && (
                  <span className="ml-2 font-semibold text-text-primary">第 {r.rank} 名</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 学科评估 */}
      {disciplineEvaluations.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-text-secondary">学科评估（{disciplineEvaluations.length} 项）</h4>
          <div className="flex flex-wrap gap-1.5">
            {disciplineEvaluations.slice(0, 12).map((d) => (
              <span
                key={d.id}
                className={[
                  'rounded-md px-2 py-1 text-xs font-medium',
                  getRatingColor(d.rating),
                ].join(' ')}
              >
                {d.discipline_name} {d.rating}
              </span>
            ))}
            {disciplineEvaluations.length > 12 && (
              <span className="rounded-md px-2 py-1 text-xs text-text-tertiary">
                +{disciplineEvaluations.length - 12} 项
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具组件
// ─────────────────────────────────────────────────────────────────────────────

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-text-tertiary">{icon}</span>
      <div>
        <p className="text-[10px] text-text-tertiary">{label}</p>
        <p className="text-xs text-text-primary">{value}</p>
      </div>
    </div>
  );
}

function getRatingColor(rating: string): string {
  if (rating.startsWith('A+')) return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400';
  if (rating.startsWith('A')) return 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400';
  if (rating.startsWith('B+')) return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400';
  if (rating.startsWith('B')) return 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
  if (rating.startsWith('C')) return 'bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400';
  return 'bg-gray-50 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400';
}
