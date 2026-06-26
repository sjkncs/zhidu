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
} from 'lucide-react';

interface SearchResult {
  id: string;
  content: string;
  score: number;
  title: string;
  collection: string;
  sourceUrl: string | null;
}

interface Collection {
  key: string;
  label: string;
}

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

function scoreColor(score: number): string {
  if (score >= 0.5) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 0.2) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-gray-500 bg-gray-50 border-gray-200';
}

export default function KnowledgePage() {
  const [query, setQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(
    async (searchQuery: string, collection: string) => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setIsLoading(true);
      setHasSearched(true);

      try {
        const res = await fetch('/api/knowledge/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery.trim(),
            collections: collection ? [collection] : undefined,
            topK: 15,
          }),
        });

        if (!res.ok) throw new Error('搜索失败');

        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // 防抖搜索
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      doSearch(query, selectedCollection);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedCollection, doSearch]);

  const handleTopicClick = (topic: string) => {
    setQuery(topic);
  };

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

      {/* Collection filter chips */}
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

        {/* Results list */}
        {!isLoading && results.length > 0 && (
          <div className="flex flex-col gap-3">
            {results.map((result) => {
              const isExpanded = expandedId === result.id;
              const collection = result.collection || 'general';

              return (
                <div
                  key={result.id}
                  className="rounded-xl border border-border bg-surface transition-colors hover:border-blue/20"
                >
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : result.id)
                    }
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-text-primary">
                          {result.title}
                        </h3>
                        <Badge
                          color={collectionBadgeColor[collection] ?? 'gray'}
                        >
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}
