<div align="center">

<br/>

<img src="https://raw.githubusercontent.com/sjkncs/zhidu/master/assets/logo.svg" width="80" alt="Zhidu Logo" />

# **知渡 Zhidu**

### *AI 驱动的高考志愿填报与大学生全周期成长平台*

**从高考志愿到大学毕业，AI 驱动的个人成长操作系统**

<br/>

<img src="https://img.shields.io/github/v/release/sjkncs/zhidu?style=for-the-badge&color=3B82F6&label=Release" />
<img src="https://img.shields.io/github/license/sjkncs/zhidu?style=for-the-badge&color=10B981" />
<img src="https://img.shields.io/github/stars/sjkncs/zhidu?style=for-the-badge&color=F59E0B" />
<img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs" />
<img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" />
<img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase" />
<img src="https://img.shields.io/badge/Tauri-2.0-FFC131?style=for-the-badge&logo=tauri" />
<img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript" />

<br/><br/>

`Pre Release` · `v0.1.0` · `License MIT` · `Supported OS: macOS, Windows` · `pnpm Monorepo`

<br/>

### **Open Source · AI-Native · Privacy-First · Full-Stack**

<br/>

**[Website](#)** · **[PRD Document](docs/)** · **[Discussions](https://github.com/sjkncs/zhidu/discussions)** · **[Issues](https://github.com/sjkncs/zhidu/issues)**

<br/>

---

</div>

## 为什么需要知渡？

高考志愿填报是多数中国学生面临的第一个重大人生决策——全国 **3000+ 高校**、**800+ 专业**、各省录取规则差异巨大，而学生和家长往往依赖碎片化信息和经验判断。

但志愿填报只是起点。进入大学后，学生面对学业管理、技能培养、实习科研、社交关系、财务规划等多维度挑战，却缺少一个统一的数字化平台来系统性地规划和记录成长轨迹。

**知渡** 的目标是成为这个全周期的「个人成长操作系统」：以 AI 志愿填报为入口，以大学生成长管理为纵深，构建一个从高二到大学毕业（约 6 年）的长期陪伴型产品。

> **知渡的差异化：** 唯一将志愿填报与大学四年成长管理整合、并用 AI 贯穿全周期的产品。不是做一堆独立工具，而是构建一个理解用户全貌的「数字分身」。

<br/>

## 核心特性

<div align="center">

| | |
|:---:|:---:|
| **AI 志愿填报** — 规则引擎 + LLM 混合推荐，冲/稳/保梯度方案 + 风险矩阵 | **生涯规划** — MBTI/霍兰德测评，职业路径图谱，LLM 个性化路径生成 |
| **大学管理** — 课程表、GPA 追踪、学分规划、AI 选课建议 | **技能树** — 技能图谱、学习路线、进度追踪、LLM 生成路线图 |
| **知识库** — Markdown 笔记、语义搜索(pgvector)、RAG 问答 | **简历中心** — 多版本管理、AI 润色、JD 匹配打分 |
| **实习管理** — 申请追踪、AI 面试模拟、实习复盘 | **科研管理** — 论文笔记、AI 摘要、发表追踪 |
| **时间管理** — 日程/待办、番茄钟、AI 周回顾 | **日记与情绪** — 情绪追踪、AI 成长洞察、时间轴回顾 |
| **财富管理** — 收支记账、预算设定、AI 消费洞察 | **9 大企业模块** — 数据平台/财务/品牌/运营/战略/客服/供应链/用户运营/信息中心 |

</div>

<br/>

## AI 混合架构

知渡采用三层 AI 路由架构，按任务复杂度智能分流，兼顾性能与成本：

<div align="center">

<img src="https://raw.githubusercontent.com/sjkncs/zhidu/master/docs/images/ai-hybrid-architecture.png" width="800" alt="AI Hybrid Routing Architecture" />

</div>

- **确定性任务** → 规则引擎，0 延迟，0 成本
- **检索增强任务** → RAG (pgvector)，中等成本
- **创造性/分析性任务** → LLM 深度推理 (DeepSeek / GLM / GPT-4o)

<br/>

## AI 志愿填报流程

知渡的 AI 志愿填报引擎采用五阶段流水线架构，从数据采集到方案输出，全程 AI 驱动：

<div align="center">

<img src="https://raw.githubusercontent.com/sjkncs/zhidu/master/docs/images/volunteer-workflow.png" width="800" alt="AI Volunteer Application Workflow" />

</div>

<br/>

## 技术栈

| 层次 | 技术 | 说明 |
|:---|:---|:---|
| **Web 前端** | Next.js 16 + React 19 + Turbopack | SSR/SSG 混合、极速 HMR |
| **桌面端** | Tauri 2.0 (Rust) | <10MB、安全沙箱、复用 Web 代码 |
| **UI** | TailwindCSS v4 + @zhidu/ui 组件库 | CSS 变量主题、明暗模式 |
| **状态管理** | Zustand + React Query | 轻量、SSR 友好 |
| **后端 API** | Next.js API Routes | 全栈统一 TypeScript |
| **数据库** | PostgreSQL (Supabase) | RLS 权限、实时订阅、pgvector 向量 |
| **AI 层** | 规则引擎 + LLM API | 混合路由，按任务分流 |
| **认证** | Supabase Auth | OAuth + 手机验证码 |
| **部署** | Vercel (Web) + GitHub Releases | 自动 CI/CD |
| **Monorepo** | pnpm + Turborepo | 多包管理、增量构建 |
| **测试** | Vitest + @vitest/coverage-v8 | 单元测试 + 覆盖率 |

<br/>

## 项目结构

```
zhidu/
├── apps/
│   ├── web/                    # Next.js 16 Web 应用
│   │   ├── src/app/            # App Router 页面 + API Routes
│   │   │   ├── (auth)/         # 登录/注册
│   │   │   ├── (dashboard)/    # 所有功能模块看板
│   │   │   └── api/            # 后端 API（30+ 路由）
│   │   ├── src/lib/            # Supabase 客户端、AI 服务
│   │   └── src/components/     # 页面级组件
│   └── desktop/                # Tauri 2.0 桌面端
│       └── src-tauri/          # Rust 后端
├── packages/
│   ├── ui/                     # @zhidu/ui 共享组件库
│   ├── db/                     # @zhidu/db 数据库 schema + repos
│   ├── ai/                     # @zhidu/ai AI 服务封装
│   ├── shared/                 # @zhidu/shared 共享类型/常量
│   └── ml/                     # Python ML 模型（远期）
├── supabase/
│   └── migrations/             # 数据库迁移 SQL（26+ 表）
├── docs/                       # 项目文档
└── package.json                # Monorepo 根配置
```

<br/>

## 快速开始

### 前置条件

- Node.js >= 20.0
- pnpm >= 9.15
- [Supabase](https://supabase.com) 项目（或使用本地实例）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/sjkncs/zhidu.git
cd zhidu

# 安装依赖
pnpm install

# 配置环境变量
cp apps/web/.env.example apps/web/.env.local
# 编辑 .env.local 填入 Supabase URL / ANON_KEY / SERVICE_ROLE_KEY

# 启动开发服务器
pnpm dev:web          # Web 端 → http://localhost:3000

# 构建生产版本
pnpm build:web
```

### 数据库初始化

```bash
# 在 Supabase Dashboard SQL Editor 中依次执行 migrations/ 下的 SQL 文件
# 或使用 Supabase CLI:
npx supabase db push
```

<br/>

## 模块架构

知渡将所有功能模块分为四层，按优先级递进：

<div align="center">

<img src="https://raw.githubusercontent.com/sjkncs/zhidu/master/docs/images/module-architecture.png" width="800" alt="Four-Layer Module Architecture" />

</div>

<br/>

## 迭代路线

| Phase | 名称 | 核心内容 | 状态 |
|:---:|:---|:---|:---:|
| 0 | 项目基建 | Monorepo + CI/CD + 设计系统 | **Done** |
| 1 | 用户系统 | 注册登录 + Layout + Dashboard + 主题 | **Done** |
| 2 | AI 志愿填报 | 数据库 + 规则引擎 + 测评 + LLM 分析 | **Done** |
| 3 | 生涯 + 大学 | 职业路径 + 目标分解 + 课程管理 + GPA | **Done** |
| 4 | 技能 + 知识 | 技能树 + 笔记 + 语义搜索 + RAG | **Done** |
| 5 | 简历 + 实习 + 科研 | 简历编辑 + AI 润色 + 申请追踪 | **Done** |
| 6 | 日常工具 | 日程 + 待办 + 番茄钟 + 备忘 + 日记 | **Done** |
| 7 | 补充 + AI 助手 | 记账 + 关系记录 + 全局 AI 对话 | **Done** |
| 8 | 企业模块 | 9 大企业管理模块（26 表 + 10 API） | **Done** |
| 9 | 多端 + 数据 | 桌面端增强 + PWA + 年报 + 备份 | **Planned** |

<br/>

## 非功能性目标

| 指标 | 目标 |
|:---|:---|
| 首屏加载 | < 2s (Web) / < 1s (Desktop) |
| 规则引擎响应 | < 500ms |
| LLM 首 token | < 2s (流式输出) |
| 数据库查询 | < 200ms (P95) |
| 安全 | Supabase RLS + bcrypt + HTTPS + Tauri 沙箱 |
| 隐私 | GDPR/个保法合规，用户可删除全部数据 |

<br/>

## 竞品对比

| 产品 | 志愿填报 | 大学管理 | AI 贯穿 | 桌面端 | 开源 |
|:---|:---:|:---:|:---:|:---:|:---:|
| **知渡** | **Full** | **Full** | **Full** | **Tauri** | **MIT** |
| 掌上高考 | Full | None | Partial | None | None |
| 优志愿 | Full | None | Partial | None | None |
| Notion | None | Partial | None | Electron | None |
| 超级简历 | None | None | Partial | None | None |

<br/>

<div align="center">

## 贡献

欢迎 Issue 和 Pull Request。提交前请阅读 Contributing 指南。

<br/>

<img src="https://img.shields.io/badge/Made%20with-%E2%9D%A4%EF%B8%8F-red?style=flat-square" />
<img src="https://img.shields.io/badge/Built%20by-AI%20%2B%20Human-8B5CF6?style=flat-square" />

<br/>

**知渡** — *"知"为知识、知晓，"渡"为摆渡、引渡*

*从高考志愿到大学毕业，AI 陪伴你的每一步成长*

<br/>

[MIT License](LICENSE) · [sjkncs/zhidu](https://github.com/sjkncs/zhidu)

</div>
