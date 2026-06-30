## Zhidu Data Layer Architecture Plan

### Current State

Supabase 中已有 `knowledge_documents` + `knowledge_chunks` 表用于 RAG 文本检索，但数据为空。`universities` 表仅 7 列（seed 数据约 80 条），`majors` 表仅 6 列。而本地 Excel 资源包含 3,236 所院校（31 列）、1,727 个专业（28 列含薪酬）、多源排名数据，均未入库。

---

### A. Database Architecture

**核心思路：结构化表 + 知识库文本双轨并行，通过 `unified_search()` 统一检索。**

#### A.1 扩展 universities 表

```sql
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS is_985 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_211 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_dual_first_class BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS founding_year INTEGER,
  ADD COLUMN IF NOT EXISTS school_type TEXT,           -- 综合/理工/师范/医药
  ADD COLUMN IF NOT EXISTS education_level TEXT,        -- 本科/专科
  ADD COLUMN IF NOT EXISTS master_programs INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doctoral_programs INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gender_ratio TEXT,
  ADD COLUMN IF NOT EXISTS national_specialties TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS discipline_evaluation JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS affiliated TEXT,             -- 主管部门
  ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'seed',
  ADD COLUMN IF NOT EXISTS data_year INTEGER DEFAULT 2023;
```

#### A.2 新建 university_rankings 表

```sql
CREATE TABLE IF NOT EXISTS public.university_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  university_name TEXT NOT NULL,
  source TEXT NOT NULL,            -- ruanke / qs / usnews / 校友会 / times
  year INTEGER NOT NULL,
  rank INTEGER,
  score NUMERIC(8,2),
  tags TEXT[] DEFAULT '{}',
  region TEXT,
  metadata JSONB DEFAULT '{}',
  UNIQUE(university_name, source, year)
);
```

#### A.3 新建 discipline_evaluations 表

```sql
CREATE TABLE IF NOT EXISTS public.discipline_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  university_name TEXT NOT NULL,
  discipline_name TEXT NOT NULL,
  evaluation_round TEXT NOT NULL,    -- '4th' / '5th'
  rating TEXT NOT NULL,              -- A+ / A / A- / B+ ...
  UNIQUE(university_name, discipline_name, evaluation_round)
);
```

#### A.4 扩展 majors 表 + 新建 major_salary_data

```sql
ALTER TABLE public.majors
  ADD COLUMN IF NOT EXISTS major_code TEXT,
  ADD COLUMN IF NOT EXISTS discipline_category TEXT,
  ADD COLUMN IF NOT EXISTS employment_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS employment_rates JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS what_description TEXT,
  ADD COLUMN IF NOT EXISTS career_description TEXT,
  ADD COLUMN IF NOT EXISTS core_courses TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS graduate_paths TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS offering_schools JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'seed';

CREATE TABLE IF NOT EXISTS public.major_salary_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  major_id UUID REFERENCES public.majors(id) ON DELETE SET NULL,
  major_name TEXT NOT NULL,
  year INTEGER NOT NULL,
  avg_monthly_salary INTEGER,
  top_industries JSONB DEFAULT '[]',
  top_cities JSONB DEFAULT '[]',
  top_occupations JSONB DEFAULT '[]',
  UNIQUE(major_name, year)
);
```

#### A.5 unified_search() 统一检索函数

```sql
CREATE OR REPLACE FUNCTION unified_search(
  query_text TEXT,
  search_mode TEXT DEFAULT 'all',    -- structured / knowledge / all
  filters JSONB DEFAULT '{}',
  match_limit INT DEFAULT 20
) RETURNS TABLE (
  result_type TEXT,     -- university / major / knowledge_chunk
  result_id UUID,
  title TEXT,
  content TEXT,
  metadata JSONB,
  relevance_score FLOAT
)
-- 分别查询 universities、majors、knowledge_chunks，用 pg_trgm 相似度排序
-- 按 result_type 分组返回，每组 match_limit/3 条
```

---

### B. ETL Pipeline

**目录结构**：`packages/db/src/etl/`

| 模块 | 数据源 | 目标表 | 行数 |
|------|--------|--------|------|
| university-importer | 院校基础信息-版本2.xlsx | universities | 3,236 |
| major-importer | 专业基本介绍.xlsx | majors | 1,450 |
| salary-importer | 专业介绍及薪酬表.xlsx | major_salary_data | ~18,000 (11年×专业) |
| ranking-importer | 2021-2023 软科/QS/U.S.News/校友会/泰晤士 | university_rankings | ~3,000 |
| discipline-eval-importer | 第四轮学科评估.xlsx | discipline_evaluations | ~5,110 |
| knowledge-generator | 结构化数据 -> 文本 | knowledge_documents + chunks | ~15,000 chunks |

**数据清洗策略**：

- 省份名标准化（"内蒙古" not "内蒙古自治区"）
- tier 字段从布尔标志推导：985 > 211 > 双一流 > 普通本科/专科
- 硕士点/博士点从 "X个" 格式提取整数
- 院校名称模糊匹配用于 FK 关联
- 所有导入数据标记 `data_source = 'excel_2023'`、`data_year`

**批量插入**：使用 Supabase service_role client，每批 100 行 upsert，`ON CONFLICT (name) DO UPDATE`。

**知识文本生成**：为每所院校/专业生成结构化描述文本，写入 knowledge_documents + knowledge_chunks，使文本搜索也能命中结构化数据。例如：

> "清华大学位于北京，是一所985/211/双一流综合类大学，建校于1911年。拥有56个硕士点、62个博士点。国家级特色专业包括计算机科学与技术、电子信息工程...学科评估A+学科有：计算机科学与技术、电气工程..."

---

### C. Web Crawling Strategy

#### C.1 优先级目标

| 优先级 | 数据源 | URL | 目标数据 | 技术方案 |
|--------|--------|-----|----------|----------|
| 1 | 阳光高考 | gaokao.chsi.com.cn | 2024-2025 录取分数线、专业目录 | Playwright (JS-heavy SPA) |
| 2 | 掌上高考 | gkcx.eol.cn | 分省分专业录取线、院校分数线 | Playwright + API 拦截 |
| 3 | 软科排名 | shanghairanking.cn | 2024-2025 大学排名 | HTTP + Cheerio |
| 4 | 各省教育考试院 | 各省独立站点 | 省控线、一分一段表 | Playwright |

#### C.2 爬虫架构

```
packages/db/src/crawl/
  base-crawler.ts           -- 限速 (2req/s) + 重试 (3次指数退避) + UA轮换
  gaokao-crawler.ts         -- 阳光高考
  eol-crawler.ts            -- 掌上高考 (优先拦截 XHR API)
  shanghairanking-crawler.ts
  data-validator.ts         -- 入库前校验 (分数100-750, 年份2020-2026)
```

#### C.3 合规措施

- 遵守 robots.txt
- 限速 2 req/s + 随机 500-2000ms jitter
- 本地缓存所有爬取 HTML/JSON，避免重复请求
- 数据存储 `data_source = 'crawl_2025'` 标明来源
- 凌晨 2-5 点执行，避开高峰

---

### D. Search Integration

#### D.1 新增 API 路由

| Route | Method | 用途 |
|-------|--------|------|
| `/api/knowledge/unified-search` | POST | 统一检索（结构化 + 文本） |
| `/api/data/universities` | GET | 院校列表（分页+筛选） |
| `/api/data/universities/[id]` | GET | 院校详情（排名、学科评估、录取线） |
| `/api/data/majors` | GET | 专业列表 |
| `/api/data/majors/[id]` | GET | 专业详情（薪酬、课程、开设院校） |

#### D.2 前端增强

**Knowledge Page** 改造：
- 搜索结果分两类展示：结构化卡片（院校卡/专业卡）+ 文本知识卡
- 院校卡显示：校名、省市、985/211 徽章、排名、关键指标
- 专业卡显示：专业名、学科门类、就业率、薪酬区间

**可选新页面**：
- `/dashboard/universities` — 院校浏览器（筛选+分页表格）
- `/dashboard/majors` — 专业浏览器

---

### E. Implementation Sequence

| # | 阶段 | 内容 | 依赖 |
|---|------|------|------|
| 1 | Schema | Migration 012: 扩展 universities/majors + 新建 rankings/disc_evals/salary | — |
| 2 | Types | 更新 `@zhidu/db` TypeScript 类型定义 | #1 |
| 3 | ETL | university-importer + 执行导入 | #1-2 |
| 4 | ETL | major-importer + salary-importer | #1-2 |
| 5 | ETL | ranking-importer + discipline-eval-importer | #1-2 |
| 6 | Search | unified_search() SQL 函数 | #1 |
| 7 | ETL | knowledge-generator (结构化 -> 文本 chunks) | #3-5 |
| 8 | API | unified-search + structured data API routes | #6 |
| 9 | Frontend | Knowledge page 增强 + 结构化结果卡片 | #8 |
| 10 | Crawl | 爬虫基础设施 + 阳光高考/掌上高考 | 可与 #3-9 并行 |

**预计数据量**：~35,000 行结构化数据 + ~15,000 知识文本 chunks，远在 Supabase 免费额度内。

---

### Critical Files

| File | Changes |
|------|---------|
| `packages/db/src/migrations/012_structured_data.sql` | 新建 — 所有表结构变更 |
| `packages/db/src/index.ts` | 扩展类型定义 |
| `packages/db/src/repository.ts` | 新增结构化查询函数 |
| `packages/db/src/etl/*.ts` | 新建 — ETL 管道 |
| `packages/db/src/crawl/*.ts` | 新建 — 爬虫模块 |
| `apps/web/src/app/api/knowledge/unified-search/route.ts` | 新建 |
| `apps/web/src/app/api/data/universities/route.ts` | 新建 |
| `apps/web/src/app/(dashboard)/dashboard/knowledge/page.tsx` | 增强搜索结果展示 |
