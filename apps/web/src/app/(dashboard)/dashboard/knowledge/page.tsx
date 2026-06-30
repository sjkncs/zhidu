'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Badge } from '@zhidu/ui';
import {
  BookOpen,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  GraduationCap,
  BookMarked,
  FileText,
  MapPin,
  Briefcase,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResultType = 'university' | 'major' | 'knowledge_chunk';
type SearchMode = 'all' | 'structured' | 'knowledge';

interface UniversityMetadata {
  province?: string;
  tier?: string;
  is_985?: boolean;
  is_211?: boolean;
  school_type?: string;
  founding_year?: number;
  tags?: string[];
}

interface MajorMetadata {
  category?: string;
  discipline_category?: string;
  degree?: string;
  employment_rate?: number;
}

interface UnifiedResult {
  type: ResultType;
  id: string;
  title: string;
  content: string;
  metadata: UniversityMetadata | MajorMetadata | Record<string, any>;
  score: number;
}

interface Collection {
  key: string;
  label: string;
}

interface ModeOption {
  key: SearchMode;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const modeOptions: ModeOption[] = [
  { key: 'all', label: '全部' },
  { key: 'structured', label: '仅院校' },
  { key: 'structured', label: '仅专业' },
  { key: 'knowledge', label: '仅知识' },
];

// Use distinct keys so React can differentiate
const modeFilters: { key: string; mode: SearchMode; label: string; categoryFilter?: string }[] = [
  { key: 'all', mode: 'all', label: '全部' },
  { key: 'university', mode: 'structured', label: '仅院校', categoryFilter: 'university' },
  { key: 'major', mode: 'structured', label: '仅专业', categoryFilter: 'major' },
  { key: 'knowledge', mode: 'knowledge', label: '仅知识' },
];

const collections: Collection[] = [
  { key: '', label: '全部' },
  { key: 'policy', label: '招生政策' },
  { key: 'major_intro', label: '专业介绍' },
  { key: 'career', label: '职业发展' },
  { key: 'volunteer', label: '志愿指南' },
  { key: 'general', label: '综合' },
];

const collectionBadgeColor: Record<string, 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple'> = {
  policy: 'blue',
  major_intro: 'green',
  career: 'purple',
  volunteer: 'yellow',
  general: 'gray',
};

const collectionLabels: Record<string, string> = {
  policy: '招生政策',
  major_intro: '专业介绍',
  career: '职业发展',
  volunteer: '志愿指南',
  general: '综合',
};

const popularTopics = [
  '平行志愿规则',
  '985 高校',
  '计算机专业',
  '医学专业就业',
  '新高考选科',
  '冲稳保策略',
  '投档线',
  '金融学',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 0.5) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 0.2) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-gray-500 bg-gray-50 border-gray-200';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UniversityCard({
  result,
  isExpanded,
  onToggle,
}: {
  result: UnifiedResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const meta = result.metadata as UniversityMetadata;

  return (
    <div className="rounded-xl border border-blue-200/60 bg-blue-50/30 transition-colors hover:border-blue-300">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
          <GraduationCap className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold text-text-primary">
              {result.title}
            </h3>
            {meta.is_985 && (
              <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                985
              </span>
            )}
            {meta.is_211 && (
              <span className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                211
              </span>
            )}
            {meta.tier === '双一流' && (
              <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                双一流
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-secondary">
            {meta.province && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {meta.province}
              </span>
            )}
            {meta.school_type && <span>{meta.school_type}</span>}
            {meta.founding_year && <span>创办于 {meta.founding_year}</span>}
          </div>
          {isExpanded && result.content && (
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              {result.content}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${scoreColor(result.score)}`}
          >
            {(result.score * 100).toFixed(0)}%
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-text-tertiary" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
          )}
        </div>
      </button>
    </div>
  );
}

function MajorCard({
  result,
  isExpanded,
  onToggle,
}: {
  result: UnifiedResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const meta = result.metadata as MajorMetadata;

  return (
    <div className="rounded-xl border border-green-200/60 bg-green-50/30 transition-colors hover:border-green-300">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100">
          <BookMarked className="h-4 w-4 text-green-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold text-text-primary">
              {result.title}
            </h3>
            {meta.employment_rate != null && meta.employment_rate > 0 && (
              <span className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                就业率 {(meta.employment_rate * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-secondary">
            {meta.category && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {meta.category}
              </span>
            )}
            {meta.discipline_category && <span>{meta.discipline_category}</span>}
            {meta.degree && <span>{meta.degree}</span>}
          </div>
          {isExpanded && result.content && (
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              {result.content}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${scoreColor(result.score)}`}
          >
            {(result.score * 100).toFixed(0)}%
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-text-tertiary" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
          )}
        </div>
      </button>
    </div>
  );
}

function KnowledgeCard({
  result,
  isExpanded,
  onToggle,
}: {
  result: UnifiedResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const meta = result.metadata as Record<string, any>;
  const collection = meta?.collection || 'general';

  return (
    <div className="rounded-xl border border-border bg-surface transition-colors hover:border-blue/20">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
          <FileText className="h-4 w-4 text-gray-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary">
              {result.title}
            </h3>
            <Badge color={collectionBadgeColor[collection] ?? 'gray'}>
              {collectionLabels[collection] ?? collection}
            </Badge>
          </div>
          <p
            className={[
              'mt-1 text-xs text-text-secondary',
              isExpanded ? '' : 'line-clamp-2',
            ].join(' ')}
          >
            {result.content}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${scoreColor(result.score)}`}
          >
            {(result.score * 100).toFixed(0)}%
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-text-tertiary" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
          )}
        </div>
      </button>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  accentColor,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  accentColor: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className={`flex h-6 w-6 items-center justify-center rounded-md ${accentColor}`}>
        {icon}
      </div>
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
        {count}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KnowledgePage() {
  const [query, setQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [results, setResults] = useState<UnifiedResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive mode & category filter from the selected mode filter
  const activeModeFilter = modeFilters.find((m) => m.key === selectedMode) ?? modeFilters[0];

  const doSearch = useCallback(
    async (
      searchQuery: string,
      modeFilter: (typeof modeFilters)[number],
      collection: string,
    ) => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setIsLoading(true);
      setHasSearched(true);

      try {
        const filters: Record<string, any> = {};
        if (collection) filters.collection = collection;
        // When filtering by category, pass category to server
        if (modeFilter.categoryFilter) filters.category = modeFilter.categoryFilter;

        const res = await fetch('/api/knowledge/unified-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery.trim(),
            mode: modeFilter.mode,
            filters: Object.keys(filters).length > 0 ? filters : undefined,
            topK: 20,
          }),
        });

        if (!res.ok) throw new Error('搜索失败');

        const data = await res.json();
        const raw: UnifiedResult[] = data.data?.results ?? [];

        // Client-side filter by type when categoryFilter is set (server may return mixed)
        if (modeFilter.categoryFilter) {
          setResults(raw.filter((r) => r.type === modeFilter.categoryFilter));
        } else {
          setResults(raw);
        }
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      doSearch(query, activeModeFilter, selectedCollection);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedMode, selectedCollection, doSearch, activeModeFilter]);

  const handleTopicClick = (topic: string) => {
    setQuery(topic);
  };

  // Group results by type
  const universityResults = results.filter((r) => r.type === 'university');
  const majorResults = results.filter((r) => r.type === 'major');
  const knowledgeResults = results.filter((r) => r.type === 'knowledge_chunk');

  // Show collection chips only when mode includes knowledge
  const showCollectionFilters =
    activeModeFilter.mode === 'all' || activeModeFilter.mode === 'knowledge';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
          <BookOpen className="h-5 w-5 text-navy" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">知识库</h1>
          <p className="text-sm text-text-secondary">
            搜索院校信息、专业介绍、招生政策、职业规划等知识
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入关键词搜索知识库..."
          className={[
            'w-full rounded-xl border border-border bg-surface py-3 pl-11 pr-10 text-sm text-text-primary',
            'placeholder:text-text-tertiary',
            'focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue',
            'transition-colors',
          ].join(' ')}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-tertiary hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Mode filter chips */}
      <div className="flex flex-wrap gap-2">
        {modeFilters.map((mf) => (
          <button
            key={mf.key}
            onClick={() => setSelectedMode(mf.key)}
            className={[
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              selectedMode === mf.key
                ? 'border-blue bg-blue/10 text-blue'
                : 'border-border text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
            ].join(' ')}
          >
            {mf.label}
          </button>
        ))}
      </div>

      {/* Collection filter chips (only for knowledge mode) */}
      {showCollectionFilters && (
        <div className="flex flex-wrap gap-2">
          {collections.map((col) => (
            <button
              key={col.key}
              onClick={() => setSelectedCollection(col.key)}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                selectedCollection === col.key
                  ? 'border-blue bg-blue/10 text-blue'
                  : 'border-border text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
              ].join(' ')}
            >
              {col.label}
            </button>
          ))}
        </div>
      )}

      {/* Results area */}
      <div className="min-h-[300px]">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue border-t-transparent" />
            <span className="ml-2 text-sm text-text-secondary">搜索中...</span>
          </div>
        )}

        {/* Empty state (no query) */}
        {!isLoading && !hasSearched && (
          <div className="py-12 text-center">
            <Search className="mx-auto mb-4 h-10 w-10 text-text-tertiary" />
            <p className="mb-6 text-sm text-text-secondary">
              输入关键词搜索知识库，或试试以下热门话题
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {popularTopics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => handleTopicClick(topic)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-blue/40 hover:bg-background hover:text-text-primary"
                >
                  <Sparkles className="h-3 w-3" />
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {!isLoading && hasSearched && results.length === 0 && (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-10 w-10 text-text-tertiary" />
            <p className="text-sm text-text-secondary">
              未找到相关内容，试试其他关键词
            </p>
          </div>
        )}

        {/* Grouped results */}
        {!isLoading && results.length > 0 && (
          <div className="space-y-6">
            {/* Universities section */}
            {universityResults.length > 0 && (
              <div className="space-y-2">
                <SectionHeader
                  icon={<GraduationCap className="h-3.5 w-3.5 text-blue-600" />}
                  title="院校"
                  count={universityResults.length}
                  accentColor="bg-blue-100"
                />
                <div className="flex flex-col gap-2">
                  {universityResults.map((result) => (
                    <UniversityCard
                      key={result.id}
                      result={result}
                      isExpanded={expandedId === result.id}
                      onToggle={() =>
                        setExpandedId(expandedId === result.id ? null : result.id)
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Majors section */}
            {majorResults.length > 0 && (
              <div className="space-y-2">
                <SectionHeader
                  icon={<BookMarked className="h-3.5 w-3.5 text-green-600" />}
                  title="专业"
                  count={majorResults.length}
                  accentColor="bg-green-100"
                />
                <div className="flex flex-col gap-2">
                  {majorResults.map((result) => (
                    <MajorCard
                      key={result.id}
                      result={result}
                      isExpanded={expandedId === result.id}
                      onToggle={() =>
                        setExpandedId(expandedId === result.id ? null : result.id)
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Knowledge chunks section */}
            {knowledgeResults.length > 0 && (
              <div className="space-y-2">
                <SectionHeader
                  icon={<FileText className="h-3.5 w-3.5 text-gray-500" />}
                  title="知识"
                  count={knowledgeResults.length}
                  accentColor="bg-gray-100"
                />
                <div className="flex flex-col gap-2">
                  {knowledgeResults.map((result) => (
                    <KnowledgeCard
                      key={result.id}
                      result={result}
                      isExpanded={expandedId === result.id}
                      onToggle={() =>
                        setExpandedId(expandedId === result.id ? null : result.id)
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
