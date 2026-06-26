// @zhidu/db — Supabase 客户端工厂 & 数据库表类型定义

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

export type { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Supabase 客户端工厂
// ─────────────────────────────────────────────────────────────────────────────

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * 创建 Supabase 客户端实例
 * @param config - 连接配置，默认从环境变量读取
 */
export function createClient(config?: SupabaseConfig): SupabaseClient<Database> {
  const url = config?.url ?? process.env.SUPABASE_URL ?? '';
  const anonKey = config?.anonKey ?? process.env.SUPABASE_ANON_KEY ?? '';
  return createSupabaseClient<Database>(url, anonKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// 数据库表行类型（对应 SQL schema）
// ─────────────────────────────────────────────────────────────────────────────

/** 用户表 — 认证相关基础信息 */
export interface UserRow {
  id: string;
  email: string;
  phone?: string;
  /** 微信 openid（用于小程序登录） */
  wechatOpenid?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** 用户画像表 — 扩展档案信息 */
export interface ProfileRow {
  id: string;
  userId: string;
  province: string;
  grade: string;
  totalScore?: number;
  subjectScores?: Record<string, number>;
  subjectCombination?: { primary: string; secondary: string[] };
  track?: '文' | '理';
  rank?: number;
  interests?: string[];
  targetCities?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** 用户设置表 */
export interface SettingRow {
  id: string;
  userId: string;
  /** 启用的模块列表 */
  enabledModules: string[];
  /** 主题偏好 */
  theme?: 'light' | 'dark' | 'system';
  /** 通知偏好 */
  notificationPrefs?: Record<string, boolean>;
  updatedAt: string;
}

/** 院校信息表 */
export interface UniversityRow {
  id: string;
  name: string;
  province: string;
  city: string;
  tier: '985' | '211' | '双一流' | '普通本科' | '专科';
  isPublic: boolean;
  website?: string;
  logo?: string;
  /** 标签（如：综合类、理工类） */
  tags?: string[];
  createdAt: string;
}

/** 专业信息表 */
export interface MajorRow {
  id: string;
  name: string;
  category: string;
  duration: number;
  degree: string;
  subjectRequirements?: string[];
  description?: string;
  createdAt: string;
}

/** 录取分数线表（历年数据） */
export interface AdmissionScoreRow {
  id: string;
  universityId: string;
  majorId?: string;
  province: string;
  year: number;
  /** 最低录取分 */
  minScore: number;
  /** 平均录取分 */
  avgScore?: number;
  /** 最低录取位次 */
  minRank?: number;
  /** 批次（本科一批、本科二批等） */
  batch?: string;
}

/** 测评结果表 */
export interface AssessmentRow {
  id: string;
  userId: string;
  type: 'MBTI' | 'HOLLAND' | 'VALUES' | 'ABILITY' | 'CUSTOM';
  rawScores?: Record<string, number>;
  result: unknown;
  takenAt: string;
  confidence?: number;
}

/** 志愿方案表 */
export interface ApplicationPlanRow {
  id: string;
  userId: string;
  name: string;
  year: number;
  province: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'FINALIZED' | 'SUBMITTED';
  aiSummary?: string;
  createdAt: string;
  updatedAt: string;
}

/** 方案条目表（一条志愿 = 一个院校+专业组合） */
export interface PlanItemRow {
  id: string;
  planId: string;
  universityId: string;
  majorId: string;
  riskLevel: 'RUSH' | 'STABLE' | 'SAFE';
  historicalAvgScore?: number;
  estimatedProbability?: number;
  /** 志愿排序 */
  order: number;
  remark?: string;
}

/** 职业路径表 */
export interface CareerPathRow {
  id: string;
  userId: string;
  /** 职业目标名称（如：软件工程师） */
  targetRole: string;
  /** 目标行业 */
  targetIndustry?: string;
  /** 当前阶段 */
  stage: 'EXPLORING' | 'PLANNING' | 'PREPARING' | 'ACTIVE';
  /** 路径节点（JSON 序列化的步骤列表） */
  milestones?: Array<{ title: string; completed: boolean; deadline?: string }>;
  createdAt: string;
  updatedAt: string;
}

/** 目标表（短期/长期目标） */
export interface GoalRow {
  id: string;
  userId: string;
  title: string;
  description?: string;
  /** 目标类别 */
  category: 'ACADEMIC' | 'CAREER' | 'LIFESTYLE' | 'OTHER';
  /** 优先级 1-5 */
  priority?: number;
  completed: boolean;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

/** 课程表 */
export interface CourseRow {
  id: string;
  title: string;
  /** 所属模块 */
  module: string;
  /** 难度 1-5 */
  difficulty: number;
  /** 内容（Markdown） */
  content?: string;
  tags?: string[];
  createdAt: string;
}

/** 技能树表（知识图谱节点组） */
export interface SkillTreeRow {
  id: string;
  name: string;
  description?: string;
  /** 所属模块 */
  module: string;
  createdAt: string;
}

/** 技能节点表（技能树中的单个知识点） */
export interface SkillNodeRow {
  id: string;
  skillTreeId: string;
  title: string;
  description?: string;
  /** 前置节点（依赖） */
  prerequisites?: string[];
  /** 难度 1-5 */
  difficulty: number;
  /** 用户进度 0-1 */
  progress?: number;
}

/** 笔记表 */
export interface NoteRow {
  id: string;
  userId: string;
  folderId?: string;
  title: string;
  content: string;
  /** 标签 */
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

/** 笔记文件夹表 */
export interface FolderRow {
  id: string;
  userId: string;
  parentId?: string;
  name: string;
  createdAt: string;
}

/** 简历表 */
export interface ResumeRow {
  id: string;
  userId: string;
  title: string;
  /** JSON 结构化简历数据 */
  data: Record<string, unknown>;
  /** 目标岗位 */
  targetRole?: string;
  createdAt: string;
  updatedAt: string;
}

/** 实习经历表 */
export interface InternshipRow {
  id: string;
  userId: string;
  company: string;
  role: string;
  description?: string;
  startDate: string;
  endDate?: string;
  /** 是否在职 */
  current: boolean;
}

/** 科研项目表 */
export interface ResearchProjectRow {
  id: string;
  userId: string;
  title: string;
  role: string;
  description?: string;
  /** 指导老师 */
  advisor?: string;
  startDate: string;
  endDate?: string;
  status: 'ONGOING' | 'COMPLETED';
}

/** 论文表 */
export interface PaperRow {
  id: string;
  userId: string;
  title: string;
  authors?: string[];
  journal?: string;
  publishDate?: string;
  doi?: string;
  abstract?: string;
}

/** 日程事件表 */
export interface ScheduleEventRow {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  /** 全天事件 */
  allDay: boolean;
  /** 重复规则（RRULE 字符串） */
  recurrence?: string;
  /** 提醒（提前分钟数） */
  reminderMinutes?: number;
}

/** 待办事项表 */
export interface TodoRow {
  id: string;
  userId: string;
  title: string;
  description?: string;
  completed: boolean;
  /** 优先级 1-4 */
  priority?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** 备忘表（碎片信息收集） */
export interface MemoRow {
  id: string;
  userId: string;
  content: string;
  tags?: string[];
  createdAt: string;
}

/** 日记表 */
export interface DiaryEntryRow {
  id: string;
  userId: string;
  title?: string;
  content: string;
  /** 心情评分 1-10 */
  mood?: number;
  date: string;
  createdAt: string;
}

/** 交易/消费记录表 */
export interface TransactionRow {
  id: string;
  userId: string;
  amount: number;
  /** 消费类别 */
  category: string;
  description?: string;
  /** 支出 or 收入 */
  type: 'EXPENSE' | 'INCOME';
  date: string;
  createdAt: string;
}

/** 知识文档表 */
export interface KnowledgeDocumentRow {
  id: string;
  title: string;
  collection: 'policy' | 'major_intro' | 'career' | 'volunteer' | 'general';
  sourceUrl?: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** 知识分块表 */
export interface KnowledgeChunkRow {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  metadata?: Record<string, unknown>;
  /** 向量嵌入（Phase 3b，pgvector） */
  embedding?: number[];
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database 类型（供 Supabase 客户端泛型使用）
// ─────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      users: { Row: UserRow };
      profiles: { Row: ProfileRow };
      settings: { Row: SettingRow };
      universities: { Row: UniversityRow };
      majors: { Row: MajorRow };
      admission_scores: { Row: AdmissionScoreRow };
      assessments: { Row: AssessmentRow };
      application_plans: { Row: ApplicationPlanRow };
      plan_items: { Row: PlanItemRow };
      career_paths: { Row: CareerPathRow };
      goals: { Row: GoalRow };
      courses: { Row: CourseRow };
      skill_trees: { Row: SkillTreeRow };
      skill_nodes: { Row: SkillNodeRow };
      notes: { Row: NoteRow };
      folders: { Row: FolderRow };
      resumes: { Row: ResumeRow };
      internships: { Row: InternshipRow };
      research_projects: { Row: ResearchProjectRow };
      papers: { Row: PaperRow };
      schedule_events: { Row: ScheduleEventRow };
      todos: { Row: TodoRow };
      memos: { Row: MemoRow };
      diary_entries: { Row: DiaryEntryRow };
      transactions: { Row: TransactionRow };
      knowledge_documents: { Row: KnowledgeDocumentRow };
      knowledge_chunks: { Row: KnowledgeChunkRow };
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 数据查询层（Repository）重新导出
// ─────────────────────────────────────────────────────────────────────────────

export * from './repository';
