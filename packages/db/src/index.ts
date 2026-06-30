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
  const url = config?.url ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = config?.anonKey ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
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
  // Migration 012 扩展字段
  is985?: boolean;
  is211?: boolean;
  isDualFirstClass?: boolean;
  foundingYear?: number;
  schoolType?: string;
  educationLevel?: string;
  masterPrograms?: number;
  doctoralPrograms?: number;
  genderRatio?: string;
  admissionPhone?: string;
  nationalSpecialties?: string[];
  disciplineEvaluation?: Record<string, string>;
  description?: string;
  motto?: string;
  affiliated?: string;
  dataSource?: string;
  dataYear?: number;
  createdAt: string;
  updatedAt?: string;
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
  // Migration 012 扩展字段
  majorCode?: string;
  disciplineCategory?: string;
  genderRatio?: string;
  employmentRate?: number;
  employmentRates?: Record<string, number>;
  whatDescription?: string;
  studyDescription?: string;
  careerDescription?: string;
  coreCourses?: string[];
  graduatePaths?: string[];
  certifications?: string[];
  notableAlumni?: string[];
  offeringSchools?: Array<{ name: string; tier?: string }>;
  dataSource?: string;
  dataYear?: number;
  createdAt: string;
  updatedAt?: string;
}

/** 院校排名表 */
export interface UniversityRankingRow {
  id: string;
  universityId?: string;
  universityName: string;
  source: string;
  year: number;
  rank?: number;
  score?: number;
  tags?: string[];
  region?: string;
  type?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** 学科评估表 */
export interface DisciplineEvaluationRow {
  id: string;
  universityId?: string;
  universityName: string;
  disciplineName: string;
  evaluationRound: string;
  rating: string;
  rankingPosition?: number;
  createdAt: string;
}

/** 专业薪酬时间序列表 */
export interface MajorSalaryDataRow {
  id: string;
  majorId?: string;
  majorName: string;
  year: number;
  avgMonthlySalary?: number;
  medianMonthlySalary?: number;
  sampleSize?: number;
  topIndustries?: Array<{ name: string; ratio?: number }>;
  topCities?: Array<{ name: string; ratio?: number }>;
  topOccupations?: Array<{ name: string; ratio?: number }>;
  dataSource?: string;
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
  /** 薪资范围 */
  salaryRange?: string;
  /** 所需技能列表 */
  requiredSkills?: string[];
  /** 短期目标 */
  shortTermGoals?: Array<{ title: string; description?: string }>;
  /** 中期目标 */
  midTermGoals?: Array<{ title: string; description?: string }>;
  /** 长期目标 */
  longTermGoals?: Array<{ title: string; description?: string }>;
  /** 行业趋势 */
  industryTrends?: string;
  /** 匹配分数 */
  matchScore?: number;
  /** 来源专业 */
  sourceMajor?: string;
  /** 来源 MBTI 类型 */
  sourceMbti?: string;
  /** 来源 Holland 类型 */
  sourceHolland?: string;
  createdAt: string;
  updatedAt: string;
}

/** 目标表（短期/长期目标） */
export interface GoalRow {
  id: string;
  userId: string;
  /** 父目标 ID（支持最多 3 层层级） */
  parentGoalId?: string;
  title: string;
  description?: string;
  /** 目标类别 */
  category: 'ACADEMIC' | 'CAREER' | 'LIFESTYLE' | 'OTHER';
  /** 优先级 1-5 */
  priority?: number;
  completed: boolean;
  deadline?: string;
  /** 层级深度（1-3） */
  depth: number;
  /** 排序权重 */
  sortOrder: number;
  /** 关联职业路径 ID */
  careerPathId?: string;
  createdAt: string;
  updatedAt: string;
}

/** 课程表 — 大学课程管理与成绩追踪 */
export interface CourseRow {
  id: string;
  userId: string;
  /** 课程名称 */
  name: string;
  /** 学分 */
  credit: number;
  /** 百分制成绩 0-100 */
  grade?: number;
  /** 绩点 0-5.0（自动从百分制换算） */
  gradePoint?: number;
  /** 学期（如 "2025-2026-1"） */
  semester?: string;
  /** 课程类别 */
  category: '必修' | '选修' | '公选' | '体育' | '通识';
  /** 授课教师 */
  teacher?: string;
  /** 备注 */
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** 学期表 */
export interface SemesterRow {
  id: string;
  userId: string;
  /** 学期名称（如 "2025-2026 第一学期"） */
  name: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 学业统计（calculate_gpa 函数返回） */
export interface AcademicSummaryRow {
  gpa: number;
  weightedAvg: number;
  totalCredits: number;
  earnedCredits: number;
  courseCount: number;
}

/** 技能树表（知识图谱节点组） */
export interface SkillTreeRow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  /** 分类: TECH, SOFT, LANGUAGE, CERTIFICATE, CUSTOM */
  category: string;
  sourceMajor?: string;
  sourceCareer?: string;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 技能节点表（技能树中的单个知识点） */
export interface SkillNodeRow {
  id: string;
  skillTreeId: string;
  parentNodeId?: string;
  title: string;
  description?: string;
  /** 难度 1-5 */
  difficulty: number;
  /** 用户进度 0-100 */
  progress: number;
  prerequisites?: string[];
  resources?: any[];
  estimatedHours?: number;
  completed: boolean;
  completedAt?: string;
  sortOrder: number;
  depth: number;
  createdAt: string;
  updatedAt: string;
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
  /** 事件类型 */
  eventType: 'GENERAL' | 'STUDY' | 'EXAM' | 'MEETING' | 'PERSONAL' | 'DEADLINE';
  /** 重复规则 JSON: { frequency, until, count } */
  recurrence?: Record<string, unknown>;
  /** 地点 */
  location?: string;
  createdAt: string;
  updatedAt: string;
}

/** 番茄钟会话表 */
export interface PomodoroSessionRow {
  id: string;
  userId: string;
  /** 关联待办 ID */
  todoId?: string;
  /** 时长（分钟）1-120 */
  durationMinutes: number;
  completed: boolean;
  startedAt: string;
  completedAt?: string;
  notes?: string;
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
  /** 父任务 ID（子任务支持） */
  parentId?: string;
  /** 标签 */
  tags?: string[];
  /** 分类 */
  category: 'STUDY' | 'WORK' | 'PERSONAL' | 'HEALTH' | 'GENERAL';
  /** 排序权重 */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** 备忘表（碎片信息收集） */
export interface MemoRow {
  id: string;
  userId: string;
  /** 标题（可选） */
  title?: string;
  content: string;
  tags?: string[];
  isPinned: boolean;
  remindAt?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 日记表 */
export interface DiaryEntryRow {
  id: string;
  userId: string;
  title?: string;
  content: string;
  /** 心情评分 1-10 */
  mood?: number;
  /** 情绪标签 */
  moodTags?: string[];
  entryDate: string;
  createdAt: string;
  updatedAt: string;
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

/** 对话会话表 */
export interface ChatSessionRow {
  id: string;
  userId: string;
  title: string;
  taskType: string;
  messageCount: number;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
}

/** 对话消息表 */
export interface ChatMessageRow {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Array<{ title: string; snippet: string; score: number }>;
  taskType: string;
  tokenCount?: number;
  createdAt: string;
}

/** 通知表 */
export interface NotificationRow {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'reminder' | 'system';
  title: string;
  content?: string;
  href?: string;
  isRead: boolean;
  createdAt: string;
}

/** 省控线表 */
export interface ProvinceScoreLineRow {
  id: string;
  province: string;
  year: number;
  batch: string;
  subjectType: string;
  scoreLine: number;
  totalCandidates?: number;
  createdAt: string;
}

/** 就业薪资数据表 */
export interface EmploymentSalaryRow {
  id: string;
  majorId?: string;
  majorName?: string;
  city?: string;
  province?: string;
  avgSalary?: number;
  medianSalary?: number;
  p25Salary?: number;
  p75Salary?: number;
  dataYear: number;
  sampleSize?: number;
  source: string;
  createdAt: string;
}

/** 一分一段表 */
export interface ScoreRankRow {
  id: string;
  province: string;
  year: number;
  subjectType: string;
  score: number;
  countAtScore: number;
  cumulativeRank: number;
  createdAt: string;
}

/** 院校专业组映射 */
export interface MajorGroupRow {
  id: string;
  universityId: string;
  groupName: string;
  province: string;
  year: number;
  subjectRequirements?: string;
  majorIds: string[];
  note?: string;
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
      semesters: { Row: SemesterRow };
      skill_trees: { Row: SkillTreeRow };
      skill_nodes: { Row: SkillNodeRow };
      notes: { Row: NoteRow };
      folders: { Row: FolderRow };
      resumes: { Row: ResumeRow };
      internships: { Row: InternshipRow };
      research_projects: { Row: ResearchProjectRow };
      papers: { Row: PaperRow };
      schedule_events: { Row: ScheduleEventRow };
      pomodoro_sessions: { Row: PomodoroSessionRow };
      todos: { Row: TodoRow };
      memos: { Row: MemoRow };
      diary_entries: { Row: DiaryEntryRow };
      transactions: { Row: TransactionRow };
      knowledge_documents: { Row: KnowledgeDocumentRow };
      knowledge_chunks: { Row: KnowledgeChunkRow };
      chat_sessions: { Row: ChatSessionRow };
      chat_messages: { Row: ChatMessageRow };
      notifications: { Row: NotificationRow };
      province_score_lines: { Row: ProvinceScoreLineRow };
      employment_salaries: { Row: EmploymentSalaryRow };
      score_rank_tables: { Row: ScoreRankRow };
      major_groups: { Row: MajorGroupRow };
      university_rankings: { Row: UniversityRankingRow };
      discipline_evaluations: { Row: DisciplineEvaluationRow };
      major_salary_data: { Row: MajorSalaryDataRow };
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 数据查询层（Repository）重新导出
// ─────────────────────────────────────────────────────────────────────────────

export * from './repository';
