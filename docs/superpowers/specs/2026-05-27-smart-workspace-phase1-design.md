# 智能工作台 Phase 1 — 设计说明书

**日期**: 2026-05-27  
**状态**: Approved

---

## 1. 概述

将当前日报/周报系统扩展为"智能工作台"，新增任务清单和知识片段两个模块，同时升级导航和仪表盘。

**目标用户**：个人使用，单用户，数据结构简单。

**Phase 1 范围**：
- 侧边栏导航改造
- 仪表盘从 2 卡片升级到 4 卡片
- 新增任务清单模块（看板 + CRUD）
- 新增知识片段模块（笔记/链接/代码 + 标签检索）

---

## 2. 架构

```
Browser
  │
  ▼
Nginx (127.0.0.1:80)
  ├── /api/* → Go backend (127.0.0.1:8080)
  └── /*      → React SPA
       │
       ▼
Go Backend (net/http + custom mux)
  ├── middleware (CORS → JWT Auth → handler)
  ├── handlers/ (daily_report, weekly_report, tasks, knowledge, settings, auth, reminders)
  ├── store/    (JSON file read/write, sync.Mutex guarded)
  └── services/ (AI, email, scheduler)
       │
       ▼
/data (JSON files)
  ├── daily_reports.json   [已有]
  ├── weekly_reports.json  [已有]
  ├── users.json           [已有]
  ├── reminders.json       [已有]
  ├── settings.json        [已有]
  ├── tasks.json           [新增]
  └── knowledge.json       [新增]
```

**不变**：Go `net/http` + 自定义 ServeMux、JSON 文件存储、JWT 认证、Docker Compose 部署。

---

## 3. 前端导航改造

### 3.1 Layout 组件改造

当前 `Layout.tsx` 为顶部导航栏。改造为左侧固定侧边栏布局：

```
┌──────────┬────────────────────────────┐
│ Sidebar  │ Main Content               │
│ 200px    │ flex: 1                    │
│          │                            │
│ 🏠 工作台 │                            │
│ ─────────│                            │
│ 📊 仪表盘 │                            │
│ 📝 日报  │  <Outlet />                │
│ 📄 周报  │                            │
│ ✅ 任务  │                            │
│ 📌 知识  │                            │
│ ─────────│                            │
│ ⚙️ 设置  │                            │
│ user@..  │                            │
└──────────┴────────────────────────────┘
```

- 侧边栏固定 200px 宽度
- 当前活跃路由高亮（`accent` 色背景）
- 底部显示当前用户邮箱
- 移动端可折叠（后续迭代）

### 3.2 路由表

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | Dashboard | 仪表盘，重定向到 `/dashboard` |
| `/dashboard` | Dashboard | 升级版 4 卡片 |
| `/daily` | DailyReport | 已有 |
| `/weekly` | WeeklyReport | 已有 |
| `/tasks` | Tasks | 新增 |
| `/knowledge` | Knowledge | 新增 |
| `/settings` | Settings | 已有 |

---

## 4. 仪表盘升级

从当前 2 卡片（日报、周报）扩展为 4 卡片网格：

```
┌─────────────────┬─────────────────┐
│ 📝 今日日报      │ 📄 本周周报      │
│ 已填写 / 去填写  │ AI 生成 / 待确认 │
├─────────────────┼─────────────────┤
│ ✅ 任务概览      │ 📌 最近收藏      │
│ 待处理 N 个      │ M 条知识片段     │
└─────────────────┴─────────────────┘
```

- 任务卡片显示：待处理数 / 进行中数 / 今日到期数
- 知识卡片显示：最近添加的 3 条
- 点击卡片跳转到对应模块

---

## 5. 任务清单模块

### 5.1 数据模型

```go
type Task struct {
    ID          string    `json:"id"`
    Title       string    `json:"title"`
    Description string    `json:"description"`
    Status      string    `json:"status"`     // "todo" | "doing" | "done"
    Priority    string    `json:"priority"`   // "high" | "medium" | "low"
    Category    string    `json:"category"`   // "开发" | "设计" | "文档" | "其他"
    DueDate     string    `json:"due_date"`   // "2006-01-02"
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}
```

存储文件：`tasks.json`

### 5.2 API

```
GET    /api/v1/tasks          — 列表，支持 ?status=&category=&priority=
POST   /api/v1/tasks          — 创建
GET    /api/v1/tasks/{id}     — 获取详情
PUT    /api/v1/tasks/{id}     — 完整更新
PATCH  /api/v1/tasks/{id}/status  — 快速切换状态 {"status":"doing"}
DELETE /api/v1/tasks/{id}     — 删除
```

### 5.3 UI

- **主视图**：三列看板（待处理 / 进行中 / 已完成）
- **卡片**：标题 + 优先级色标 + 截止日期
- **新建/编辑**：弹窗模式，含标题、描述(Markdown)、优先级、分类、截止日期
- **快捷操作**：卡片右键或点击状态图标切换列
- 复用现有 `MarkdownEditor` 组件

---

## 6. 知识片段模块

### 6.1 数据模型

```go
type KnowledgeItem struct {
    ID        string    `json:"id"`
    Title     string    `json:"title"`
    Type      string    `json:"type"`       // "note" | "link" | "snippet"
    Content   string    `json:"content"`    // Markdown
    SourceURL string    `json:"source_url"` // 可选
    Tags      []string  `json:"tags"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

存储文件：`knowledge.json`

### 6.2 API

```
GET    /api/v1/knowledge      — 列表，支持 ?search=&type=&tag=
POST   /api/v1/knowledge      — 创建
GET    /api/v1/knowledge/{id} — 获取详情
PUT    /api/v1/knowledge/{id} — 更新
DELETE /api/v1/knowledge/{id} — 删除
```

### 6.3 UI

- **列表视图**：搜索框 + 类型筛选 + 标签过滤
- **卡片条目**：标题 + 类型图标(📝/🔗/💻) + 时间 + 标签
- **新建/编辑**：弹窗模式，类型选择、标题、可选来源URL、标签管理、Markdown 内容
- 复用现有 `MarkdownEditor` + `MarkdownPreview` 组件

---

## 7. 实现步骤

1. **后端：扩展数据模型** — `models.go` 添加 Task、KnowledgeItem 结构
2. **后端：扩展 Store** — `store.go` 添加 tasks 和 knowledge 的 CRUD 方法
3. **后端：新增 Handler** — `handlers/tasks.go`、`handlers/knowledge.go`
4. **后端：注册路由** — `main.go` 添加新路由
5. **前端：改造 Layout** — 侧边栏导航替换顶栏
6. **前端：升级 Dashboard** — 4 卡片布局
7. **前端：Tasks 页面** — 看板 + CRUD 弹窗
8. **前端：Knowledge 页面** — 列表 + CRUD 弹窗
9. **前端：types 扩展** — 添加 Task、KnowledgeItem 类型和 API 方法

---

## 8. 不纳入 Phase 1

- 会议纪要（使用频率低，按需再加）
- 拖拽排序（看板卡片拖拽切换状态）
- 数据统计图表
- 多用户/权限系统
- 数据导出

---

## 9. 不变项

- Go `net/http` + 自定义 ServeMux（不引入 Gin/Chi）
- JSON 文件存储（不引入 SQLite）
- JWT 单用户认证机制
- Tailwind CSS + 自定义主题色
- Docker Compose `network_mode: host` 部署
