'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Frown,
  Meh,
  Smile,
  BookOpen,
  Save,
  ChevronDown,
  ChevronUp,
  Calendar,
  TrendingUp,
  Sparkles,
  Clock,
  Hash,
  FileText,
  Loader2,
  AlertCircle,
  PenLine,
  BarChart3,
  Heart,
  Lightbulb,
  Quote,
  Filter,
  Plus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiaryWriterProps {
  onEntryCreated?: () => void;
}

interface DiaryEntry {
  id: string;
  title: string | null;
  content: string;
  mood: number | null;
  moodTags: string[];
  entryDate: string;
  createdAt: string;
}

interface GrowthInsight {
  overallMood: number;
  moodTrend: string;
  moodInsight: string;
  topEmotions: Array<{ tag: string; count: number; interpretation: string }>;
  growthAreas: Array<{ area: string; observation: string; suggestion: string }>;
  journalingHabits: { frequency: string; consistency: string; depth: string };
  monthlyHighlight: string;
  affirmation: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOOD_TAGS = [
  '开心',
  '平静',
  '感恩',
  '兴奋',
  '焦虑',
  '疲惫',
  '充实',
  '迷茫',
  '满足',
  '期待',
] as const;

const DIARY_TEMPLATES: Record<string, string> = {
  '今日总结':
    '## 今日总结\n\n### 完成了什么\n- \n\n### 遇到的挑战\n- \n\n### 明天计划\n- ',
  '感恩日记': '## 感恩日记\n\n今天让我感恩的三件事：\n\n1. \n2. \n3. \n\n### 感受\n',
  '学习计划':
    '## 学习复盘\n\n### 今日学习内容\n- \n\n### 难点记录\n- \n\n### 明日目标\n- ',
  '自由书写': '',
};

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function moodIcon(score: number | null) {
  if (score === null) return <Meh className="w-5 h-5" />;
  if (score <= 3) return <Frown className="w-5 h-5" />;
  if (score <= 6) return <Meh className="w-5 h-5" />;
  return <Smile className="w-5 h-5" />;
}

function moodColor(score: number | null): string {
  if (score === null) return 'bg-text-tertiary/30';
  if (score >= 8) return 'bg-green-500';
  if (score >= 5) return 'bg-blue-500';
  if (score >= 3) return 'bg-amber-500';
  return 'bg-red-500';
}

function moodBarColor(score: number): string {
  if (score >= 8) return 'bg-green-500';
  if (score >= 5) return 'bg-blue-400';
  if (score >= 3) return 'bg-amber-400';
  return 'bg-red-400';
}

function moodLabel(score: number): string {
  if (score <= 2) return '很低落';
  if (score <= 4) return '有些低';
  if (score <= 6) return '还不错';
  if (score <= 8) return '挺好的';
  return '非常棒';
}

function truncate(text: string, len: number): string {
  if (text.length <= len) return text;
  return text.slice(0, len) + '...';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Section: Mood Check-in
// ---------------------------------------------------------------------------

function MoodCheckin({
  mood,
  setMood,
  selectedTags,
  toggleTag,
}: {
  mood: number;
  setMood: (v: number) => void;
  selectedTags: string[];
  toggleTag: (tag: string) => void;
}) {
  return (
    <section className="bg-surface border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <Heart className="w-5 h-5 text-blue" />
        今日心情打卡
      </h2>

      {/* Slider row */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-shrink-0 text-text-secondary">{moodIcon(mood)}</div>
        <div className="flex-1">
          <input
            type="range"
            min={1}
            max={10}
            value={mood}
            onChange={(e) => setMood(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue bg-border"
          />
          <div className="flex justify-between mt-1 text-xs text-text-tertiary">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-center min-w-[56px]">
          <span className="text-2xl font-bold text-blue">{mood}</span>
          <p className="text-xs text-text-tertiary">{moodLabel(mood)}</p>
        </div>
      </div>

      {/* Mood tag chips */}
      <p className="text-sm text-text-secondary mb-3">选择心情标签（可多选）</p>
      <div className="flex flex-wrap gap-2">
        {MOOD_TAGS.map((tag) => {
          const active = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                active
                  ? 'bg-blue/10 text-blue border-blue/30'
                  : 'bg-surface text-text-secondary border-border hover:border-blue/30 hover:text-blue'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Diary Editor
// ---------------------------------------------------------------------------

function DiaryEditor({
  title,
  setTitle,
  content,
  setContent,
  mood,
  selectedTags,
  saving,
  saveError,
  onSave,
}: {
  title: string;
  setTitle: (v: string) => void;
  content: string;
  setContent: (v: string) => void;
  mood: number;
  selectedTags: string[];
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
}) {
  const [monoFont, setMonoFont] = useState(false);
  const wordCount = content.replace(/\s/g, '').length;

  return (
    <section className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <PenLine className="w-5 h-5 text-blue" />
          日记编辑
        </h2>
        <button
          type="button"
          onClick={() => setMonoFont((p) => !p)}
          className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {monoFont ? '默认字体' : '等宽字体'}
        </button>
      </div>

      {/* Template buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(DIARY_TEMPLATES).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setContent(DIARY_TEMPLATES[name])}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue/10 text-blue hover:bg-blue/20 transition-colors"
          >
            {name}
          </button>
        ))}
      </div>

      {/* Title */}
      <input
        type="text"
        placeholder="标题（可选）"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-transparent border-b border-border pb-2 mb-3 text-text-primary placeholder:text-text-tertiary outline-none focus:border-blue transition-colors"
      />

      {/* Content textarea */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下今天的所思所想..."
        rows={10}
        className={`w-full bg-transparent border border-border rounded-lg p-4 text-text-primary placeholder:text-text-tertiary outline-none focus:border-blue transition-colors resize-y ${
          monoFont ? 'font-mono text-sm' : 'text-sm leading-relaxed'
        }`}
      />

      {/* Footer row */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          <span className="flex items-center gap-1">
            <Hash className="w-3.5 h-3.5" />
            {wordCount} 字
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(todayStr())}
          </span>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || !content.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存日记
        </button>
      </div>

      {saveError && (
        <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {saveError}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Timeline View
// ---------------------------------------------------------------------------

function TimelineEntry({ entry }: { entry: DiaryEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      {/* Vertical line */}
      <div className="absolute left-3 top-3 bottom-0 w-px bg-border last:hidden" />
      {/* Dot */}
      <div
        className={`absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-surface ${moodColor(
          entry.mood,
        )}`}
      />

      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full text-left group"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-text-tertiary">{formatDate(entry.entryDate)}</span>
          {entry.mood !== null && (
            <span className="flex items-center gap-1 text-xs text-text-tertiary">
              {moodIcon(entry.mood)}
              <span>{entry.mood}/10</span>
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-text-tertiary ml-auto" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-text-tertiary ml-auto" />
          )}
        </div>

        <h4 className="text-sm font-medium text-text-primary mb-0.5">
          {entry.title || '无标题'}
        </h4>

        {!expanded && (
          <p className="text-xs text-text-secondary leading-relaxed">
            {truncate(entry.content, 100)}
          </p>
        )}
      </button>

      {expanded && (
        <div className="mt-2">
          <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {entry.content}
          </div>
          {entry.moodTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {entry.moodTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-xs bg-blue/10 text-blue"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineView({
  entries,
  loading,
  hasMore,
  monthFilter,
  setMonthFilter,
  availableMonths,
  onLoadMore,
}: {
  entries: DiaryEntry[];
  loading: boolean;
  hasMore: boolean;
  monthFilter: string;
  setMonthFilter: (v: string) => void;
  availableMonths: string[];
  onLoadMore: () => void;
}) {
  return (
    <section className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue" />
          时间轴
        </h2>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-tertiary" />
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="text-sm bg-transparent border border-border rounded-lg px-2 py-1 text-text-secondary outline-none focus:border-blue"
          >
            <option value="">全部月份</option>
            {availableMonths.map((m) => {
              const [y, mo] = m.split('-');
              return (
                <option key={m} value={m}>
                  {y}年{Number(mo)}月
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-text-tertiary">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-sm">加载中...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-text-tertiary">
          <FileText className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">还没有日记条目</p>
          <p className="text-xs mt-1">写下今天的第一篇日记吧</p>
        </div>
      ) : (
        <>
          <div>
            {entries.map((entry) => (
              <TimelineEntry key={entry.id} entry={entry} />
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loading}
              className="mt-4 w-full py-2 text-sm text-blue hover:bg-blue/5 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              加载更多
            </button>
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Mood Trend (CSS-only bar chart)
// ---------------------------------------------------------------------------

function MoodTrend({ entries }: { entries: DiaryEntry[] }) {
  // Build 30-day data
  const days: { date: string; mood: number | null; label: string }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const entry = entries.find((e) => e.entryDate === iso);
    days.push({
      date: iso,
      mood: entry?.mood ?? null,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
    });
  }

  // 7-day moving average
  const averages: (number | null)[] = days.map((_, idx) => {
    if (idx < 6) return null;
    const window = days.slice(idx - 6, idx + 1);
    const valid = window.filter((d) => d.mood !== null);
    if (valid.length === 0) return null;
    return valid.reduce((s, d) => s + (d.mood ?? 0), 0) / valid.length;
  });

  // Stats
  const validMoods = entries.filter((e) => e.mood !== null).map((e) => e.mood as number);
  const avgMood = validMoods.length
    ? (validMoods.reduce((a, b) => a + b, 0) / validMoods.length).toFixed(1)
    : '--';

  const tagCounts: Record<string, number> = {};
  entries.forEach((e) => e.moodTags.forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1)));
  const topTag =
    Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '--';

  // Streak: consecutive days with entries ending at most recent
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const iso = daysAgo(i);
    if (entries.some((e) => e.entryDate === iso)) {
      streak++;
    } else {
      break;
    }
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-blue" />
        情绪趋势
      </h2>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-blue">{avgMood}</p>
          <p className="text-xs text-text-tertiary mt-0.5">平均心情</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary">{topTag}</p>
          <p className="text-xs text-text-tertiary mt-0.5">最常见情绪</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary">{streak}</p>
          <p className="text-xs text-text-tertiary mt-0.5">连续记录天数</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="relative">
        <div className="flex items-end gap-[3px] h-32">
          {days.map((day, idx) => {
            const height = day.mood !== null ? (day.mood / 10) * 100 : 0;
            const avg = averages[idx];
            const avgHeight = avg !== null ? (avg / 10) * 100 : null;
            return (
              <div
                key={day.date}
                className="relative flex-1 flex items-end group"
                style={{ height: '100%' }}
              >
                {/* 7-day avg line marker */}
                {avgHeight !== null && (
                  <div
                    className="absolute left-0 right-0 h-px bg-text-primary/30 z-10"
                    style={{ bottom: `${avgHeight}%` }}
                  />
                )}
                {/* Bar */}
                {day.mood !== null ? (
                  <div
                    className={`w-full rounded-t-sm transition-all ${moodBarColor(day.mood)} group-hover:opacity-80`}
                    style={{ height: `${height}%` }}
                  />
                ) : (
                  <div className="w-full h-1 bg-border rounded-t-sm" />
                )}
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-20">
                  <div className="bg-text-primary text-surface text-xs rounded px-2 py-1 whitespace-nowrap">
                    {day.label} | {day.mood ?? '-'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1.5 text-[10px] text-text-tertiary">
          <span>{days[0]?.label}</span>
          <span>{days[14]?.label}</span>
          <span>{days[29]?.label}</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 justify-center text-xs text-text-tertiary">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> 高 (8-10)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> 中 (5-7)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> 低 (3-4)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-400" /> 很低 (1-2)
          </span>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: AI Growth Insights
// ---------------------------------------------------------------------------

function GrowthInsightsPanel() {
  const [insight, setInsight] = useState<GrowthInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInsight(null);
    try {
      const res = await fetch('/api/diary/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: '30d' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `请求失败 (${res.status})`);
      }
      const json = await res.json();
      setInsight(json.data as GrowthInsight);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '生成洞察报告时出错';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section className="bg-surface border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue" />
          AI 成长洞察
        </h2>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          生成洞察报告
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-20 bg-border/50 rounded-lg" />
          <div className="h-32 bg-border/50 rounded-lg" />
          <div className="h-24 bg-border/50 rounded-lg" />
          <div className="h-16 bg-border/50 rounded-lg" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-lg bg-red-500/10 text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">生成失败</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {insight && !loading && (
        <div className="space-y-5">
          {/* Overall mood */}
          <div className="p-4 rounded-lg bg-blue/5 border border-blue/10">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-blue" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  综合心情评分：{insight.overallMood.toFixed(1)}
                </p>
                <p className="text-xs text-text-secondary">{insight.moodTrend}</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{insight.moodInsight}</p>
          </div>

          {/* Top emotions */}
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-blue" />
              高频情绪
            </h3>
            <div className="space-y-2">
              {insight.topEmotions.map((e) => (
                <div
                  key={e.tag}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border"
                >
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue/10 text-blue font-medium flex-shrink-0">
                    {e.tag} ({e.count}次)
                  </span>
                  <p className="text-sm text-text-secondary">{e.interpretation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Growth areas */}
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-blue" />
              成长建议
            </h3>
            <div className="space-y-3">
              {insight.growthAreas.map((g) => (
                <div key={g.area} className="p-3 rounded-lg border border-border">
                  <p className="text-sm font-medium text-text-primary mb-1">{g.area}</p>
                  <p className="text-xs text-text-secondary mb-2">{g.observation}</p>
                  <p className="text-xs text-blue">{g.suggestion}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Journaling habits */}
          <div className="p-4 rounded-lg border border-border">
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue" />
              记录习惯
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-text-tertiary">频率</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">
                  {insight.journalingHabits.frequency}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">持续性</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">
                  {insight.journalingHabits.consistency}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">深度</p>
                <p className="text-sm font-medium text-text-primary mt-0.5">
                  {insight.journalingHabits.depth}
                </p>
              </div>
            </div>
          </div>

          {/* Monthly highlight */}
          {insight.monthlyHighlight && (
            <div className="p-4 rounded-lg bg-blue/5 border border-blue/10">
              <p className="text-xs text-text-tertiary mb-1">本月亮点</p>
              <p className="text-sm text-text-primary">{insight.monthlyHighlight}</p>
            </div>
          )}

          {/* Affirmation */}
          <div className="p-4 rounded-lg bg-surface border border-border text-center">
            <Quote className="w-5 h-5 text-blue mx-auto mb-2" />
            <p className="text-sm text-text-primary italic leading-relaxed">
              {insight.affirmation}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DiaryWriter({ onEntryCreated }: DiaryWriterProps) {
  // Editor state
  const [mood, setMood] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Timeline state
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [monthFilter, setMonthFilter] = useState('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // Active tab for mobile / compact layout
  const [activeTab, setActiveTab] = useState<'write' | 'timeline' | 'trends' | 'insights'>(
    'write',
  );

  // Toggle a mood tag
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  // Fetch diary entries
  const fetchEntries = useCallback(
    async (pageNum: number, append: boolean) => {
      setEntriesLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String((pageNum - 1) * PAGE_SIZE));
        if (monthFilter) {
          const [year, month] = monthFilter.split('-');
          const startDate = `${year}-${month}-01`;
          const endDate =
            month === '12'
              ? `${Number(year) + 1}-01-01`
              : `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`;
          params.set('startDate', startDate);
          params.set('endDate', endDate);
        }

        const res = await fetch(`/api/diary?${params.toString()}`);
        if (!res.ok) throw new Error(`获取日记失败 (${res.status})`);
        const json = await res.json();
        const data: DiaryEntry[] = json.data ?? json;

        setEntries((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length >= PAGE_SIZE);

        // Derive available months from entries
        if (!append) {
          const months = new Set<string>();
          data.forEach((e: DiaryEntry) => {
            const d = new Date(e.entryDate);
            months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          });
          setAvailableMonths(Array.from(months).sort().reverse());
        }
      } catch {
        // silently fail -- timeline will show empty state
      } finally {
        setEntriesLoading(false);
      }
    },
    [monthFilter],
  );

  // Initial load and month filter change
  useEffect(() => {
    setPage(1);
    fetchEntries(1, false);
  }, [fetchEntries]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchEntries(next, true);
  }, [page, fetchEntries]);

  const handleMonthChange = useCallback((value: string) => {
    setMonthFilter(value);
  }, []);

  // Save diary entry
  const handleSave = useCallback(async () => {
    if (!content.trim()) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          content: content.trim(),
          mood,
          moodTags: selectedTags,
          entryDate: todayStr(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `保存失败 (${res.status})`);
      }
      // Reset form
      setTitle('');
      setContent('');
      setMood(5);
      setSelectedTags([]);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      // Refresh timeline
      fetchEntries(1, false);
      onEntryCreated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存日记时出错';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }, [content, title, mood, selectedTags, fetchEntries, onEntryCreated]);

  // For MoodTrend we need all entries (or at least 30 days worth).
  // We already have `entries` from the timeline query. For a richer trend
  // we could do a dedicated fetch, but the existing data is sufficient for
  // the visible timeline entries.

  const tabs = [
    { key: 'write' as const, label: '写日记', icon: PenLine },
    { key: 'timeline' as const, label: '时间轴', icon: BookOpen },
    { key: 'trends' as const, label: '情绪趋势', icon: BarChart3 },
    { key: 'insights' as const, label: 'AI 洞察', icon: Sparkles },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Tab navigation */}
      <nav className="flex items-center gap-1 mb-6 border-b border-border pb-px overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-blue text-blue'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Success toast */}
      {saveSuccess && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-600 text-sm">
          <Save className="w-4 h-4" />
          日记保存成功！
        </div>
      )}

      {/* Write tab */}
      {activeTab === 'write' && (
        <div className="space-y-6">
          <MoodCheckin
            mood={mood}
            setMood={setMood}
            selectedTags={selectedTags}
            toggleTag={toggleTag}
          />
          <DiaryEditor
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
            mood={mood}
            selectedTags={selectedTags}
            saving={saving}
            saveError={saveError}
            onSave={handleSave}
          />
        </div>
      )}

      {/* Timeline tab */}
      {activeTab === 'timeline' && (
        <TimelineView
          entries={entries}
          loading={entriesLoading}
          hasMore={hasMore}
          monthFilter={monthFilter}
          setMonthFilter={handleMonthChange}
          availableMonths={availableMonths}
          onLoadMore={handleLoadMore}
        />
      )}

      {/* Trends tab */}
      {activeTab === 'trends' && <MoodTrend entries={entries} />}

      {/* Insights tab */}
      {activeTab === 'insights' && <GrowthInsightsPanel />}
    </div>
  );
}
