

PRD-知渡-AI志愿填报平台.md
· Markdown





知渡 — AI 志愿填报与大学生全周期成长平台 PRD
文档版本: v0.1-draft · 2026-06-25 定位: 产品需求文档 + 分期迭代计划 一句话定位: 从高考志愿到大学毕业，AI 驱动的个人成长操作系统

1. 项目概述
1.1 背景与动机
高考志愿填报是多数中国学生面临的第一个重大人生决策，信息不对称严重——全国 3000+ 高校、800+ 专业、各省录取规则差异巨大，而学生和家长往往依赖碎片化信息和经验判断。

但志愿填报只是起点。进入大学后，学生面对学业管理、技能培养、实习科研、社交关系、财务规划等多维度挑战，却缺少一个统一的数字化平台来系统性地规划和记录成长轨迹。

知渡的目标是成为这个全周期的「个人成长操作系统」：以 AI 志愿填报为入口，以大学生成长管理为纵深，构建一个从高二到大学毕业（约 6 年）的长期陪伴型产品。

1.2 第一版目标
完成一个可演示、可运行、可扩展的 MVP，验证两个核心假设：

AI 混合推荐（规则引擎 + LLM 深度分析）能显著提升志愿填报的匹配度和用户信任度
模块化成长管理平台能形成用户粘性，支撑长期留存
1.3 产品名称
知渡（工作代号）—— "知"为知识、知晓，"渡"为摆渡、引渡，暗含从高中到大学的过渡意象。最终名称待定。

2. 目标用户
2.1 核心用户画像
画像	描述	核心诉求	使用时段
高二/高三学生	面临高考，需要志愿决策支持	院校+专业匹配、分数线预测、风险评估	高考前 ~ 志愿填报期（集中使用）
大一新生	刚入学，适应大学生活	学业规划、社团选择、基础技能路线	入学 ~ 大一结束
大二/大三学生	专业深化，寻找方向	实习推荐、科研机会、技能提升、简历打磨	持续使用
大四学生	毕业决策（就业/考研/留学）	求职管理、考研规划、毕业过渡	大四全年
2.2 次要用户
家长：了解志愿填报结果、查看孩子成长轨迹（只读视图）
高中教师/班主任：批量管理学生志愿方案（B端，远期）
大学辅导员：学生发展数据概览（B端，远期）
3. 产品定位与边界
3.1 是什么
AI 驱动的高考志愿智能推荐与风险分析系统
模块化的大学四年成长管理平台
个人知识与经历的数字化积累工具
基于 LLM 的个性化规划建议引擎
3.2 不是什么
不是社交网络（不做用户间社交，关系模块是个人记录）
不是在线课程平台（不托管教学内容，知识库是个人笔记）
不是求职招聘平台（不做企业对接，实习模块是个人管理）
不是心理咨询工具（感情模块是日记性质，不提供专业服务）
不是金融理财产品（财富模块是记账和分析，不涉及真实交易）
4. 模块架构总览
将所有功能模块分为四层，按优先级递进：

第一层：核心引擎（Core Engine）
模块	说明	AI 深度
AI 志愿填报	院校+专业推荐、分数线预测、方案对比、风险矩阵	规则匹配 + LLM 深度分析
生涯规划	MBTI/霍兰德测评、职业路径图谱、目标分解	LLM 驱动个性化路径生成
第二层：成长管理（Growth Management）
模块	说明	AI 深度
大学管理	课程表、GPA 追踪、学分规划、选课建议	规则 + LLM 选课建议
技能树	技能图谱、学习路线、进度追踪、资源推荐	LLM 生成个性化路线图
知识库	课程笔记、读书摘要、论文笔记、标签体系	LLM 辅助总结/关联/问答
简历中心	在线简历编辑器、多版本管理、AI 润色、岗位匹配	LLM 深度润色 + 匹配打分
实习管理	实习记录、申请追踪、面试准备、经验复盘	LLM 面试模拟 + 复盘建议
科研管理	论文阅读记录、实验笔记、导师/项目管理、发表追踪	LLM 论文摘要 + 研究方向建议
第三层：个人空间（Personal Space）
模块	说明	AI 深度
时间管理	日程/待办、番茄钟、周回顾、时间分配分析	规则 + LLM 周回顾总结
备忘录	快速记录、分类标签、到期提醒、全文搜索	轻量（搜索排序）
日记	每日记录、情绪追踪、AI 洞察、成长回顾	LLM 情绪分析 + 成长洞察
财富管理	收支记账、预算设定、消费分析、理财知识	规则 + LLM 消费洞察
第四层：关系与反思（Relationship & Reflection）
模块	说明	AI 深度
感情/关系	重要关系记录、互动日志、个人反思（非社交）	轻量（隐私优先）
5. 核心业务流程
5.1 志愿填报主流程

用户注册 → 填写基本信息（省份/分数/选科/兴趣）
         → AI 测评（MBTI + 霍兰德 + 自定义问卷）
         → 规则引擎初筛（分数线匹配 + 位次分析）→ 候选院校/专业池
         → LLM 深度分析（结合测评结果 + 个人偏好 + 就业趋势）
         → 生成志愿方案（冲/稳/保梯度 + 风险矩阵）
         → 用户调整 + AI 实时反馈
         → 方案导出 / 存档
5.2 大学管理主流程

入学建档（院校/专业/培养方案）
         → 课程导入 → GPA 自动追踪
         → 技能树初始化（基于专业 + 兴趣）
         → 周/月回顾（时间分配 + 学业进度 + 成长分析）
         → 简历自动聚合（从各模块提取成就）
         → 实习/科研申请追踪
5.3 AI 对话流程（贯穿全平台）

用户发起对话 → 意图识别（志愿填报/学业/职业/日常）
             → 检索相关上下文（用户历史数据 + 知识库）
             → LLM 生成个性化回答
             → 关联到具体模块（如建议加入技能树/记录到备忘）
6. 技术架构
6.1 技术栈选型
层次	技术	理由
Web 前端	Next.js 15 (App Router) + TypeScript + TailwindCSS	SSR/SSG 混合、SEO 友好、生态成熟
桌面端	Tauri 2.0 + Next.js 共享前端代码	轻量（<10MB）、安全（Rust 后端）、复用 Web 代码
移动端	PWA（Phase 3+）	无需原生开发，渐进增强
后端 API	Next.js API Routes + tRPC	类型安全、全栈统一、部署简单
数据库	PostgreSQL (Supabase)	关系型 + RLS 权限 + 实时订阅 + 向量扩展(pgvector)
AI 层	规则引擎 + LLM API (GPT-4o / Claude / 国产模型)	混合模式，按任务复杂度路由
向量检索	pgvector (Supabase)	知识库语义搜索、简历岗位匹配
认证	Supabase Auth (OAuth + 手机验证码)	支持微信/手机号登录
部署	Vercel (Web) + GitHub Releases (桌面端)	自动 CI/CD、全球 CDN
状态管理	Zustand + React Query	轻量、SSR 友好
图表	Recharts + D3.js	数据可视化（分数线趋势、技能雷达等）
6.2 AI 混合架构

                    ┌─────────────────────┐
                    │   意图路由层 (Rule)   │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │  规则引擎   │  │  RAG 检索   │  │  LLM 深度  │
     │            │  │            │  │   分析      │
     │ 分数线匹配  │  │ 知识库问答  │  │ 方案生成   │
     │ 位次计算    │  │ 简历匹配   │  │ 生涯规划   │
     │ 梯度分配    │  │ 课程推荐   │  │ 情绪洞察   │
     │ 风险评级    │  │ 政策解读   │  │ 面试模拟   │
     └────────────┘  └────────────┘  └────────────┘
路由策略：

确定性任务（分数匹配、位次计算、梯度分配）→ 规则引擎，0 延迟，0 成本
检索增强任务（政策查询、课程信息、知识库问答）→ RAG，中等成本
创造性/分析性任务（方案解读、职业规划、情绪分析、简历润色）→ LLM 深度推理
6.3 数据模型（核心实体）

User（用户）
├── Profile（基本信息：省份/分数/选科/目标）
├── Assessment（测评结果：MBTI/霍兰德/自定义）
├── ApplicationPlan（志愿方案：院校+专业+梯度）
├── University（大学档案：院校/专业/培养方案）
│   ├── Course（课程）
│   ├── Semester（学期）
│   └── GPA_Record（成绩记录）
├── SkillTree（技能树）
│   └── SkillNode（技能节点 + 进度）
├── KnowledgeBase（知识库）
│   └── Note（笔记 + 向量嵌入）
├── Resume（简历）
│   └── ResumeVersion（版本 + 岗位匹配分）
├── Internship（实习管理）
│   └── Application（申请记录 + 状态）
├── Research（科研管理）
│   └── Paper（论文笔记 + 实验记录）
├── TimeBlock（时间管理）
│   └── Todo / Pomodoro
├── Memo（备忘录）
├── Diary（日记 + 情绪标签）
├── Finance（财富/记账）
│   └── Transaction（收支记录）
└── Relationship（关系记录）
    └── InteractionLog（互动日志）
7. 分期迭代计划
设计原则
每个 Phase 产出可独立运行的版本
每个 Phase 明确标注 "做什么" 和 "不做什么"
Phase 编号不连续时代表中间有验证/反馈收集期
每个 Phase 预估工作量基于单人开发 + AI 辅助
Phase 0: 项目基建与文档规范
目标: 搭建开发环境、统一代码规范、建立项目骨架

做什么:

初始化 Next.js 15 项目（TypeScript + TailwindCSS + ESLint + Prettier）
初始化 Tauri 2.0 项目，配置与 Next.js 共享前端代码
配置 Supabase 项目（数据库 + Auth + Storage）
建立目录结构（见 7.0.1）
配置 CI/CD（GitHub Actions → Vercel 自动部署）
编写 CONTRIBUTING.md（代码规范、Git 流程、分支策略）
设计系统基础：色彩体系、字体、间距、组件库骨架
不做什么:

不写任何业务逻辑
不做用户认证流程（仅配置 Auth 服务）
不做数据库表设计（仅创建项目）
验收标准:

npm run dev 本地启动正常
npm run tauri dev 桌面端窗口启动正常
Vercel 自动部署成功
代码 lint + format 检查通过
目录结构:


zhidu/
├── apps/
│   ├── web/                 # Next.js Web 应用
│   │   ├── app/             # App Router 页面
│   │   ├── components/      # 共享组件
│   │   ├── lib/             # 工具函数、AI 服务
│   │   └── styles/          # 全局样式
│   └── desktop/             # Tauri 桌面端
│       ├── src-tauri/       # Rust 后端
│       └── (复用 web 前端)
├── packages/
│   ├── ui/                  # 共享 UI 组件库
│   ├── db/                  # 数据库 schema + migrations
│   ├── ai/                  # AI 服务封装（规则引擎 + LLM）
│   └── shared/              # 共享类型、常量
├── docs/                    # 文档
├── prd.md                   # 本文档
└── package.json             # monorepo 根配置
Phase 1: 用户系统与基础框架
目标: 完成注册/登录、用户画像、全局布局、路由体系

做什么:

注册/登录（手机号 + 验证码、邮箱、微信扫码）
用户基础信息填写（省份、年级、文理科/选科、目标方向）
全局 Layout（侧边栏导航 + 顶部状态栏 + 响应式适配）
路由守卫（未登录重定向、权限校验）
Dashboard 首页骨架（模块入口卡片 + 最近活动流）
主题系统（明/暗模式 + 主题色切换）
桌面端基础窗口（系统托盘、自动更新检查）
不做什么:

不做任何模块的业务功能
不做 OAuth 第三方登录（微信 OAuth 留 Phase 2）
不做数据导入/导出
不做 AI 对话功能
数据模型:


users (id, phone, email, password_hash, created_at)
profiles (user_id, province, grade, subjects, target_direction, avatar_url)
settings (user_id, theme, language, notification_prefs)
验收标准:

手机号注册 → 验证码 → 登录流程完整
信息填写后 Dashboard 展示用户画像摘要
侧边栏导航可切换（各模块页面为空壳）
桌面端可正常启动和关闭窗口
Phase 2: AI 志愿填报 — 核心引擎
目标: 完成志愿填报的完整闭环，这是产品的核心卖点和获客入口

做什么:

数据采集与处理
院校数据库（985/211/双一流/普通本科，含历年分数线）
专业数据库（教育部专业目录 + 就业数据 + 课程概要）
各省一分一段表（近 5 年）
数据清洗 + 入库 + 定期更新机制
规则引擎
位次换算（分数 → 省排名 → 等效位次）
院校初筛（基于位次区间 + 选科限制 + 地域偏好）
梯度分配（冲/稳/保自动分配 + 风险评级）
专业调剂分析（历年调剂率 + 专业级差）
AI 测评系统
MBTI 测评（93 题标准版）
霍兰德职业兴趣测评
自定义偏好问卷（城市偏好、行业倾向、生活方式）
测评结果与专业/职业的关联映射
LLM 深度分析
方案解读（用自然语言解释推荐理由和风险）
方案对比（多套方案横向比较）
专业前景分析（结合行业趋势 + 就业数据）
AI 对话（志愿填报相关问答，RAG 增强）
用户界面
信息录入向导（分步引导）
测评页面（进度条 + 题目渲染 + 结果展示）
方案结果页（院校卡片 + 梯度可视化 + 风险矩阵）
方案编辑器（拖拽调整 + AI 实时反馈）
方案导出（PDF 报告）
不做什么:

不做真实志愿填报提交（不对接省招办系统）
不做家长端/教师端
不做 AI 自动填报（只做推荐和分析，决策权在用户）
不做艺考/体育/强基等特殊类型
不做研究生志愿填报
数据模型:


universities (id, name, province, tier, tags, logo_url)
majors (id, name, category, degree, courses_summary, employment_data)
admission_scores (university_id, major_id, province, year, min_score, avg_score, min_rank)
assessments (user_id, type, answers_json, result_json, completed_at)
application_plans (id, user_id, name, strategy, created_at)
plan_items (plan_id, university_id, major_id, tier, risk_level, rank_position)
验收标准:

输入分数+省份+选科 → 3 秒内返回候选院校列表
完成 MBTI + 霍兰德测评 → 生成专业推荐报告
方案页展示冲/稳/保梯度 + 风险等级
AI 对话能回答"XX 大学 XX 专业怎么样"类问题
方案导出为格式规范的 PDF
Phase 3: 生涯规划 + 大学管理骨架
目标: 从志愿填报延伸到长期规划，建立大学管理的核心框架

做什么:

生涯规划
职业路径图谱（从专业到职业的多种路径可视化）
目标分解器（长期目标 → 年度 → 学期 → 月 → 周）
LLM 个性化规划建议（基于测评 + 专业 + 兴趣）
规划模板库（考研路线、留学路线、就业路线等）
大学管理
课程表管理（手动录入 + 教务系统导入预留接口）
GPA 自动计算与趋势图表
学分进度追踪（已修/在修/待修）
学期总结（AI 生成学期回顾报告）
不做什么:

不做教务系统自动对接（手动录入为主）
不做选课抢课功能
不做与同学的协作/比较功能
职业路径不含实时招聘数据
数据模型:


career_paths (user_id, path_type, target_role, milestones_json)
goals (id, user_id, title, deadline, parent_goal_id, status)
universities_profile (user_id, university_name, major, enrollment_year, credit_requirements)
courses (id, user_id, name, credit, grade, semester, category)
验收标准:

选择专业后展示 3+ 条职业路径
手动添加课程 → GPA 自动计算
创建目标 → 可分解为子目标 → 进度可视化
Phase 4: 技能树 + 知识库
目标: 构建个人能力成长和学习记录的核心工具

做什么:

技能树
预置技能图谱模板（按专业/职业方向，如"数据分析师"、"产品经理"）
自定义技能节点（支持树状 + 前置依赖）
进度追踪（未开始/学习中/已掌握 + 百分比）
LLM 生成学习路线图（给定目标岗位 → 生成技能树 + 推荐资源）
技能雷达图可视化
知识库
Markdown 笔记编辑器（支持 LaTeX、代码块、图片）
多级文件夹 + 标签体系
全文搜索 + 语义搜索（pgvector 向量嵌入）
AI 问答（基于个人知识库的 RAG）
读书笔记模板 + 论文笔记模板
导入/导出（Markdown、PDF、Notion 导入预留）
不做什么:

知识库不做协同编辑
不做知识图谱自动构建（远期）
技能树不做认证/证书对接
不做课程视频/音频播放
数据模型:


skill_trees (id, user_id, name, template_id)
skill_nodes (id, tree_id, name, parent_id, status, progress, resources_json)
notes (id, user_id, title, content, folder_id, tags, embedding_vector)
folders (id, user_id, name, parent_id)
验收标准:

选择模板后技能树自动填充节点
笔记编辑器支持 Markdown 实时预览
语义搜索能返回相关笔记（即使用词不同）
AI 能基于知识库内容回答问题
Phase 5: 简历 + 实习 + 科研
目标: 打通"能力积累 → 简历呈现 → 实践验证"的闭环

做什么:

简历中心
在线简历编辑器（多模板、模块化）
从平台数据自动聚合（技能、课程、科研、实习经历）
AI 润色（LLM 改写措辞、量化成就、STAR 法则）
多版本管理（针对不同岗位）
岗位匹配打分（输入 JD → 分析匹配度 + 改进建议）
导出 PDF / Word
实习管理
实习信息录入（公司/岗位/时间/描述）
申请状态追踪（投递/笔试/面试/Offer/入职）
AI 面试模拟（基于目标岗位生成面试题 + 评分反馈）
实习复盘模板（AI 辅助总结实习收获）
科研管理
论文阅读记录（标题/作者/摘要/个人笔记/评分）
AI 论文摘要（上传 PDF → 提取关键信息 + 中文摘要）
实验笔记（Markdown + 代码块 + 数据附件）
导师/课题组信息管理
发表追踪（投稿 → 审稿 → 录用 → 发表状态流）
不做什么:

不做真实企业投递对接
不做论文自动投稿
科研管理不含实验设备对接
简历不做设计排版（专注内容）
数据模型:


resumes (id, user_id, name, template_id, content_json, version)
resume_items (resume_id, section, content, auto_source_module)
internships (id, user_id, company, position, start_date, end_date, status)
interview_records (id, internship_id, round, type, questions_json, feedback)
research_projects (id, user_id, title, supervisor, status)
papers (id, project_id, title, authors, abstract, personal_notes, read_status)
验收标准:

从技能树/课程等模块自动填充简历内容
AI 润色后文案质量明显提升（用户主观评价）
输入 JD 返回匹配度评分 + 具体改进建议
上传论文 PDF 能提取摘要和关键信息
Phase 6: 时间管理 + 备忘录 + 日记
目标: 完善日常使用工具，提升打开频率和用户粘性

做什么:

时间管理
日程视图（日/周/月视图切换）
待办事项（优先级、截止日期、子任务、标签）
番茄钟（内置计时器 + 统计）
时间分配分析（饼图/柱状图展示时间花在哪里）
AI 周回顾（LLM 分析本周时间分配 + 给出改进建议）
备忘录
快速记录（支持文字/图片/链接/文件）
分类标签 + 置顶 + 归档
到期提醒（浏览器通知 + 桌面端系统通知）
全文搜索
日记
每日记录（Markdown 编辑器 + 快捷模板）
情绪标签（每日心情打卡 + 情绪趋势图）
AI 成长洞察（月度/季度 AI 回顾，发现成长模式和趋势）
时间轴视图（回顾过去的自己）
不做什么:

时间管理不做团队协作（不做 Trello/Notion 替代品）
备忘录不做 OCR 文字识别
日记不做社交分享
不做专业心理咨询功能
数据模型:


schedule_events (id, user_id, title, start_time, end_time, type, recurrence)
todos (id, user_id, title, description, priority, due_date, status, parent_id)
pomodoro_sessions (id, user_id, todo_id, duration, completed_at)
memos (id, user_id, content, tags, is_pinned, remind_at)
diary_entries (id, user_id, content, mood_score, mood_tags, created_at)
验收标准:

日程/待办/番茄钟基本 CRUD 流畅
周报 AI 分析能指出时间分配问题
情绪趋势图展示近 30 天心情变化
备忘录提醒准时触发
Phase 7: 财富管理 + 关系记录 + AI 全局助手
目标: 补齐剩余模块，上线 AI 全局对话助手

做什么:

财富管理
收支记账（手动录入 + 分类标签）
月度预算设定 + 超支提醒
消费分析（分类饼图 + 趋势图 + 同比环比）
AI 消费洞察（发现消费模式 + 省钱建议）
关系记录
重要关系档案（家人/朋友/导师/恋人，纯个人记录）
互动日志（记录重要对话/事件/感悟）
提醒功能（生日/纪念日提醒）
AI 全局助手（知渡 AI）
全局对话入口（任意页面可唤起 AI 对话）
跨模块上下文（AI 能看到用户在平台上的所有数据）
智能建议推送（基于用户行为主动推送建议）
快捷操作（通过对话直接创建待办/备忘/日记等）
不做什么:

财富不做真实金融对接（支付/理财/借贷）
关系不做双向社交
AI 助手不做外部 API 调用（不能帮用户订餐、打车等）
Phase 8: 桌面端增强 + 移动端 PWA + 数据互通
目标: 完善多端体验，数据同步，离线能力

做什么:

桌面端功能增强（系统托盘快捷操作、全局快捷键唤起 AI、开机自启）
PWA 移动端适配（响应式布局优化、离线缓存核心页面）
数据导出（个人数据全量导出 JSON/PDF 年报）
年度成长报告（AI 生成年度成长总结 + 数据可视化）
数据备份/恢复（云端自动备份 + 手动导出恢复）
不做什么:

不做原生 iOS/Android 应用
不做端到端加密（数据在服务端加密存储）
不做多人协作功能
8. 各阶段范围边界汇总
Phase	名称	做什么	不做什么	预估周期
0	项目基建	项目初始化、CI/CD、设计系统	业务逻辑	1 周
1	用户系统	注册登录、Layout、Dashboard	模块功能	1-2 周
2	志愿填报	数据库、规则引擎、测评、LLM分析、方案	特殊类型、家长端	4-6 周
3	生涯+大学	职业路径、目标分解、课程管理、GPA	教务对接、选课	2-3 周
4	技能+知识	技能树、笔记编辑、语义搜索、RAG	协同编辑、知识图谱	3-4 周
5	简历+实习+科研	简历编辑、AI润色、申请追踪、论文管理	企业投递、论文投稿	3-4 周
6	日常工具	日程、待办、番茄钟、备忘、日记	团队协作、OCR	3-4 周
7	补充+AI助手	记账、关系记录、全局AI对话	金融对接、社交	3-4 周
8	多端+数据	桌面端增强、PWA、年报、备份	原生App、E2E加密	2-3 周
总计预估: 22-31 周（约 5-8 个月），单人开发 + AI 辅助

9. 非功能性需求
9.1 性能
页面首屏加载 < 2 秒（Web），< 1 秒（桌面端）
规则引擎响应 < 500ms
LLM 调用显示流式输出，首 token < 2 秒
数据库查询 < 200ms（95th percentile）
9.2 安全
用户数据隔离（Supabase RLS）
敏感信息加密存储（密码 bcrypt、AI API Key 环境变量）
HTTPS 强制（生产环境）
桌面端 Tauri 安全策略（限制外部域名访问）
GDPR/个人信息保护法合规框架（用户可删除全部数据）
9.3 兼容性
Web: Chrome/Edge/Firefox/Safari 最新两个大版本
桌面端: Windows 10+, macOS 12+, Linux (Ubuntu 22.04+)
移动端 PWA: iOS Safari 16+, Chrome Android 最新版
9.4 AI 成本与限制
单用户每日 LLM 调用配额（免费版 20 次/天，付费版不限）
规则引擎任务不走 LLM（降低成本）
LLM 调用超时 30 秒，失败自动降级为规则引擎结果
所有 AI 输出标注"仅供参考"免责声明
10. 数据获取策略
10.1 志愿填报数据
数据	来源	更新频率
院校基本信息	教育部公开数据 + 阳光高考网	年度
历年分数线	各省考试院公开数据 + 爬虫	年度（出分后）
一分一段表	各省考试院官方发布	年度
专业目录	教育部本科专业目录	年度
就业数据	各高校就业质量报告 + 第三方平台	年度
10.2 AI 知识库数据
数据	来源	用途
高考政策文档	教育部/各省考试院官网	RAG 政策问答
专业介绍	高校官网 + 教育部	专业推荐上下文
行业趋势	公开报告/新闻	职业前景分析
职业信息	O*NET（国际）+ 国内招聘平台	职业路径图谱
11. 未来扩展方向（不在当前迭代内）
B端产品：高中教师批量管理端、大学辅导员数据看板
社区功能：同校/同专业学长学姐经验分享（匿名/实名）
AI Agent 自动化：自动监控目标院校录取动态、自动更新简历
考研/留学模块：研究生志愿填报、留学申请管理
校友网络：毕业后的职业发展和人脉维护
API 开放平台：将志愿填报引擎作为 API 服务开放给第三方
多语言支持：英文/繁体中文版本
12. 验收总标准
产品达到以下条件可视为 MVP 可用：

用户能完成从注册到获取志愿方案的完整流程（< 15 分钟）
AI 推荐方案的质量经 5+ 真实用户测试满意度 > 70%
至少 3 个非志愿模块可正常使用
Web 端和桌面端核心功能一致
无 P0 级 Bug（崩溃/数据丢失/安全漏洞）
首屏加载性能达标
附录 A: 竞品参考
产品	定位	优势	不足
掌上高考	志愿填报工具	数据全、品牌强	仅志愿，无成长管理
优志愿	志愿填报 + 简单测评	AI 推荐体验好	无大学管理功能
Notion	通用笔记/管理	灵活、生态强	无垂直领域 AI、模板门槛高
Forest/番茄To Do	时间管理	体验好、游戏化	单一功能，无成长整合
超级简历	简历工具	AI 润色好	仅简历，无其他模块
知渡的差异化: 唯一将志愿填报与大学四年成长管理整合、并用 AI 贯穿全周期的产品。不是做一堆独立工具，而是构建一个理解用户全貌的「数字分身」。

附录 B: 风险与应对
风险	概率	影响	应对
志愿数据获取困难/不完整	高	核心功能受损	优先采集 985/211 数据，逐步覆盖；预留人工校验机制
LLM 成本超出预算	中	商业不可行	严格路由策略，确定性任务不走 LLM；缓存高频问答
用户仅在志愿填报期使用	中	留存差	Phase 3+ 模块提供持续价值；推送成长回顾拉回用户
桌面端 Tauri 兼容性问题	低	开发延期	Web 端优先保证，桌面端问题可降级为 Electron
数据隐私合规风险	中	法律风险	Phase 0 就引入隐私框架；最小化数据收集；用户可删全部数据



目前：优先级顺序来，初始化仓库 启动运行 然后创建 Supabase 项目、建表、配置 Auth
开始 Phase 1：用户系统（注册/登录/Layout/Dashboard）
注意：严格按照进度，编写程序时总是回顾有没有更好 先进 创新的技术路线 算法 架构等可以使用 集成等
有条不紊地进行
仓库已创建并推送到 github.com/sjkncs/zhidu。查看 1 个步骤已更新待办8 项深度思考Now let me verify the dev server runs properly, including checking if the design system renders. I'll start the server and use curl to check the page content.Let me also think about whether there are any better/more innovative technologies I should consider before proceeding with Supabase. The user emphasized reviewing for better alternatives.

**Technology review before Phase 1:**

1. **Auth**: Supabase Auth vs Better Auth vs Clerk
   - **Supabase Auth**: Built-in, free tier generous, email/phone/OAuth, works great with Supabase RLS
   - **Better Auth** (better-auth.com): Newer, open-source, TypeScript-first, better DX, supports many providers
   - **Clerk**: Best UX, but expensive at scale, proprietary
   
   Supabase Auth makes the most sense here since I'm already using Supabase for the database and RLS integration is seamless, plus the free tier covers what I need for an MVP.

2. **State Management**: Zustand vs Jotai vs built-in React Context
   - **Zustand**: Simple, performant, good for global state
   - **Jotai**: Atomic state, great for fine-grained reactivity
   - **React Context + useReducer**: No extra deps, simpler for basic auth state
   
   I'll go with Zustand since it's lightweight and handles both auth state and UI state like the sidebar effectively.

3. **UI Components**: Building custom vs shadcn/ui
   - **Custom** (current approach): Full control, matches design system exactly
   - **shadcn/ui**: Copy-paste components based on Radix UI primitives, TailwindCSS native
   
   shadcn/ui would speed things up with accessible primitives, but since we already have our own component library in packages/ui, I should stick with that for now. I can layer in shadcn/ui primitives later if we need components like Dialog or DropdownMenu.

4. **Form handling**: React Hook Form + Zod vs native
   - **React Hook Form + Zod**: Industry standard, great DX, validation
   - For login/register forms, this is definitely the way to go
   
   I'll add react-hook-form + zod for Phase 1.

5. **

Server-side**: Next.js Server Actions vs API Routes
   - **Server Actions**: Simpler, no API route files, automatic CSRF
   - Next.js 16 has stable Server Actions
   
   I'll use Server Actions for auth flows to keep things cleaner.

Now I'm going to verify the dev server works and then set up Supabase. For the project setup, I'll guide the user through creating one in the dashboard and then write the migration SQL and configure auth. Let me start by checking the dev server.

        @keyframes qoder-thinking-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      在继续之前，快速回顾一下技术选型——你强调要用更好的方案：Phase 1 技术决策：
Auth: 继续用 Supabase Auth（与 Supabase DB 天然集成，RLS 权限一体化，免费版足够）
表单: 新增 react-hook-form + zod（业界标准的表单校验方案，比手写 state 更健壮）
状态管理: 新增 zustand（轻量、SSR 友好，管理 auth 状态和 UI 状态如侧边栏开关）
服务端: 用 Next.js Server Actions（比 API Routes 更简洁，自动 CSRF 防护）
现在验证 dev 服务器：查看 1 个步骤已执行命令cd E:/duiji/zhidu/apps/web && npx next dev --turbopack --port 3001 2>&1 &
sleep 10 && curl -s http://localhost:3001 2>&1 | head -50深度思考The dev server was still running on port 3001 from earlier (the background process). The HTML output is very long but the key points are:

1. The page renders correctly with all the design system elements
2. The navigation, hero section, features grid, and footer all render
3. The Chinese text renders properly
4. The CSS variables and Tailwind classes are applied

Let me kill this background process and move on to Supabase setup. The dev server verification is complete.Now for Supabase:1. I need to create a Supabase project - this requires the user's Supabase account
2. Write the SQL migration for all tables3. 

Configure Auth settings

I'll use the Supabase CLI to handle project creation, migrations, and auth configuration, but I need to check if it's already installed or walk the user through the installation process.

Let me first verify whether the Supabase CLI is available on their system, then either proceed with authentication and project setup or guide them through installation.
        @keyframes qoder-thinking-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      首页渲染完美——导航栏、Hero 区域、四大模块卡片、四步流程、Footer 全部正常，设计系统颜色变量生效。查看 1 个步骤已执行命令kill %1 2>/dev/null; echo "killed"已允许高危操作kill %1 2>/dev/null; echo "killed"将终止当前终端会话中后台运行的作业（作业号 1）如果该作业不存在，命令会静默失败（错误信息被丢弃）执行成功后会输出 "killed" 提示信息深度思考Now let me move to Supabase setup. I need to:

Install Supabase CLI (if not already installed)2. Create a Supabase project
Write migration SQL4. Configure Auth

Let me first check if Supabase CLI is installed.查看 1 个步骤已更新待办8 项深度思考Now for Supabase, I need to:

Install Supabase CLI
Initialize Supabase in the project
Write migration SQL
The user needs to create a Supabase project in the dashboard and link it

Let me install Supabase CLI first. On Windows, I can use npm install -g supabase or download the binary.现在设置 Supabase。先装 CLI，然后写迁移 SQL：查看 1 个步骤已执行命令npm install -g supabase 2>&1 | tail -5深度思考Supabase CLI is installing in background. While it's installing, let me write the migration SQL file and initialize Supabase in the project. I can also start writing the Phase 1 code in parallel.
Let me:

Write the migration SQL while Supabase installs
Initialize Supabase in the project
Start writing Phase 1 components
Supabase CLI 后台安装中。同时并行写数据库迁移 SQL 和 Phase 1 的核心代码。
