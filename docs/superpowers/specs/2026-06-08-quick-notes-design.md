# 小记 + AI 智能搜索 + 归档 设计规格

日期: 2026-06-08

## 概述

重构"知识"模块，新增"小记"功能。小记用于快速记录碎片化内容（类似语雀小记），支持 AI 智能语义搜索，并可将小记手动归档到知识库。

## 数据模型

### 新增表: quick_notes

```sql
CREATE TABLE IF NOT EXISTS quick_notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  source TEXT DEFAULT '',
  status TEXT DEFAULT 'active',    -- active | archived
  archived_to TEXT DEFAULT '',     -- 归档目标 knowledge_items.id
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 新增 Go 类型

```go
type QuickNote struct {
  ID         string   `json:"id"`
  Content    string   `json:"content"`
  Tags       []string `json:"tags"`
  Source     string   `json:"source"`
  Status     string   `json:"status"`
  ArchivedTo string   `json:"archived_to"`
  CreatedAt  time.Time `json:"created_at"`
  UpdatedAt  time.Time `json:"updated_at"`
}

type CreateQuickNoteReq struct {
  Content string   `json:"content"`
  Tags    []string `json:"tags"`
  Source  string   `json:"source"`
}

type SearchQuickNotesReq struct {
  Query string `json:"query"`
}

type SearchResultItem struct {
  ID          string  `json:"id"`
  Content     string  `json:"content"`
  Tags        []string `json:"tags"`
  Score       int     `json:"score"`
  MatchReason string  `json:"match_reason"`
  CreatedAt   string  `json:"created_at"`
}
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/quick-notes` | 列表，`?status=active` 或 `archived` |
| POST | `/api/v1/quick-notes` | 创建小记 |
| PUT | `/api/v1/quick-notes/:id` | 编辑小记 |
| DELETE | `/api/v1/quick-notes/:id` | 删除小记 |
| POST | `/api/v1/quick-notes/search` | AI 语义搜索，body: `{query}` |
| POST | `/api/v1/quick-notes/:id/archive` | 归档，body 可选 `{title, type, tags}` |

### 搜索流程

1. 用户输入自然语言查询
2. 后端列出所有 status=active 的小记
3. 将查询 + 小记列表拼成 prompt，调用 DeepSeek chat
4. AI 返回匹配条目（id, score 1-10, match_reason）
5. 按 score 降序排列返回前端

### 归档流程

1. 用户在小记卡片点击"归档"
2. 前端弹出确认框，可编辑标题/类型（预填第一行作为标题）
3. 后端调用 `SaveKnowledge` 创建知识条目
4. 更新小记：status=archived, archived_to=知识条目 ID

## 前端设计

### 双 Tab 布局

Knowledge 页面拆分为两个 Tab：
- **小记** (QuickNotes) — 新增内容
- **知识库** (Knowledge) — 现有功能保留

### 小记 Tab 组件树

```
QuickNotesTab
  ├── AI搜索框 — placeholder: "AI 智能搜索，支持语义匹配..."
  │   └── 搜索结果以高亮卡片形式展示（含 match_reason）
  ├── 快速输入框 — 单行 textarea, Enter 发送，Ctrl+Enter 换行
  │   └── 点击展开完整编辑模态框（Markdown + 标签）
  └── 小记卡片列表
      └── QuickNoteCard
          ├── 内容摘要（前 3 行）
          ├── 标签
          ├── 时间
          └── [归档] 按钮 → 弹出归档确认 → 跳转知识库 Tab
```

### 文件改动

| 文件 | 操作 |
|------|------|
| `backend/models/models.go` | 新增 QuickNote 相关类型 |
| `backend/store/store.go` | 新增 quick_notes DDL + CRUD 方法 |
| `backend/handlers/quick_notes.go` | 新建，完整 handler（CRUD + search + archive） |
| `backend/services/ai_service.go` | 新增 `SearchQuickNotes` 方法 |
| `backend/main.go` | 注册 quick-notes 路由 |
| `frontend/src/types/index.ts` | 新增 QuickNote、SearchResultItem 类型 |
| `frontend/src/lib/api.ts` | 新增 quickNotes CRUD + search + archive |
| `frontend/src/pages/Knowledge.tsx` | 重构为双 Tab 页面 |
| `frontend/src/components/QuickNoteCard.tsx` | 新建，小记卡片 |
| `frontend/src/components/QuickNoteForm.tsx` | 新建，小记编辑模态框 |

## AI 搜索 Prompt 设计

```
System: 你是一个知识检索助手。根据用户查询，从候选小记列表中找出最相关的条目。

User: 查询：「{query}」
候选小记列表：
[{id}: {content[:200]}]

请返回 JSON 数组，只包含 score >= 4 的条目（score 1-10）：
[{"id": "...", "score": 8, "match_reason": "包含 SLB 重定向配置相关步骤"}]

按 score 降序排列，不超过 10 条。如果没有相关条目返回空数组 []。
```

## 验证

1. 启动前后端，进入知识页面
2. 创建几张小记（不同主题）
3. 在 AI 搜索框输入语义查询 → 验证匹配结果
4. 点击归档 → 验证知识库 tab 中出现对应条目，小记状态变为 archived
5. `?status=archived` 查询已归档小记
