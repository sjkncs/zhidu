# Phase 9 PRD — 多端增强 + 数据

## 概览

| 项目 | 说明 |
|:---|:---|
| **Phase** | 9 |
| **名称** | 多端增强 + 数据 |
| **目标** | 桌面端原生能力、PWA 离线体验、用户年报、数据备份 |
| **前置** | Phase 0-8 全部 Done |
| **预计周期** | 4-6 周 |

---

## 9.1 桌面端增强 (Tauri Native)

### 目标

将 Tauri 从纯 Webview 壳升级为具备原生能力的桌面应用。

### 功能清单

| # | 功能 | 优先级 | 说明 |
|:---:|:---|:---:|:---|
| T1 | `@tauri-apps/api` JS 桥 | P0 | 前端可调用 Tauri API（窗口、文件系统、剪贴板） |
| T2 | 系统托盘 + 右键菜单 | P0 | 最小化到托盘、快捷操作（打开/退出/切换暗色模式） |
| T3 | 自动更新 | P1 | `@tauri-apps/plugin-updater`，GitHub Releases 分发 |
| T4 | 窗口状态持久化 | P1 | 记住窗口位置/大小，`@tauri-apps/plugin-store` |
| T5 | 原生通知 | P1 | 番茄钟提醒、日程提醒、AI 分析完成通知 |
| T6 | 离线缓存 | P2 | 本地 SQLite 缓存最近数据（课程、笔记、志愿方案） |
| T7 | 文件导出对话框 | P2 | 年报 PDF、志愿表 Excel 使用原生保存对话框 |
| T8 | 自定义菜单栏 | P2 | 文件/编辑/视图/帮助标准菜单 |
| T9 | 快捷键 | P3 | 全局快捷键（Ctrl+Shift+Z 快速打开知渡） |

### 技术方案

```
apps/desktop/
├── src-tauri/
│   ├── Cargo.toml          # 新增: tauri-plugin-updater, tauri-plugin-store,
│   │                       #        tauri-plugin-notification, tauri-plugin-dialog,
│   │                       #        tauri-plugin-sql (SQLite)
│   ├── src/
│   │   ├── lib.rs          # 注册所有插件 + 自定义 IPC commands
│   │   ├── tray.rs         # 系统托盘逻辑
│   │   ├── updater.rs      # 自动更新检查 + 下载
│   │   └── cache.rs        # SQLite 离线缓存管理
│   └── tauri.conf.json     # 更新: plugins, permissions, bundle config
├── src/
│   └── lib/
│       ├── tauri.ts        # JS 侧 Tauri API 封装（isDesktop() 判断）
│       ├── tray.ts         # 托盘菜单配置
│       └── offline.ts      # 离线缓存策略（在线同步 / 离线读取）
```

### IPC 命令设计

```rust
// 自定义 IPC 命令
#[tauri::command] fn get_cache_stats() -> CacheStats
#[tauri::command] fn clear_offline_cache() -> Result<()>
#[tauri::command] fn export_file(data: Vec<u8>, filename: String) -> Result<String>
```

---

## 9.2 PWA (Progressive Web App)

### 目标

Web 端支持离线访问、安装到手机/桌面，提供类原生体验。

### 功能清单

| # | 功能 | 优先级 | 说明 |
|:---:|:---|:---:|:---|
| P1 | Web App Manifest | P0 | name, icons, theme_color, display: standalone |
| P2 | Service Worker | P0 | 静态资源缓存 + API 请求 Network-First 策略 |
| P3 | 离线页面 | P0 | 无网络时显示友好的离线提示页 |
| P4 | 安装提示 | P1 | beforeinstallprompt 事件处理，自定义安装 UI |
| P5 | 后台同步 | P2 | 待办/日记等操作在恢复网络后自动同步 |
| P6 | Push 通知 | P3 | 日程提醒、AI 分析完成（需用户授权） |

### 技术方案

```
apps/web/
├── public/
│   ├── manifest.webmanifest    # PWA manifest
│   ├── icon-192.png            # PWA 图标
│   ├── icon-512.png
│   └── offline.html            # 离线回退页
├── src/
│   ├── sw.ts                   # Service Worker（@serwist/next 或手写）
│   └── lib/
│       └── pwa.ts              # 安装提示处理 + 更新检查
└── next.config.ts              # 添加 PWA headers（Cache-Control 等）
```

### 缓存策略

| 资源类型 | 策略 | 说明 |
|:---|:---|:---|
| 静态资源 (JS/CSS/字体) | Cache-First | 长期缓存，hash 变化时更新 |
| API 请求 | Network-First | 优先网络，失败时返回缓存 |
| 页面 HTML | Stale-While-Revalidate | 先展示缓存，后台更新 |
| 图片 | Cache-First + 过期 | 7 天过期，LRU 淘汰 |

### 依赖

```json
{
  "dependencies": {
    "@serwist/next": "^9.0.0",
    "serwist": "^9.0.0"
  }
}
```

---

## 9.3 年报 (Annual Report)

### 目标

基于用户全年数据生成个人年度总结报告，支持可视化和导出。

### 功能清单

| # | 功能 | 优先级 | 说明 |
|:---:|:---|:---:|:---|
| A1 | 数据聚合 API | P0 | 从各表汇总用户全年数据 |
| A2 | 年报页面 | P0 | 全屏滚动式年报展示（类似网易云音乐/支付宝年报） |
| A3 | 可视化图表 | P0 | 学习时长趋势、技能进度、GPA 变化、情绪曲线 |
| A4 | AI 年度总结 | P1 | LLM 生成个性化年度回顾文案 |
| A5 | 导出为图片 | P1 | html2canvas 截图分享 |
| A6 | 导出为 PDF | P2 | 完整版 PDF 报告 |

### 数据源

| 模块 | 数据表 | 聚合指标 |
|:---|:---|:---|
| 学业 | `courses`, `academic_summary` | 修课数、GPA 变化、最高分科目 |
| 技能 | `skills`, `skill_progress` | 新增技能、完成路线数、学习时长 |
| 知识库 | `notes`, `knowledge_search` | 笔记数、搜索次数、最活跃领域 |
| 日记 | `diary_entries` | 写作天数、情绪分布、高频关键词 |
| 时间 | `todos`, `pomodoro_sessions` | 完成待办数、番茄钟数、总专注时长 |
| 志愿 | `volunteer_plans` | 方案数、最终录取结果 |
| 简历 | `resumes` | 版本数、投递数 |

### 技术方案

```
apps/web/src/app/(dashboard)/dashboard/annual-report/
├── page.tsx                    # 年报入口页（选择年份）
├── components/
│   ├── ReportSlideShow.tsx     # 全屏滑动展示（framer-motion）
│   ├── slides/
│   │   ├── OverviewSlide.tsx   # 年度总览（关键数字）
│   │   ├── AcademicSlide.tsx   # 学业成就
│   │   ├── SkillSlide.tsx      # 技能成长
│   │   ├── DiarySlide.tsx      # 日记回顾（情绪曲线 + 词云）
│   │   ├── TimeSlide.tsx       # 时间投入
│   │   └── AISummarySlide.tsx  # AI 年度总结
│   └── charts/
│       ├── GPATrendChart.tsx   # GPA 趋势折线图（recharts）
│       ├── EmotionPie.tsx      # 情绪分布饼图
│       └── StudyHeatmap.tsx    # 学习热力图
└── api/
    └── route.ts                # GET /api/annual-report?year=2026
```

### API 设计

```typescript
// GET /api/annual-report?year=2026
interface AnnualReportData {
  year: number
  overview: {
    totalStudyHours: number
    coursesCompleted: number
    skillsUnlocked: number
    diaryEntries: number
    todoCompleted: number
  }
  academic: { gpaTrend: MonthlyData[]; topCourses: Course[] }
  skills: { newSkills: Skill[]; progressHighlights: SkillProgress[] }
  diary: { emotionDistribution: EmotionCount[]; keywords: WordCount[] }
  time: { pomodoroTotal: number; weeklyHours: WeeklyData[] }
  aiSummary: string  // LLM 生成的年度回顾
}
```

---

## 9.4 数据备份 (Backup & Export)

### 目标

用户可一键导出全部个人数据，支持定时备份，并可恢复。

### 功能清单

| # | 功能 | 优先级 | 说明 |
|:---:|:---|:---:|:---|
| B1 | 全量导出 API | P0 | 聚合用户所有数据表，输出 JSON |
| B2 | 导出为 ZIP | P0 | JSON + CSV + 附件打包下载 |
| B3 | 导出 UI | P0 | 设置页 → 数据管理 → 导出按钮 |
| B4 | 导入/恢复 | P1 | 上传 JSON 备份文件恢复数据 |
| B5 | 定时备份 | P2 | 每周自动备份到 Supabase Storage |
| B6 | 备份历史 | P2 | 查看/下载历史备份列表 |

### 技术方案

```
apps/web/src/
├── app/(dashboard)/dashboard/settings/
│   └── data/
│       └── page.tsx             # 数据管理设置页
├── app/api/backup/
│   ├── export/route.ts          # POST → 生成全量 ZIP 下载
│   ├── import/route.ts          # POST → 上传 JSON 恢复
│   └── history/route.ts         # GET → 备份历史列表
└── lib/
    └── backup/
        ├── aggregator.ts        # 从所有表聚合用户数据
        ├── exporter.ts          # JSON/CSV 格式化 + ZIP 打包
        ├── importer.ts          # JSON 解析 + upsert 恢复
        └── scheduler.ts         # 定时备份（Supabase Edge Function）
```

### 数据表清单（需导出的表）

```
user_profiles, courses, academic_summary, skills, skill_progress,
notes, knowledge_search, diary_entries, todos, pomodoro_sessions,
volunteer_plans, volunteer_results, resumes, internship_applications,
research_papers, finance_records, chat_messages, relationships
```

### 导出格式

```
zhidu-backup-2026-07-07.zip
├── metadata.json          # 版本号、用户ID、导出时间
├── profile.json           # 用户基本信息
├── academic/
│   ├── courses.csv
│   └── summary.json
├── skills.json
├── diary/
│   ├── entries.json
│   └── emotions.csv
├── time/
│   ├── todos.csv
│   └── pomodoro.csv
├── volunteer.json
├── resume.json
└── chat_history.json
```

---

## 执行顺序与依赖

```
Week 1-2: PWA (P1-P3) ← 独立，不影响其他模块
    ↓
Week 2-3: 数据备份 (B1-B3) ← 需要理解所有表结构
    ↓
Week 3-4: 年报 (A1-A4) ← 复用备份模块的数据聚合逻辑
    ↓
Week 4-6: 桌面端增强 (T1-T7) ← 依赖 Web 功能稳定后再做原生集成
```

### 关键依赖

- PWA 和桌面端共享离线缓存策略
- 年报的数据聚合复用备份模块的 `aggregator.ts`
- 桌面端的文件导出对话框复用年报的导出逻辑

---

## 非功能性要求

| 指标 | 目标 |
|:---|:---|
| Service Worker 注册 | < 500ms |
| 离线页面加载 | < 1s |
| 年报数据聚合 | < 3s |
| 全量导出 ZIP | < 10s（1000 条记录以内） |
| Tauri 冷启动 | < 2s |
| 自动更新检查 | 非阻塞，后台静默 |

---

## 风险与对策

| 风险 | 影响 | 对策 |
|:---|:---|:---|
| PWA 缓存策略导致旧版本残留 | 用户看不到新功能 | 版本号 + 强制更新机制 |
| 年报查询性能（大量 JOIN） | 加载慢 | 预计算 + 缓存 + 分步加载 |
| Tauri 自动更新被防火墙拦截 | 用户无法更新 | 提供手动下载链接作为 fallback |
| 数据恢复冲突（主键冲突） | 导入失败 | upsert + 时间戳比较 |
