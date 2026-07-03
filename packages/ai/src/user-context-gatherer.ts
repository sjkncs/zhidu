'use server';

// @zhidu/ai — 用户上下文采集器
// 从平台多个业务模块（备忘、科研、日记、待办、课程、财务）中
// 按用户提问关键词动态拉取相关数据，格式化为 AI 系统提示的上下文段落。

import type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

/** 上下文模块 — 描述一个可被关键词触发的数据源 */
interface ContextModule {
  /** 模块唯一标识 */
  name: string;
  /** 用于生成 Markdown 标题的中文标签 */
  label: string;
  /** 触发关键词列表 — 用户查询中包含任意一个即命中 */
  keywords: string[];
  /** 数据拉取函数，返回格式化后的 Markdown 字符串 */
  fetch: (userId: string, supabase: SupabaseClient) => Promise<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 模块注册表
// ─────────────────────────────────────────────────────────────────────────────

const modules: ContextModule[] = [
  // ── 备忘录 ──
  {
    name: 'memos',
    label: '备忘录',
    keywords: ['备忘', '笔记', '记录', 'memo', '提醒我'],
    fetch: async (userId, supabase) => {
      const { data, error } = await supabase
        .from('memos')
        .select('title, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !data?.length) return '';

      const lines = data.map(
        (m: { title?: string; content?: string }) =>
          `- ${m.title ?? '无标题'}: ${m.content ?? ''}`
      );
      return `## 备忘录\n${lines.join('\n')}`;
    },
  },

  // ── 科研项目 ──
  {
    name: 'research',
    label: '科研项目',
    keywords: ['科研', '项目', '论文', '研究', '课题', 'paper'],
    fetch: async (userId, supabase) => {
      const { data, error } = await supabase
        .from('research_projects')
        .select('title, description, status, start_date')
        .eq('user_id', userId)
        .limit(5);

      if (error || !data?.length) return '';

      const lines = data.map(
        (r: { title?: string; description?: string; status?: string }) =>
          `- ${r.title ?? '未命名项目'} [${r.status ?? '进行中'}]: ${r.description ?? ''}`
      );
      return `## 科研项目\n${lines.join('\n')}`;
    },
  },

  // ── 日记 / 情绪 ──
  {
    name: 'diary',
    label: '日记',
    keywords: ['心情', '情绪', '日记', '今天', '感受', '日记本', '日志'],
    fetch: async (userId, supabase) => {
      const { data, error } = await supabase
        .from('diary_entries')
        .select('title, content, mood, entry_date')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false })
        .limit(7);

      if (error || !data?.length) return '';

      const lines = data.map(
        (d: { title?: string; content?: string; mood?: string; entry_date?: string }) =>
          `- ${d.entry_date ?? ''} ${d.title ?? ''} (${d.mood ?? '未知'}): ${d.content?.slice(0, 100) ?? ''}`
      );
      return `## 近期日记\n${lines.join('\n')}`;
    },
  },

  // ── 待办事项 ──
  {
    name: 'todos',
    label: '待办事项',
    keywords: ['待办', 'todo', '任务', '要做', '还没做', '清单', '完成'],
    fetch: async (userId, supabase) => {
      const { data, error } = await supabase
        .from('todos')
        .select('title, priority, due_date')
        .eq('user_id', userId)
        .eq('completed', false)
        .limit(10);

      if (error || !data?.length) return '';

      const lines = data.map(
        (t: { title?: string; priority?: string; due_date?: string }) => {
          const deadline = t.due_date ? ` (截止: ${t.due_date})` : '';
          return `- [${t.priority ?? '普通'}] ${t.title ?? ''}${deadline}`;
        }
      );
      return `## 待办事项\n${lines.join('\n')}`;
    },
  },

  // ── 课程 / 学业 ──
  {
    name: 'courses',
    label: '课程',
    keywords: ['课程', '上课', '考试', '成绩', '绩点', 'GPA', '学期', '作业', '选课'],
    fetch: async (userId, supabase) => {
      const { data, error } = await supabase
        .from('courses')
        .select('name, category, credit, grade, semester_id')
        .eq('user_id', userId)
        .limit(20);

      if (error || !data?.length) return '';

      const lines = data.map(
        (c: { name?: string; category?: string; credit?: number; grade?: string }) =>
          `- ${c.name ?? ''} (${c.category ?? ''}, ${c.credit ?? 0}学分, 成绩: ${c.grade ?? '未出'})`
      );
      return `## 课程列表\n${lines.join('\n')}`;
    },
  },

  // ── 财务 / 收支 ──
  {
    name: 'finance',
    label: '收支记录',
    keywords: ['花钱', '收入', '支出', '财务', '账单', '预算', '消费', '记账', '生活费'],
    fetch: async (userId, supabase) => {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, category, amount, description, date')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30);

      if (error || !data?.length) return '';

      const lines = data.map(
        (t: { type?: string; category?: string; amount?: number; description?: string; date?: string }) =>
          `- ${t.date ?? ''} ${t.type === 'income' ? '+' : '-'}${t.amount ?? 0}元 [${t.category ?? '其他'}] ${t.description ?? ''}`
      );
      return `## 收支记录\n${lines.join('\n')}`;
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 核心函数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 根据用户查询关键词，从匹配的业务模块中并行拉取数据，
 * 返回可拼接到 AI system prompt 的 Markdown 上下文字符串。
 *
 * @param userId  - 当前用户 ID
 * @param query   - 用户原始查询文本
 * @param supabase - Supabase 客户端实例
 * @returns 格式化的上下文字符串；无匹配或全部失败时返回空字符串
 */
export async function gatherUserContext(
  userId: string,
  query: string,
  supabase: SupabaseClient,
): Promise<string> {
  // 1. 关键词匹配 — 找出所有与查询相关的模块
  const queryLower = query.toLowerCase();
  const matched = modules.filter((mod) =>
    mod.keywords.some((kw) => queryLower.includes(kw.toLowerCase())),
  );

  if (matched.length === 0) return '';

  // 2. 并行拉取所有匹配模块的数据（允许部分失败）
  const results = await Promise.allSettled(
    matched.map((mod) => mod.fetch(userId, supabase)),
  );

  // 3. 收集成功的结果，跳过失败或空的模块
  const sections: string[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      sections.push(result.value);
    }
  }

  if (sections.length === 0) return '';

  // 4. 拼接为完整的上下文段落
  return `\n--- 用户相关数据 ---\n${sections.join('\n\n')}\n`;
}
