'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Input } from '@zhidu/ui';
import {
  Settings,
  Microscope,
  Stethoscope,
  TrendingUp,
  ClipboardList,
  Scale,
  BookOpen,
  GraduationCap,
  Palette,
  Wheat,
  ScrollText,
  MessageCircle,
  Search,
  Compass,
  Ruler,
  Target,
  Lightbulb,
  Brain,
  AlertTriangle,
  Flame,
  Shield,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RankResult {
  rank: number;
  score: number;
  province: string;
  percentile: number;
}

interface Recommendation {
  id: string;
  university: string;
  major: string;
  avgScore: number;
  probability: number;
  trend: 'up' | 'stable' | 'down';
  category: 'rush' | 'stable' | 'safe';
}

interface Preferences {
  categories: string[];
  cities: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PROVINCES = [
  '广东', '浙江', '山东', '河南', '四川', '湖北', '江苏', '湖南',
  '安徽', '河北', '北京', '上海', '天津', '重庆', '福建', '陕西',
  '辽宁', '黑龙江', '吉林', '江西', '广西', '云南', '贵州', '山西',
  '甘肃', '内蒙古', '新疆', '海南', '宁夏', '青海', '西藏',
];

const CATEGORIES = [
  { name: '工学', icon: Settings },
  { name: '理学', icon: Microscope },
  { name: '医学', icon: Stethoscope },
  { name: '经济学', icon: TrendingUp },
  { name: '管理学', icon: ClipboardList },
  { name: '法学', icon: Scale },
  { name: '文学', icon: BookOpen },
  { name: '教育学', icon: GraduationCap },
  { name: '艺术学', icon: Palette },
  { name: '农学', icon: Wheat },
  { name: '历史学', icon: ScrollText },
  { name: '哲学', icon: MessageCircle },
];

const POPULAR_CITIES = [
  '北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '武汉',
  '西安', '长沙', '天津', '重庆', '厦门', '青岛', '大连', '苏州',
];

const STEP_LABELS = ['查位次', '定方向', '理清逻辑', '生成方案'];
const STEP_ICONS = [Search, Compass, Ruler, Target];

// 新高考省份分类映射
const NEW_GAOKAO_3PLUS3 = new Set([
  '浙江', '上海', '北京', '天津', '山东', '海南',
]);
const NEW_GAOKAO_3PLUS1PLUS2 = new Set([
  '河北', '辽宁', '江苏', '福建', '湖北', '湖南', '广东', '重庆',
  '吉林', '黑龙江', '安徽', '江西', '广西', '贵州', '甘肃',
]);

interface SubjectOption {
  value: string;
  label: string;
  description: string;
}

function getSubjectOptions(province: string): SubjectOption[] {
  if (NEW_GAOKAO_3PLUS3.has(province)) {
    return [
      { value: '综合', label: '综合（3+3）', description: '不分文理，选考3门' },
    ];
  }
  if (NEW_GAOKAO_3PLUS1PLUS2.has(province)) {
    return [
      { value: '物理类', label: '物理类', description: '首选物理，再选2门' },
      { value: '历史类', label: '历史类', description: '首选历史，再选2门' },
    ];
  }
  return [
    { value: '理科', label: '理科', description: '传统理科方向' },
    { value: '文科', label: '文科', description: '传统文科方向' },
  ];
}

function getGaokaoMode(province: string): string {
  if (NEW_GAOKAO_3PLUS3.has(province)) return '3+3 新高考';
  if (NEW_GAOKAO_3PLUS1PLUS2.has(province)) return '3+1+2 新高考';
  return '传统高考';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function trendLabel(trend: 'up' | 'stable' | 'down') {
  if (trend === 'up') return '上升';
  if (trend === 'down') return '下降';
  return '平稳';
}

function trendArrow(trend: 'up' | 'stable' | 'down') {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function probabilityColor(p: number) {
  if (p >= 80) return 'text-green-600';
  if (p >= 50) return 'text-blue-600';
  return 'text-orange-500';
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function VolunteerWizardPage() {
  // Wizard navigation
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: 查位次
  const [score, setScore] = useState('');
  const [province, setProvince] = useState('');
  const [subjectType, setSubjectType] = useState('');
  const [rankInput, setRankInput] = useState('');
  const [rankLoading, setRankLoading] = useState(false);
  const [rankResult, setRankResult] = useState<RankResult | null>(null);
  const [rankError, setRankError] = useState('');

  // Auto-reset subject type when province changes
  useEffect(() => {
    if (province) {
      const options = getSubjectOptions(province);
      setSubjectType(options.length === 1 ? options[0].value : '');
    } else {
      setSubjectType('');
    }
    // Reset rank result when province changes
    setRankResult(null);
  }, [province]);

  // Step 2: 定方向
  const [preferences, setPreferences] = useState<Preferences>({
    categories: [],
    cities: [],
  });

  // Step 3: 理清逻辑
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [logicAcknowledged, setLogicAcknowledged] = useState(false);

  // Step 4: 生成方案
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState('');
  const [planSaved, setPlanSaved] = useState(false);

  // ── Step 1: Fetch rank ──────────────────────────────────────────────────

  const fetchRank = useCallback(async () => {
    if (!score || !province) {
      setRankError('请填写分数和省份');
      return;
    }
    const st = subjectType || getSubjectOptions(province)[0]?.value || '';
    if (!st) {
      setRankError('请选择科类');
      return;
    }
    setRankLoading(true);
    setRankError('');
    try {
      const params = new URLSearchParams({
        score: score,
        province: province,
        subjectType: st,
      });
      if (rankInput) params.set('rank', rankInput);

      const res = await fetch(`/api/assessments/rank-to-score?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.hint || '查询失败，请稍后重试');
      }

      setRankResult({
        rank: data.data?.estimatedRank ?? data.rank ?? 0,
        score: Number(score),
        province,
        percentile: Math.round((data.data?.confidence ?? data.percentile ?? 0) * 100),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '查询失败，请稍后重试';
      setRankError(msg);
    } finally {
      setRankLoading(false);
    }
  }, [score, province, subjectType, rankInput]);

  // ── Step 4: Fetch recommendations ───────────────────────────────────────

  const fetchRecommendations = useCallback(async () => {
    if (!score || !province) return;
    setRecLoading(true);
    setRecError('');
    setPlanSaved(false);
    try {
      const st = subjectType || getSubjectOptions(province)[0]?.value || '物理类';
      const res = await fetch('/api/volunteer/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: Number(score),
          province,
          subjectType: st,
          year: 2025,
          rank: rankResult?.rank || undefined,
          preferredCities: preferences.cities.length ? preferences.cities : undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || '推荐方案生成失败，请稍后重试');
      }
      const data = await res.json();
      const rec = data.data ?? data;

      // Map rush/stable/safe tiers to flat Recommendation[]
      const items: Recommendation[] = [];
      const mapTier = (tier: 'rush' | 'stable' | 'safe', list: any[]) => {
        if (!Array.isArray(list)) return;
        for (let i = 0; i < list.length; i++) {
          const r = list[i];
          items.push({
            id: `${r.universityId ?? ''}_${r.majorId ?? ''}_${tier}_${i}`,
            university: String(r.universityName ?? r.university ?? ''),
            major: String(r.majorName ?? r.major ?? ''),
            avgScore: Number(r.historicalAvgScore ?? r.avgScore ?? r.historicalMinScore ?? 0),
            probability: Number(r.probability ?? 0),
            trend: 'stable' as const,
            category: tier,
          });
        }
      };
      mapTier('rush', rec.rush);
      mapTier('stable', rec.stable);
      mapTier('safe', rec.safe);

      // Fallback: if no rush/stable/safe structure, try flat list
      if (items.length === 0 && Array.isArray(rec)) {
        for (const r of rec) {
          items.push({
            id: String(r.universityId ?? r.id ?? items.length),
            university: String(r.universityName ?? r.university ?? ''),
            major: String(r.majorName ?? r.major ?? ''),
            avgScore: Number(r.historicalAvgScore ?? r.avgScore ?? 0),
            probability: Number(r.probability ?? 0),
            trend: 'stable' as const,
            category: (r.tier?.toLowerCase() as 'rush' | 'stable' | 'safe') ?? 'stable',
          });
        }
      }

      setRecommendations(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '推荐方案生成失败';
      setRecError(msg);
    } finally {
      setRecLoading(false);
    }
  }, [score, province, preferences]);

  // Auto-fetch recommendations when entering step 4
  useEffect(() => {
    if (currentStep === 3 && recommendations.length === 0 && !recLoading) {
      fetchRecommendations();
    }
  }, [currentStep, recommendations.length, recLoading, fetchRecommendations]);

  // ── Navigation ──────────────────────────────────────────────────────────

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return rankResult !== null;
      case 1:
        return true; // preferences are optional
      case 2:
        return logicAcknowledged;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (currentStep < 3 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ── Save plan ───────────────────────────────────────────────────────────

  const savePlan = async () => {
    try {
      const res = await fetch('/api/volunteer/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: Number(score),
          province,
          rank: rankResult?.rank,
          preferences,
          recommendations,
        }),
      });
      if (!res.ok) throw new Error('保存失败');
      setPlanSaved(true);
    } catch {
      setRecError('保存方案失败，请稍后重试');
    }
  };

  // ── Preference toggles ─────────────────────────────────────────────────

  const toggleCategory = (name: string) => {
    setPreferences((prev) => ({
      ...prev,
      categories: prev.categories.includes(name)
        ? prev.categories.filter((c) => c !== name)
        : [...prev.categories, name],
    }));
  };

  const toggleCity = (city: string) => {
    setPreferences((prev) => ({
      ...prev,
      cities: prev.cities.includes(city)
        ? prev.cities.filter((c) => c !== city)
        : [...prev.cities, city],
    }));
  };

  // ── Render: Progress indicator ─────────────────────────────────────────

  const renderProgress = () => (
    <div className="mb-8">
      {/* Desktop: horizontal */}
      <div className="hidden md:flex items-center justify-between">
        {STEP_LABELS.map((label, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={[
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors',
                    isCompleted
                      ? 'border-blue bg-blue text-white'
                      : isCurrent
                        ? 'border-blue bg-blue/10 text-blue'
                        : 'border-gray-300 bg-white text-gray-400',
                  ].join(' ')}
                >
                  {isCompleted ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    (() => { const StepIcon = STEP_ICONS[i]; return <StepIcon className="h-5 w-5" />; })()
                  )}
                </div>
                <span
                  className={[
                    'text-xs font-medium whitespace-nowrap',
                    isCurrent ? 'text-blue' : isCompleted ? 'text-text-primary' : 'text-text-tertiary',
                  ].join(' ')}
                >
                  {label}
                </span>
              </div>
              {i < 3 && (
                <div
                  className={[
                    'mx-3 h-0.5 flex-1 rounded-full transition-colors',
                    i < currentStep ? 'bg-blue' : 'bg-gray-200',
                  ].join(' ')}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical compact */}
      <div className="flex md:hidden items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue text-white text-xs font-bold">
          {currentStep + 1}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">
            第{currentStep + 1}步：{STEP_LABELS[currentStep]}
          </p>
          <p className="text-xs text-text-tertiary">共4步</p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={[
                'h-1.5 w-6 rounded-full transition-colors',
                i <= currentStep ? 'bg-blue' : 'bg-gray-200',
              ].join(' ')}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // ── Render: Step 1 — 查位次 ────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-text-primary">查位次</h2>
        <p className="mt-1 text-sm text-text-secondary">
          输入你的高考成绩和所在省份，系统帮你估算全省位次
        </p>
      </div>

      {/* Educational note */}
      <Card className="border-blue/20 bg-blue/5">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-accent mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-text-primary">为什么位次比分数更重要？</p>
            <p className="mt-1 text-sm text-text-secondary">
              分数会因年份难度变化，位次才是核心锚点。同一所大学在不同年份的录取分数线可能波动 10-20 分，但录取位次相对稳定。掌握位次，才能精准定位你的竞争力区间。
            </p>
          </div>
        </div>
      </Card>

      {/* Form */}
      <Card>
        <div className="space-y-5 p-2">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="高考分数"
              type="number"
              placeholder="例如：620"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              hint="填写你的实际高考成绩"
              size="lg"
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">所在省份</label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className={[
                  'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
                  !province ? 'text-gray-400' : 'text-gray-900',
                ].join(' ')}
              >
                <option value="">请选择省份</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 科类选择器 */}
          {province && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">科类</label>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                  {getGaokaoMode(province)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {getSubjectOptions(province).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSubjectType(opt.value)}
                    className={[
                      'rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all',
                      subjectType === opt.value
                        ? 'border-blue bg-blue/5 text-blue'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-blue/30 hover:bg-blue/5',
                    ].join(' ')}
                  >
                    <span>{opt.label}</span>
                    <span className="ml-1.5 text-xs text-text-tertiary">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input
            label="位次（选填）"
            type="number"
            placeholder="如果你已知道位次，可直接填写"
            value={rankInput}
            onChange={(e) => setRankInput(e.target.value)}
            hint="已知位次可跳过估算，直接使用该数据"
            size="lg"
          />

          {rankError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {rankError}
            </div>
          )}

          <Button
            onClick={fetchRank}
            loading={rankLoading}
            size="lg"
            className="w-full sm:w-auto"
          >
            查询位次
          </Button>
        </div>
      </Card>

      {/* Result */}
      {rankResult && (
        <Card className="border-blue/20">
          <div className="space-y-4 p-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-sm font-medium text-text-primary">位次查询完成</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-4 text-center">
                <p className="text-xs font-medium text-text-tertiary">预估位次</p>
                <p className="mt-1 text-2xl font-bold text-navy">
                  {rankResult.rank.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 text-center">
                <p className="text-xs font-medium text-text-tertiary">高考分数</p>
                <p className="mt-1 text-2xl font-bold text-text-primary">
                  {rankResult.score}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 text-center">
                <p className="text-xs font-medium text-text-tertiary">超过考生</p>
                <p className="mt-1 text-2xl font-bold text-blue">
                  {rankResult.percentile}%
                </p>
              </div>
            </div>

            {/* Visual rank indicator */}
            <div>
              <div className="flex items-center justify-between text-xs text-text-tertiary mb-1.5">
                <span>位次分布指示</span>
                <span>前 {rankResult.percentile}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue transition-all duration-700"
                  style={{ width: `${Math.min(100, rankResult.percentile)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-text-tertiary">
                <span>省状元</span>
                <span>末位</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  // ── Render: Step 2 — 定方向 ────────────────────────────────────────────

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary">定方向</h2>
        <p className="mt-1 text-sm text-text-secondary">
          选择你感兴趣的学科方向和目标城市，帮助系统精准推荐
        </p>
      </div>

      {/* Interest picker */}
      <Card>
        <div className="space-y-4 p-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">学科兴趣</h3>
            <span className="text-xs text-text-tertiary">
              已选 {preferences.categories.length} 个方向
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {CATEGORIES.map((cat) => {
              const selected = preferences.categories.includes(cat.name);
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => toggleCategory(cat.name)}
                  className={[
                    'relative flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all',
                    selected
                      ? 'border-blue bg-blue/5 text-blue'
                      : 'border-border bg-surface text-text-secondary hover:border-blue/30 hover:bg-blue/5',
                  ].join(' ')}
                >
                  <cat.icon className="h-6 w-6" />
                  <span className="text-xs font-medium">{cat.name}</span>
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue text-white">
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Optional: MBTI link */}
      <Card className="border-dashed">
        <div className="flex items-center gap-4 p-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50">
            <Brain className="h-5 w-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">更深入地了解自己</p>
            <p className="text-xs text-text-secondary">
              完成 MBTI / 霍兰德职业测评，获取更精准的专业匹配建议
            </p>
          </div>
          <Button variant="secondary" size="sm">
            开始测评
          </Button>
        </div>
      </Card>

      {/* Target cities */}
      <Card>
        <div className="space-y-4 p-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">目标城市（选填）</h3>
            <span className="text-xs text-text-tertiary">
              已选 {preferences.cities.length} 个城市
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {POPULAR_CITIES.map((city) => {
              const selected = preferences.cities.includes(city);
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => toggleCity(city)}
                  className={[
                    'rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
                    selected
                      ? 'border-blue bg-blue text-white'
                      : 'border-border bg-surface text-text-secondary hover:border-blue/30 hover:text-text-primary',
                  ].join(' ')}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );

  // ── Render: Step 3 — 理清填报逻辑 ──────────────────────────────────────

  const logicCards = [
    {
      title: '批次说明：提前批 vs 普通批',
      icon: ClipboardList,
      summary: '了解不同批次的填报时机与适用场景',
      detail: [
        '提前批：通常在普通批之前录取，包括军校、公安院校、公费师范生、航海类专业、小语种等特殊类型。填报提前批不影响普通批，相当于多一次机会。',
        '普通批：大部分考生主要的志愿填报批次，覆盖绝大多数院校和专业。采用平行志愿投档规则。',
        '建议：如果提前批中有你愿意就读的院校专业，建议填报；但不要为了"不浪费"而填不想去的专业。',
      ],
    },
    {
      title: '冲稳保策略',
      icon: Target,
      summary: '科学分配志愿梯度，最大化录取概率',
      detail: [
        '冲（RUSH）：选择录取位次略高于你位次的院校，概率约 20-40%。万一"冲上"就是赚到。',
        '稳（STABLE）：选择录取位次与你位次相当的院校，概率约 50-70%。是最有可能被录取的部分。',
        '保（SAFE）：选择录取位次明显低于你位次的院校，概率 80%+。确保不会"滑档"。',
        '建议比例：冲 30%、稳 40%、保 30%，根据个人风险偏好调整。',
      ],
    },
    {
      title: '平行志愿规则',
      icon: Ruler,
      summary: '理解"分数优先、遵循志愿"的投档逻辑',
      detail: [
        '平行志愿的核心规则：分数优先 —— 高分考生先投档，依次检索每位考生的志愿。',
        '遵循志愿 —— 按你填报的 A→B→C→D→E 顺序依次检索，一旦某个志愿院校有空位即投档。',
        '一轮投档 —— 每位考生在同一批次只有一次投档机会。投档后若被退档，只能参加征集志愿或下一批次。',
        '关键提醒：务必勾选"服从专业调剂"以降低退档风险！',
      ],
    },
    {
      title: '常见陷阱',
      icon: AlertTriangle,
      summary: '避开这些高频踩坑点，让每一分都不浪费',
      detail: [
        '陷阱一：只看分数不看位次 —— 每年分数线波动，位次才是真正的竞争力指标。',
        '陷阱二：全部填"冲"的院校 —— 没有"保底"志愿，一旦滑档后果严重。',
        '陷阱三：忽视专业调剂 —— 不服从调剂是退档的首要原因，尤其在平行志愿下。',
        '陷阱四：盲目追热门城市/专业 —— 竞争激烈导致实际录取位次远高于历年平均。',
        '陷阱五：忽略院校招生简章 —— 部分院校有身体条件、单科成绩等特殊要求。',
      ],
    },
  ];

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary">理清填报逻辑</h2>
        <p className="mt-1 text-sm text-text-secondary">
          在选学校之前，先搞懂志愿填报的核心规则
        </p>
      </div>

      <div className="space-y-3">
        {logicCards.map((card, i) => {
          const isExpanded = expandedCard === i;
          return (
            <Card key={i} noPadding>
              <button
                type="button"
                onClick={() => setExpandedCard(isExpanded ? null : i)}
                className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-gray-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy/5">
                  <card.icon className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">{card.title}</h3>
                  <p className="mt-0.5 text-xs text-text-secondary">{card.summary}</p>
                </div>
                <svg
                  className={[
                    'h-5 w-5 shrink-0 text-text-tertiary transition-transform duration-200',
                    isExpanded ? 'rotate-180' : '',
                  ].join(' ')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="border-t border-border px-5 pb-5 pt-4">
                  <div className="space-y-3">
                    {card.detail.map((text, j) => (
                      <div key={j} className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />
                        <p className="text-sm text-text-secondary leading-relaxed">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* 冲稳保 visual diagram */}
      <Card>
        <div className="space-y-4 p-2">
          <h3 className="text-sm font-semibold text-text-primary">冲稳保策略示意</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 rounded-xl border-2 border-orange-200 bg-orange-50 p-4 text-center">
              <p className="text-lg font-bold text-orange-600">冲</p>
              <p className="text-2xl font-bold text-orange-500 mt-1">RUSH</p>
              <p className="mt-2 text-xs text-text-secondary">录取概率 20-40%</p>
              <p className="text-xs text-text-tertiary mt-1">位次略高于你</p>
            </div>
            <div className="flex-1 rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-center">
              <p className="text-lg font-bold text-blue-600">稳</p>
              <p className="text-2xl font-bold text-blue-500 mt-1">STABLE</p>
              <p className="mt-2 text-xs text-text-secondary">录取概率 50-70%</p>
              <p className="text-xs text-text-tertiary mt-1">位次与你相当</p>
            </div>
            <div className="flex-1 rounded-xl border-2 border-green-200 bg-green-50 p-4 text-center">
              <p className="text-lg font-bold text-green-600">保</p>
              <p className="text-2xl font-bold text-green-500 mt-1">SAFE</p>
              <p className="mt-2 text-xs text-text-secondary">录取概率 80%+</p>
              <p className="text-xs text-text-tertiary mt-1">位次低于你</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Acknowledge button */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={logicAcknowledged}
            onChange={(e) => setLogicAcknowledged(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-text-primary">我已理解以上填报逻辑，继续生成方案</span>
        </label>
      </div>
    </div>
  );

  // ── Render: Step 4 — 生成推荐方案 ──────────────────────────────────────

  const grouped = {
    rush: recommendations.filter((r) => r.category === 'rush'),
    stable: recommendations.filter((r) => r.category === 'stable'),
    safe: recommendations.filter((r) => r.category === 'safe'),
  };

  const categoryConfig = {
    rush: {
      label: '冲',
      sublabel: 'RUSH',
      border: 'border-orange-200',
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      badge: 'bg-orange-100 text-orange-700',
      icon: Flame,
    },
    stable: {
      label: '稳',
      sublabel: 'STABLE',
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-700',
      icon: Target,
    },
    safe: {
      label: '保',
      sublabel: 'SAFE',
      border: 'border-green-200',
      bg: 'bg-green-50',
      text: 'text-green-600',
      badge: 'bg-green-100 text-green-700',
      icon: Shield,
    },
  } as const;

  const renderRecCard = (rec: Recommendation, cat: 'rush' | 'stable' | 'safe') => {
    const cfg = categoryConfig[cat];
    return (
      <div
        key={rec.id}
        className={[
          'rounded-xl border bg-white p-4 transition-colors hover:bg-gray-50',
          cfg.border,
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-text-primary truncate">
              {rec.university}
            </h4>
            <p className="mt-0.5 text-xs text-text-secondary truncate">{rec.major}</p>
          </div>
          <span className={['shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', cfg.badge].join(' ')}>
            {cfg.label}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-text-tertiary">历年均分</p>
            <p className="text-sm font-bold text-text-primary">{rec.avgScore}</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">录取概率</p>
            <p className={['text-sm font-bold', probabilityColor(rec.probability)].join(' ')}>
              {rec.probability}%
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">趋势</p>
            <p className={['text-sm font-bold', rec.trend === 'up' ? 'text-red-500' : rec.trend === 'down' ? 'text-green-500' : 'text-text-secondary'].join(' ')}>
              {trendArrow(rec.trend)} {trendLabel(rec.trend)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">生成推荐方案</h2>
          <p className="mt-1 text-sm text-text-secondary">
            根据你的位次和偏好，智能推荐院校专业组合
          </p>
        </div>
        {recommendations.length > 0 && (
          <Button variant="secondary" size="sm" onClick={fetchRecommendations} loading={recLoading}>
            重新生成
          </Button>
        )}
      </div>

      {/* Loading */}
      {recLoading && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue" />
            </div>
            <p className="mt-4 text-sm font-medium text-text-primary">正在生成推荐方案...</p>
            <p className="mt-1 text-xs text-text-tertiary">
              基于你的位次、兴趣和目标城市，匹配最优院校专业组合
            </p>
          </div>
        </Card>
      )}

      {/* Error */}
      {recError && !recLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{recError}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={fetchRecommendations}>
            重试
          </Button>
        </div>
      )}

      {/* Results */}
      {!recLoading && !recError && recommendations.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            {(['rush', 'stable', 'safe'] as const).map((cat) => {
              const cfg = categoryConfig[cat];
              const count = grouped[cat].length;
              return (
                <div
                  key={cat}
                  className={['rounded-xl border p-4 text-center', cfg.border, cfg.bg].join(' ')}
                >
                  <p className="text-lg"><cfg.icon className="h-5 w-5 inline-block" /></p>
                  <p className={['text-lg font-bold', cfg.text].join(' ')}>
                    {cfg.label} · {cfg.sublabel}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">{count}</p>
                  <p className="text-xs text-text-tertiary">所院校</p>
                </div>
              );
            })}
          </div>

          {/* Three columns on desktop, stacked on mobile */}
          <div className="grid gap-6 lg:grid-cols-3">
            {(['rush', 'stable', 'safe'] as const).map((cat) => {
              const cfg = categoryConfig[cat];
              const items = grouped[cat];
              return (
                <div key={cat}>
                  <div className={['flex items-center gap-2 mb-3 rounded-lg px-3 py-2', cfg.bg].join(' ')}>
                    <cfg.icon className="h-5 w-5" />
                    <span className={['text-sm font-bold', cfg.text].join(' ')}>
                      {cfg.label} · {cfg.sublabel}
                    </span>
                    <span className="ml-auto text-xs text-text-tertiary">{items.length} 所</span>
                  </div>
                  <div className="space-y-3">
                    {items.length === 0 ? (
                      <p className="text-center text-sm text-text-tertiary py-6">暂无推荐</p>
                    ) : (
                      items.map((rec) => renderRecCard(rec, cat))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save button */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <Button
              size="lg"
              onClick={savePlan}
              disabled={planSaved}
            >
              {planSaved ? '方案已保存' : '保存为方案'}
            </Button>
            {planSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                方案已成功保存
              </span>
            )}
          </div>
        </>
      )}

      {/* Empty state (no loading, no error, no results) */}
      {!recLoading && !recError && recommendations.length === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <Search className="h-10 w-10 text-text-tertiary" />
            <p className="mt-3 text-sm text-text-secondary">暂无推荐结果</p>
            <p className="mt-1 text-xs text-text-tertiary">请尝试调整分数或偏好后重新生成</p>
          </div>
        </Card>
      )}
    </div>
  );

  // ── Main Render ─────────────────────────────────────────────────────────

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">志愿智能推荐</h1>
        <p className="mt-1 text-sm text-text-secondary">
          先查位次、再定方向、理清填报逻辑，最后才选学校
        </p>
      </div>

      {/* Progress */}
      {renderProgress()}

      {/* Step content */}
      <div className="min-h-[400px]">
        {stepRenderers[currentStep]()}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
        <div>
          {currentStep > 0 && (
            <Button variant="secondary" size="lg" onClick={goBack}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              上一步
            </Button>
          )}
        </div>
        <div>
          {currentStep < 3 && (
            <Button
              size="lg"
              onClick={goNext}
              disabled={!canProceed()}
            >
              下一步
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
