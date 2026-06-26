'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Plus,
  Check,
  Circle,
  Play,
  Pause,
  RotateCcw,
  Calendar,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  ListTodo,
  Timer,
  CalendarDays,
  Sparkles,
  Trash2,
  Flag,
  Tag,
  Filter,
  BarChart3,
  Target,
  TrendingUp,
  Lightbulb,
  Star,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TodoItem {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: number | null;
  dueDate: string | null;
  parentId: string | null;
  tags: string[];
  category: string;
  sortOrder: number;
}

interface ScheduleEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  allDay: boolean;
  eventType: string;
  location: string | null;
}

interface PomodoroSession {
  id: string;
  durationMinutes: number;
  completed: boolean;
  startedAt: string;
}

interface WeeklyReview {
  overallScore: number;
  summary: string;
  highlights: string[];
  improvements: string[];
  categoryAnalysis: Array<{ category: string; score: number; insight: string }>;
  timeAllocation: Record<string, number>;
  nextWeekFocus: string;
  encouragement: string;
}

interface TimeManagerProps {
  onReviewGenerated?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'STUDY', label: '学习', color: 'bg-blue/10 text-blue' },
  { value: 'WORK', label: '工作', color: 'bg-purple/10 text-purple' },
  { value: 'PERSONAL', label: '个人', color: 'bg-green/10 text-green' },
  { value: 'HEALTH', label: '健康', color: 'bg-emerald/10 text-emerald' },
  { value: 'GENERAL', label: '通用', color: 'bg-gray-500/10 text-gray-500' },
] as const;

const PRIORITY_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'P1', color: 'text-red-500', bg: 'bg-red-500/10' },
  2: { label: 'P2', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  3: { label: 'P3', color: 'text-blue', bg: 'bg-blue/10' },
  4: { label: 'P4', color: 'text-gray-400', bg: 'bg-gray-400/10' },
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  GENERAL: 'bg-gray-400',
  STUDY: 'bg-blue-500',
  EXAM: 'bg-red-500',
  MEETING: 'bg-purple-500',
  PERSONAL: 'bg-green-500',
  DEADLINE: 'bg-orange-500',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  GENERAL: '通用',
  STUDY: '学习',
  EXAM: '考试',
  MEETING: '会议',
  PERSONAL: '个人',
  DEADLINE: '截止',
};

const POMODORO_DURATIONS = [15, 25, 45, 60];

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const FILTER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '未完成' },
  { key: 'completed', label: '已完成' },
  { key: 'category', label: '按类别' },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getCategoryMeta(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TimeManager({ onReviewGenerated }: TimeManagerProps) {
  // ── Todo State ──
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [todosError, setTodosError] = useState<string | null>(null);
  const [todoFilter, setTodoFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<number | null>(null);
  const [newTodoCategory, setNewTodoCategory] = useState('GENERAL');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);

  // ── Pomodoro State ──
  const [pomodoroDuration, setPomodoroDuration] = useState(25);
  const [pomodoroSecondsLeft, setPomodoroSecondsLeft] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroLinkedTodo, setPomodoroLinkedTodo] = useState<string | null>(null);
  const [pomodoroStats, setPomodoroStats] = useState({ completedCount: 0, totalMinutes: 0 });
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const pomodoroRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Schedule State ──
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [weekRange] = useState(getWeekRange);
  const [eventModalDay, setEventModalDay] = useState<number | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState('GENERAL');
  const [newEventTime, setNewEventTime] = useState('09:00');
  const [addingEvent, setAddingEvent] = useState(false);

  // ── Weekly Review State ──
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState<WeeklyReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // ── Fetch Todos ──
  const fetchTodos = useCallback(async () => {
    setTodosLoading(true);
    setTodosError(null);
    try {
      const res = await fetch('/api/time/todos');
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const data = await res.json();
      setTodos(Array.isArray(data) ? data : data.data ?? []);
    } catch (err: unknown) {
      setTodosError(err instanceof Error ? err.message : '加载待办失败');
    } finally {
      setTodosLoading(false);
    }
  }, []);

  // ── Fetch Events ──
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const params = new URLSearchParams({
        startTime: weekRange.start.toISOString(),
        endTime: weekRange.end.toISOString(),
      });
      const res = await fetch(`/api/time/events?${params}`);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : data.data ?? []);
    } catch (err: unknown) {
      setEventsError(err instanceof Error ? err.message : '加载日程失败');
    } finally {
      setEventsLoading(false);
    }
  }, [weekRange]);

  // ── Fetch Pomodoro Stats ──
  const fetchPomodoroStats = useCallback(async () => {
    try {
      const res = await fetch('/api/time/pomodoro');
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const json = await res.json();
      setPomodoroStats(json.stats ?? { completedCount: 0, totalMinutes: 0 });
      setPomodoroSessions(Array.isArray(json.data) ? json.data : []);
    } catch {
      // Silently fail for stats
    }
  }, []);

  useEffect(() => {
    fetchTodos();
    fetchEvents();
    fetchPomodoroStats();
  }, [fetchTodos, fetchEvents, fetchPomodoroStats]);

  // ── Pomodoro Timer Logic ──
  useEffect(() => {
    if (pomodoroRunning) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroSecondsLeft((prev) => {
          if (prev <= 1) {
            setPomodoroRunning(false);
            if (pomodoroRef.current) clearInterval(pomodoroRef.current);
            // Record completed session
            fetch('/api/time/pomodoro', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                durationMinutes: pomodoroDuration,
                completed: true,
                linkedTodoId: pomodoroLinkedTodo,
              }),
            })
              .then(() => fetchPomodoroStats())
              .catch(() => {});
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (pomodoroRef.current) clearInterval(pomodoroRef.current);
    }
    return () => {
      if (pomodoroRef.current) clearInterval(pomodoroRef.current);
    };
  }, [pomodoroRunning, pomodoroDuration, pomodoroLinkedTodo, fetchPomodoroStats]);

  // ── Todo Actions ──
  const addTodo = useCallback(async () => {
    if (!newTodoTitle.trim() || addingTodo) return;
    setAddingTodo(true);
    try {
      const res = await fetch('/api/time/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTodoTitle.trim(),
          priority: newTodoPriority,
          category: newTodoCategory,
          dueDate: newTodoDueDate || null,
        }),
      });
      if (!res.ok) throw new Error('添加失败');
      setNewTodoTitle('');
      setNewTodoPriority(null);
      setNewTodoCategory('GENERAL');
      setNewTodoDueDate('');
      await fetchTodos();
    } catch {
      // Keep form open on error
    } finally {
      setAddingTodo(false);
    }
  }, [newTodoTitle, newTodoPriority, newTodoCategory, newTodoDueDate, addingTodo, fetchTodos]);

  const toggleTodo = useCallback(
    async (id: string, completed: boolean) => {
      try {
        await fetch(`/api/time/todos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: !completed }),
        });
        setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t)));
      } catch {
        // Revert on error
      }
    },
    [],
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/time/todos/${id}`, { method: 'DELETE' });
        setTodos((prev) => prev.filter((t) => t.id !== id));
      } catch {
        // Silently fail
      }
    },
    [],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedTodos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Schedule Actions ──
  const addEvent = useCallback(async () => {
    if (!newEventTitle.trim() || eventModalDay === null || addingEvent) return;
    setAddingEvent(true);
    try {
      const dayDate = new Date(weekRange.start);
      dayDate.setDate(weekRange.start.getDate() + eventModalDay);
      const [hours, minutes] = newEventTime.split(':').map(Number);
      dayDate.setHours(hours, minutes, 0, 0);
      const endDate = new Date(dayDate);
      endDate.setHours(endDate.getHours() + 1);

      const res = await fetch('/api/time/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newEventTitle.trim(),
          startTime: dayDate.toISOString(),
          endTime: endDate.toISOString(),
          allDay: false,
          eventType: newEventType,
        }),
      });
      if (!res.ok) throw new Error('添加失败');
      setEventModalDay(null);
      setNewEventTitle('');
      setNewEventType('GENERAL');
      setNewEventTime('09:00');
      await fetchEvents();
    } catch {
      // Keep modal on error
    } finally {
      setAddingEvent(false);
    }
  }, [newEventTitle, newEventType, newEventTime, eventModalDay, weekRange, addingEvent, fetchEvents]);

  const deleteEvent = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/time/events/${id}`, { method: 'DELETE' });
        setEvents((prev) => prev.filter((e) => e.id !== id));
      } catch {
        // Silently fail
      }
    },
    [],
  );

  // ── Weekly Review ──
  const generateReview = useCallback(async () => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const res = await fetch('/api/time/weekly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: weekRange.start.toISOString(),
          weekEnd: weekRange.end.toISOString(),
        }),
      });
      if (!res.ok) throw new Error('生成周报失败');
      const json = await res.json();
      setReviewData(json.data);
      onReviewGenerated?.();
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : '生成周报失败');
    } finally {
      setReviewLoading(false);
    }
  }, [weekRange, onReviewGenerated]);

  // ── Derived Data ──
  const filteredTodos = todos.filter((t) => {
    if (todoFilter === 'active') return !t.completed;
    if (todoFilter === 'completed') return t.completed;
    if (todoFilter === 'category' && categoryFilter) return t.category === categoryFilter;
    return true;
  });

  const topLevelTodos = filteredTodos.filter((t) => !t.parentId);
  const childMap = new Map<string, TodoItem[]>();
  filteredTodos.forEach((t) => {
    if (t.parentId) {
      const list = childMap.get(t.parentId) ?? [];
      list.push(t);
      childMap.set(t.parentId, list);
    }
  });

  const todayCompleted = todos.filter((t) => t.completed && isToday(t.dueDate)).length;
  const todayTotal = todos.filter((t) => isToday(t.dueDate)).length;

  const pomodoroProgress = pomodoroDuration > 0 ? ((pomodoroDuration * 60 - pomodoroSecondsLeft) / (pomodoroDuration * 60)) * 100 : 0;
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (pomodoroProgress / 100) * circumference;

  // ── Event grouping by day ──
  const eventsByDay: ScheduleEvent[][] = Array.from({ length: 7 }, () => []);
  events.forEach((ev) => {
    const evDate = new Date(ev.startTime);
    const dayStart = new Date(weekRange.start);
    for (let i = 0; i < 7; i++) {
      const d = new Date(dayStart);
      d.setDate(dayStart.getDate() + i);
      if (
        evDate.getFullYear() === d.getFullYear() &&
        evDate.getMonth() === d.getMonth() &&
        evDate.getDate() === d.getDate()
      ) {
        eventsByDay[i].push(ev);
        break;
      }
    }
  });

  // ── Render Helpers ──

  const renderPriorityBadge = (priority: number | null) => {
    if (!priority || !PRIORITY_CONFIG[priority]) return null;
    const cfg = PRIORITY_CONFIG[priority];
    return (
      <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
        <Flag className="h-3 w-3" />
        {cfg.label}
      </span>
    );
  };

  const renderCategoryTag = (category: string) => {
    const meta = getCategoryMeta(category);
    return (
      <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${meta.color}`}>
        <Tag className="h-3 w-3" />
        {meta.label}
      </span>
    );
  };

  const renderTodoItem = (todo: TodoItem, depth: number = 0) => {
    const children = childMap.get(todo.id) ?? [];
    const isExpanded = expandedTodos.has(todo.id);

    return (
      <div key={todo.id}>
        <div
          className={`group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:border-blue/30 ${
            depth > 0 ? 'ml-6 border-l-2 border-l-blue/20' : ''
          }`}
        >
          <button
            onClick={() => toggleTodo(todo.id, todo.completed)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              todo.completed
                ? 'border-green-500 bg-green-500 text-white'
                : 'border-border hover:border-blue'
            }`}
          >
            {todo.completed && <Check className="h-3 w-3" />}
          </button>

          <span className={`flex-1 text-sm ${todo.completed ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
            {todo.title}
          </span>

          {renderPriorityBadge(todo.priority)}
          {renderCategoryTag(todo.category)}

          {todo.dueDate && (
            <span className="flex items-center gap-1 text-xs text-text-tertiary">
              <Calendar className="h-3 w-3" />
              {formatDate(todo.dueDate)}
            </span>
          )}

          {children.length > 0 && (
            <button
              onClick={() => toggleExpand(todo.id)}
              className="flex items-center rounded p-0.5 text-text-tertiary hover:text-text-primary"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="ml-0.5 text-xs">{children.length}</span>
            </button>
          )}

          <button
            onClick={() => deleteTodo(todo.id)}
            className="rounded p-1 text-text-tertiary opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {isExpanded && children.length > 0 && (
          <div className="mt-1 space-y-1">
            {children.map((child) => renderTodoItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // ── Section: Todo List ──
  const renderTodoSection = () => (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-blue" />
          <h2 className="text-lg font-semibold text-text-primary">待办清单</h2>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-sm">
          <Target className="h-4 w-4 text-green-500" />
          <span className="text-text-secondary">
            今日完成 <span className="font-semibold text-text-primary">{todayCompleted}</span>/{todayTotal}
          </span>
        </div>
      </div>

      {/* Add Todo Form */}
      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 shrink-0 text-text-tertiary" />
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            placeholder="添加新待办..."
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
          {addingTodo && <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Priority selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-text-tertiary">优先级:</span>
            {[1, 2, 3, 4].map((p) => {
              const cfg = PRIORITY_CONFIG[p];
              return (
                <button
                  key={p}
                  onClick={() => setNewTodoPriority(newTodoPriority === p ? null : p)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    newTodoPriority === p
                      ? `${cfg.bg} ${cfg.color} ring-1 ring-current`
                      : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Category selector */}
          <select
            value={newTodoCategory}
            onChange={(e) => setNewTodoCategory(e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 text-xs text-text-secondary outline-none focus:border-blue"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Due date */}
          <input
            type="date"
            value={newTodoDueDate}
            onChange={(e) => setNewTodoDueDate(e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 text-xs text-text-secondary outline-none focus:border-blue"
          />

          <button
            onClick={addTodo}
            disabled={!newTodoTitle.trim() || addingTodo}
            className="rounded-lg bg-blue px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            添加
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
        <Filter className="ml-2 h-3.5 w-3.5 text-text-tertiary" />
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTodoFilter(tab.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              todoFilter === tab.key
                ? 'bg-blue/10 text-blue'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {todoFilter === 'category' && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="ml-2 rounded border border-border bg-transparent px-2 py-1 text-xs text-text-secondary outline-none focus:border-blue"
          >
            <option value="">全部类别</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Todo List */}
      {todosError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          {todosError}
          <button onClick={fetchTodos} className="ml-auto text-xs underline hover:no-underline">
            重试
          </button>
        </div>
      )}

      {todosLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
        </div>
      ) : topLevelTodos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
          <Circle className="mb-2 h-8 w-8" />
          <p className="text-sm">暂无待办事项</p>
          <p className="text-xs">在上方输入框添加你的第一个待办</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {topLevelTodos.map((todo) => renderTodoItem(todo))}
        </div>
      )}
    </section>
  );

  // ── Section: Pomodoro Timer ──
  const renderPomodoroSection = () => (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Timer className="h-5 w-5 text-blue" />
        <h2 className="text-lg font-semibold text-text-primary">番茄钟</h2>
      </div>

      <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-surface p-6">
        {/* Circular Timer */}
        <div className="relative flex items-center justify-center">
          <svg width="200" height="200" viewBox="0 0 200 200" className="rotate-[-90deg]">
            <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="6" className="text-border" />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="text-blue transition-all duration-1000"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-4xl font-mono font-bold text-text-primary">
              {formatTime(pomodoroSecondsLeft)}
            </span>
            <span className="mt-1 text-xs text-text-tertiary">
              {pomodoroRunning ? '专注中...' : pomodoroSecondsLeft === 0 ? '已完成!' : '就绪'}
            </span>
          </div>
        </div>

        {/* Duration Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">时长:</span>
          {POMODORO_DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => {
                if (!pomodoroRunning) {
                  setPomodoroDuration(d);
                  setPomodoroSecondsLeft(d * 60);
                }
              }}
              disabled={pomodoroRunning}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                pomodoroDuration === d
                  ? 'bg-blue/10 text-blue ring-1 ring-blue/30'
                  : 'text-text-tertiary hover:text-text-secondary'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {d}分钟
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPomodoroRunning(!pomodoroRunning)}
            disabled={pomodoroSecondsLeft === 0}
            className="flex items-center gap-2 rounded-xl bg-blue px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pomodoroRunning ? (
              <>
                <Pause className="h-4 w-4" />
                暂停
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                {pomodoroSecondsLeft < pomodoroDuration * 60 ? '继续' : '开始'}
              </>
            )}
          </button>
          <button
            onClick={() => {
              setPomodoroRunning(false);
              setPomodoroSecondsLeft(pomodoroDuration * 60);
            }}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface"
          >
            <RotateCcw className="h-4 w-4" />
            重置
          </button>
        </div>

        {/* Link to Todo */}
        <div className="flex w-full items-center gap-2">
          <span className="text-xs text-text-tertiary">关联待办:</span>
          <select
            value={pomodoroLinkedTodo ?? ''}
            onChange={(e) => setPomodoroLinkedTodo(e.target.value || null)}
            className="flex-1 rounded border border-border bg-transparent px-2 py-1 text-xs text-text-secondary outline-none focus:border-blue"
          >
            <option value="">无关联</option>
            {todos
              .filter((t) => !t.completed)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        </div>

        {/* Today's Stats */}
        <div className="flex w-full items-center justify-around rounded-lg bg-surface p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue/10">
              <Clock className="h-4 w-4 text-blue" />
            </div>
            <div>
              <p className="text-lg font-bold text-text-primary">{pomodoroStats.completedCount}</p>
              <p className="text-xs text-text-tertiary">今日番茄</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
              <BarChart3 className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-text-primary">{pomodoroStats.totalMinutes}</p>
              <p className="text-xs text-text-tertiary">专注分钟</p>
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        {pomodoroSessions.length > 0 && (
          <div className="w-full space-y-1.5">
            <p className="text-xs font-medium text-text-tertiary">最近记录</p>
            {pomodoroSessions.slice(0, 5).map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded px-2 py-1 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      session.completed ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-text-secondary">{session.durationMinutes}分钟</span>
                </div>
                <span className="text-text-tertiary">
                  {new Date(session.startedAt).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );

  // ── Section: Weekly Schedule ──
  const renderScheduleSection = () => {
    const today = new Date();
    const todayIndex = (() => {
      const day = today.getDay();
      return day === 0 ? 6 : day - 1;
    })();

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue" />
            <h2 className="text-lg font-semibold text-text-primary">本周日程</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">
              {weekRange.start.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} -{' '}
              {weekRange.end.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            </span>
            <button
              onClick={generateReview}
              disabled={reviewLoading}
              className="flex items-center gap-1.5 rounded-lg bg-blue/10 px-3 py-1.5 text-xs font-medium text-blue transition-colors hover:bg-blue/20 disabled:opacity-50"
            >
              {reviewLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI 周报
            </button>
          </div>
        </div>

        {/* Event Type Legend */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-3 py-2">
          {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-sm ${EVENT_TYPE_COLORS[key]}`} />
              <span className="text-xs text-text-tertiary">{label}</span>
            </div>
          ))}
        </div>

        {eventsError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            {eventsError}
            <button onClick={fetchEvents} className="ml-auto text-xs underline hover:no-underline">
              重试
            </button>
          </div>
        )}

        {eventsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
          </div>
        ) : (
          /* Week Grid */
          <div className="grid grid-cols-7 gap-2">
            {DAY_LABELS.map((label, dayIndex) => {
              const dayDate = new Date(weekRange.start);
              dayDate.setDate(weekRange.start.getDate() + dayIndex);
              const isCurrentDay = dayIndex === todayIndex;

              return (
                <div key={label} className="space-y-1.5">
                  <div
                    className={`flex flex-col items-center rounded-lg py-2 ${
                      isCurrentDay ? 'bg-blue/10' : 'bg-surface'
                    }`}
                  >
                    <span className={`text-xs font-medium ${isCurrentDay ? 'text-blue' : 'text-text-tertiary'}`}>
                      {label}
                    </span>
                    <span
                      className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${
                        isCurrentDay ? 'bg-blue text-white' : 'text-text-primary'
                      }`}
                    >
                      {dayDate.getDate()}
                    </span>
                  </div>

                  <div
                    className="min-h-[120px] space-y-1 rounded-lg border border-border bg-surface p-1.5 cursor-pointer transition-colors hover:border-blue/30"
                    onClick={() => setEventModalDay(dayIndex)}
                  >
                    {eventsByDay[dayIndex].length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <Plus className="h-4 w-4 text-text-tertiary/40" />
                      </div>
                    ) : (
                      eventsByDay[dayIndex].map((ev) => (
                        <div
                          key={ev.id}
                          className="group relative rounded px-2 py-1 text-xs text-white"
                        >
                          <div
                            className={`absolute inset-0 rounded opacity-80 ${EVENT_TYPE_COLORS[ev.eventType] ?? EVENT_TYPE_COLORS.GENERAL}`}
                          />
                          <div className="relative flex items-center justify-between">
                            <span className="truncate font-medium">{ev.title}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteEvent(ev.id);
                              }}
                              className="ml-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          {!ev.allDay && (
                            <div className="relative text-[10px] opacity-80">
                              {new Date(ev.startTime).toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                          {ev.allDay && <div className="relative text-[10px] opacity-80">全天</div>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Event Modal */}
        {eventModalDay !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEventModalDay(null)}>
            <div
              className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">
                  添加日程 - {DAY_LABELS[eventModalDay]}
                </h3>
                <button onClick={() => setEventModalDay(null)} className="text-text-tertiary hover:text-text-primary">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <input
                type="text"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEvent()}
                placeholder="日程标题..."
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-blue"
                autoFocus
              />

              <div className="flex items-center gap-2">
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-text-secondary outline-none focus:border-blue"
                >
                  {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>

                <input
                  type="time"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                  className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-text-secondary outline-none focus:border-blue"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEventModalDay(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface"
                >
                  取消
                </button>
                <button
                  onClick={addEvent}
                  disabled={!newEventTitle.trim() || addingEvent}
                  className="flex items-center gap-1.5 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingEvent && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  添加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Review Card */}
        {reviewError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            {reviewError}
          </div>
        )}

        {reviewData && (
          <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue" />
              <h3 className="text-sm font-semibold text-text-primary">本周回顾</h3>
              <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue/10 px-2.5 py-1">
                <Star className="h-4 w-4 text-blue" />
                <span className="text-sm font-bold text-blue">{reviewData.overallScore}</span>
                <span className="text-xs text-text-tertiary">/ 100</span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-text-secondary">{reviewData.summary}</p>

            {reviewData.highlights.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium text-text-primary">本周亮点</span>
                </div>
                <ul className="space-y-1 pl-5">
                  {reviewData.highlights.map((h, i) => (
                    <li key={i} className="text-sm text-text-secondary">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {reviewData.improvements.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4 text-orange-500" />
                  <span className="text-xs font-medium text-text-primary">改进建议</span>
                </div>
                <ul className="space-y-1 pl-5">
                  {reviewData.improvements.map((item, i) => (
                    <li key={i} className="text-sm text-text-secondary">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {reviewData.categoryAnalysis.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                  <span className="text-xs font-medium text-text-primary">类别分析</span>
                </div>
                <div className="space-y-2">
                  {reviewData.categoryAnalysis.map((cat, i) => (
                    <div key={i} className="rounded-lg border border-border p-2.5">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-text-primary">
                          {getCategoryMeta(cat.category).label}
                        </span>
                        <span className="text-xs font-semibold text-blue">{cat.score}分</span>
                      </div>
                      <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-blue transition-all"
                          style={{ width: `${cat.score}%` }}
                        />
                      </div>
                      <p className="text-xs text-text-tertiary">{cat.insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reviewData.nextWeekFocus && (
              <div className="rounded-lg bg-blue/5 p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-blue" />
                  <span className="text-xs font-medium text-text-primary">下周重点</span>
                </div>
                <p className="text-sm text-text-secondary">{reviewData.nextWeekFocus}</p>
              </div>
            )}

            {reviewData.encouragement && (
              <p className="text-center text-sm italic text-text-tertiary">{reviewData.encouragement}</p>
            )}
          </div>
        )}
      </section>
    );
  };

  // ── Main Render ──
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
      {renderTodoSection()}
      <div className="h-px bg-border" />
      {renderPomodoroSection()}
      <div className="h-px bg-border" />
      {renderScheduleSection()}
    </div>
  );
}
