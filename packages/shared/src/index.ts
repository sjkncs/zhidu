// @zhidu/shared — 全平台共享类型与常量

// ─────────────────────────────────────────────────────────────────────────────
// 用户画像相关类型（省份、科目、年级等）
// ─────────────────────────────────────────────────────────────────────────────

/** 省份枚举（部分常用，可按需扩展） */
export type Province =
  | '北京' | '天津' | '上海' | '重庆'
  | '河北' | '山西' | '辽宁' | '吉林' | '黑龙江'
  | '江苏' | '浙江' | '安徽' | '福建' | '江西' | '山东'
  | '河南' | '湖北' | '湖南' | '广东' | '海南'
  | '四川' | '贵州' | '云南' | '陕西' | '甘肃' | '青海'
  | '内蒙古' | '广西' | '西藏' | '宁夏' | '新疆'
  | '香港' | '澳门';

/** 高考科目（新高考模式） */
export type Subject = '语文' | '数学' | '英语'
  | '物理' | '化学' | '生物'
  | '历史' | '政治' | '地理';

/** 年级 */
export type Grade = '高一' | '高二' | '高三' | '大一' | '大二' | '大三' | '大四' | '研究生' | '已毕业';

/** 高考选科组合（3+1+2 模式下的典型组合） */
export interface SubjectCombination {
  /** 首选科目：物理 or 历史 */
  primary: '物理' | '历史';
  /** 再选科目（两门） */
  secondary: [Subject, Subject];
}

/** 用户画像 */
export interface UserProfile {
  id: string;
  userId: string;
  province: Province;
  grade: Grade;
  /** 高考总分（实际 or 模考） */
  totalScore?: number;
  /** 各科成绩 */
  subjectScores?: Partial<Record<Subject, number>>;
  /** 选科组合 */
  subjectCombination?: SubjectCombination;
  /** 文理科（旧高考省份） */
  track?: '文' | '理';
  /** 排名（省排名 or 校排名） */
  rank?: number;
  /** 兴趣标签 */
  interests?: string[];
  /** 目标城市 */
  targetCities?: string[];
  /** 备注 */
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 测评类型（MBTI、霍兰德等）
// ─────────────────────────────────────────────────────────────────────────────

/** MBTI 16 型人格 */
export type MBTIType =
  | 'ISTJ' | 'ISFJ' | 'INFJ' | 'INTJ'
  | 'ISTP' | 'ISFP' | 'INFP' | 'INTP'
  | 'ESTP' | 'ESFP' | 'ENFP' | 'ENTP'
  | 'ESTJ' | 'ESFJ' | 'ENFJ' | 'ENTJ';

/** 霍兰德职业兴趣六维度 */
export interface HollandResult {
  /** 现实型 (Realistic) */
  R: number;
  /** 研究型 (Investigative) */
  I: number;
  /** 艺术型 (Artistic) */
  A: number;
  /** 社会型 (Social) */
  S: number;
  /** 企业型 (Enterprising) */
  E: number;
  /** 常规型 (Conventional) */
  C: number;
  /** 三字母代码，如 "RIA" */
  code: string;
}

/** 测评记录 */
export interface AssessmentRecord {
  id: string;
  userId: string;
  /** 测评类型 */
  type: 'MBTI' | 'HOLLAND' | 'VALUES' | 'ABILITY' | 'CUSTOM';
  /** 原始得分 */
  rawScores?: Record<string, number>;
  /** 结果（MBTI 类型 or 霍兰德结果） */
  result: MBTIType | HollandResult | Record<string, unknown>;
  /** 测评时间 */
  takenAt: string;
  /** 可信度/完成度 0-1 */
  confidence?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 志愿方案类型（院校、专业、方案条目及风险等级）
// ─────────────────────────────────────────────────────────────────────────────

/** 院校层次 */
export type UniversityTier = '985' | '211' | '双一流' | '普通本科' | '专科';

/** 院校信息 */
export interface University {
  id: string;
  name: string;
  province: Province;
  city: string;
  tier: UniversityTier;
  /** 是否公办 */
  isPublic: boolean;
  /** 官网 */
  website?: string;
  logo?: string;
}

/** 专业大类 */
export type MajorCategory =
  | '哲学' | '经济学' | '法学' | '教育学' | '文学' | '历史学'
  | '理学' | '工学' | '农学' | '医学' | '管理学' | '艺术学';

/** 专业 */
export interface Major {
  id: string;
  name: string;
  category: MajorCategory;
  /** 学制（年） */
  duration: number;
  /** 学位类型 */
  degree: '学士' | '硕士' | '博士';
  /** 适合科目要求（高校选科要求） */
  subjectRequirements?: Subject[];
}

/** 风险等级（冲稳保） */
export type RiskLevel = 'RUSH' | 'STABLE' | 'SAFE';  // 冲 | 稳 | 保

/** 方案条目（一条志愿） */
export interface PlanItem {
  id: string;
  planId: string;
  universityId: string;
  majorId: string;
  /** 风险等级 */
  riskLevel: RiskLevel;
  /** 历年录取分（近3年均值） */
  historicalAvgScore?: number;
  /** 录取概率估算 0-1 */
  estimatedProbability?: number;
  /** 排序（志愿顺序） */
  order: number;
  /** 备注 */
  remark?: string;
}

/** 志愿方案 */
export interface ApplicationPlan {
  id: string;
  userId: string;
  name: string;
  /** 方案年份（对应高考年份） */
  year: number;
  province: Province;
  items: PlanItem[];
  /** 方案状态 */
  status: 'DRAFT' | 'IN_PROGRESS' | 'FINALIZED' | 'SUBMITTED';
  /** AI 推荐理由 */
  aiSummary?: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 模块状态枚举（追踪用户开启了哪些功能模块）
// ─────────────────────────────────────────────────────────────────────────────

/** 平台功能模块 */
export enum ModuleKey {
  /** 志愿填报 */
  VOLUNTEER = 'VOLUNTEER',
  /** 生涯规划 */
  CAREER = 'CAREER',
  /** 学业提升 */
  ACADEMIC = 'ACADEMIC',
  /** 就业准备 */
  EMPLOYMENT = 'EMPLOYMENT',
  /** 生活管理 */
  LIFESTYLE = 'LIFESTYLE',
  /** AI 助手 */
  AI_ASSISTANT = 'AI_ASSISTANT',
}

/** 模块开启状态 */
export interface ModuleStatus {
  module: ModuleKey;
  enabled: boolean;
  /** 首次开启时间 */
  enabledAt?: string;
  /** 完成度 0-1 */
  progress?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API 响应包装类型
// ─────────────────────────────────────────────────────────────────────────────

/** 标准 API 成功响应 */
export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
  /** 可选提示信息 */
  message?: string;
}

/** 标准 API 错误响应 */
export interface ApiErrorResponse {
  ok: false;
  /** 错误码（机器可读） */
  code: string;
  /** 用户可读的错误描述 */
  message: string;
  /** 字段级错误（表单校验） */
  fieldErrors?: Record<string, string[]>;
}

/** 统一 API 响应 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** 分页响应 */
export interface PaginatedResponse<T> extends ApiSuccessResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 常用工具类型
// ─────────────────────────────────────────────────────────────────────────────

/** 使所有字段可选 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** 去掉 readonly */
export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

/** 从联合类型中排除 */
export type ExcludeFrom<T, U> = T extends U ? never : T;

/** ID 字符串（brand type 防止混用） */
export type BrandedId<T extends string> = string & { readonly __brand: T };

export type UserId = BrandedId<'UserId'>;
export type PlanId = BrandedId<'PlanId'>;
export type UniversityId = BrandedId<'UniversityId'>;
export type MajorId = BrandedId<'MajorId'>;

/** 时间范围 */
export interface DateRange {
  from: string;
  to: string;
}

/** 通用排序 */
export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

/** 通用筛选 */
export interface FilterOption {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────────────────────────────────────

export const PROVINCES: Province[] = [
  '北京', '天津', '上海', '重庆',
  '河北', '山西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广东', '海南',
  '四川', '贵州', '云南', '陕西', '甘肃', '青海',
  '内蒙古', '广西', '西藏', '宁夏', '新疆',
  '香港', '澳门',
];

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  RUSH: '冲',
  STABLE: '稳',
  SAFE: '保',
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  [ModuleKey.VOLUNTEER]: '志愿填报',
  [ModuleKey.CAREER]: '生涯规划',
  [ModuleKey.ACADEMIC]: '学业提升',
  [ModuleKey.EMPLOYMENT]: '就业准备',
  [ModuleKey.LIFESTYLE]: '生活管理',
  [ModuleKey.AI_ASSISTANT]: 'AI 助手',
};
