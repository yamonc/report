# 小记 + AI 智能搜索 + 归档 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构知识模块，新增小记功能（快速记录 + AI 语义搜索 + 归档到知识库）

**Architecture:** 后端新增 quick-notes handler + AI SearchQuickNotes 方法；前端 Knowledge 页面拆为双 Tab（小记/知识库），小记 Tab 含快速输入框和 AI 搜索

**Tech Stack:** Go 1.25 + SQLite + React + TypeScript + DeepSeek Chat API

---

### Task 1: 新增 QuickNote 数据模型

**Files:**
- Modify: `backend/models/models.go`

- [ ] **Step 1: 新增 QuickNote + 请求/响应类型**

在 `models.go` 中 `TemplateReq` 后追加：

```go
// ============ Quick Notes ============

type QuickNote struct {
	ID         string    `json:"id"`
	Content    string    `json:"content"`
	Tags       []string  `json:"tags"`
	Source     string    `json:"source"`
	Status     string    `json:"status"`
	ArchivedTo string    `json:"archived_to"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type CreateQuickNoteReq struct {
	Content string   `json:"content"`
	Tags    []string `json:"tags"`
	Source  string   `json:"source"`
}

type UpdateQuickNoteReq struct {
	Content *string   `json:"content,omitempty"`
	Tags    *[]string `json:"tags,omitempty"`
	Source  *string   `json:"source,omitempty"`
}

type SearchQuickNotesReq struct {
	Query string `json:"query"`
}

type SearchResultItem struct {
	ID          string   `json:"id"`
	Content     string   `json:"content"`
	Tags        []string `json:"tags"`
	Score       int      `json:"score"`
	MatchReason string   `json:"match_reason"`
	CreatedAt   string   `json:"created_at"`
}

type ArchiveQuickNoteReq struct {
	Title string   `json:"title"`
	Type  string   `json:"type"`
	Tags  []string `json:"tags"`
}
```

- [ ] **Step 2: 编译验证**

```bash
export GOROOT="C:/Program Files/Go" && cd backend && go build . 2>&1 && echo "OK"
```

Expected: OK (只是加类型，不影响编译)

- [ ] **Step 3: Commit**

```bash
git add backend/models/models.go
git commit -m "feat: 新增 QuickNote 相关数据模型"
```

---

### Task 2: Store 层 — quick_notes 表 + CRUD

**Files:**
- Modify: `backend/store/store.go`

- [ ] **Step 1: 在 createTables 中新增 DDL**

找到 `s.createTables()` 方法，在 methods 调用的 `createTables` 末尾追加 quick_notes 建表语句。先看 `createTables` 在哪里定义，在对应的 SQL 列表里加入：

```sql
CREATE TABLE IF NOT EXISTS quick_notes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    source TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    archived_to TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

由于 `createTables` 是一个私有方法，需要找到它并追加。预期它在 `store.go` 中通过多个 `db.Exec` 调用建表。在最后一个建表语句后（templates 表之后）追加：

```go
db.Exec(`CREATE TABLE IF NOT EXISTS quick_notes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    source TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    archived_to TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)`)
```

- [ ] **Step 2: 新增 ListQuickNotes, GetQuickNote, SaveQuickNote, DeleteQuickNote 方法**

在 store.go 末尾（Templates CRUD 之后）追加：

```go
// ============ Quick Notes ============

func (s *Store) ListQuickNotes(status string) ([]models.QuickNote, error) {
	q := "SELECT id, content, tags, source, status, archived_to, created_at, updated_at FROM quick_notes WHERE 1=1"
	args := []interface{}{}
	if status != "" {
		q += " AND status = ?"
		args = append(args, status)
	}
	q += " ORDER BY created_at DESC"

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.QuickNote, 0)
	for rows.Next() {
		var n models.QuickNote
		var tagsStr, ca, ua string
		if err := rows.Scan(&n.ID, &n.Content, &tagsStr, &n.Source, &n.Status, &n.ArchivedTo, &ca, &ua); err != nil {
			return nil, err
		}
		n.Tags = unmarshalTags(tagsStr)
		n.CreatedAt, _ = parseTime(ca)
		n.UpdatedAt, _ = parseTime(ua)
		result = append(result, n)
	}
	return result, rows.Err()
}

func (s *Store) GetQuickNote(id string) (*models.QuickNote, error) {
	var n models.QuickNote
	var tagsStr, ca, ua string
	err := s.db.QueryRow(
		`SELECT id, content, tags, source, status, archived_to, created_at, updated_at FROM quick_notes WHERE id = ?`, id,
	).Scan(&n.ID, &n.Content, &tagsStr, &n.Source, &n.Status, &n.ArchivedTo, &ca, &ua)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("小记不存在: %s", id)
	}
	if err != nil {
		return nil, err
	}
	n.Tags = unmarshalTags(tagsStr)
	n.CreatedAt, _ = parseTime(ca)
	n.UpdatedAt, _ = parseTime(ua)
	return &n, nil
}

func (s *Store) SaveQuickNote(n models.QuickNote) error {
	now := time.Now()
	existing, err := s.GetQuickNote(n.ID)
	if err == nil {
		n.CreatedAt = existing.CreatedAt
	} else {
		n.CreatedAt = now
	}
	n.UpdatedAt = now

	if n.Tags == nil {
		n.Tags = []string{}
	}

	_, err = s.db.Exec(
		`INSERT OR REPLACE INTO quick_notes (id, content, tags, source, status, archived_to, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		n.ID, n.Content, marshalTags(n.Tags), n.Source, n.Status, n.ArchivedTo,
		formatTime(n.CreatedAt), formatTime(n.UpdatedAt),
	)
	return err
}

func (s *Store) DeleteQuickNote(id string) error {
	result, err := s.db.Exec(`DELETE FROM quick_notes WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("小记不存在: %s", id)
	}
	return nil
}
```

- [ ] **Step 3: 编译验证**

```bash
export GOROOT="C:/Program Files/Go" && cd backend && go build . 2>&1 && echo "OK"
```

- [ ] **Step 4: Commit**

```bash
git add backend/store/store.go
git commit -m "feat: store 层新增 quick_notes 表 + CRUD 方法"
```

---

### Task 3: AI 智能搜索方法

**Files:**
- Modify: `backend/services/ai_service.go`

- [ ] **Step 1: 新增 SearchQuickNotes 方法**

在 `ai_service.go` 末尾追加：

```go
// SearchQuickNotes uses AI to find relevant notes for a query.
func (s *AIService) SearchQuickNotes(query string, notes []models.QuickNote) ([]models.SearchResultItem, error) {
	if len(notes) == 0 {
		return []models.SearchResultItem{}, nil
	}

	var listBuilder strings.Builder
	for _, n := range notes {
		contentPreview := n.Content
		if len(contentPreview) > 200 {
			// Truncate content as UTF-8 safely
			runes := []rune(contentPreview)
			if len(runes) > 200 {
				contentPreview = string(runes[:200]) + "..."
			}
		}
		listBuilder.WriteString(fmt.Sprintf("- [%s] %s\n", n.ID, contentPreview))
	}

	systemPrompt := `你是一个知识检索助手。根据用户查询，从候选小记列表中找出最相关的条目。
返回 JSON 数组（严格按照格式），只包含 score >= 4 的条目（score 1-10）：
[{"id": "note_id", "score": 8, "match_reason": "简短的匹配原因"}]
按 score 降序排列，不超过 10 条。如果没有相关条目返回空数组 []。`

	userPrompt := fmt.Sprintf(`查询：%s

候选小记列表：
%s

请返回 JSON：`, query, listBuilder.String())

	aiContent, err := s.callDeepSeek(systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("AI 搜索失败: %w", err)
	}

	// Parse AI response - find JSON array in the response
	results, err := parseSearchResults(aiContent)
	if err != nil {
		return nil, fmt.Errorf("解析搜索结果失败: %w", err)
	}

	// Enrich results with note content and tags
	for i := range results {
		for _, n := range notes {
			if n.ID == results[i].ID {
				results[i].Content = n.Content
				results[i].Tags = n.Tags
				results[i].CreatedAt = n.CreatedAt.Format(time.RFC3339)
				break
			}
		}
	}

	return results, nil
}

func parseSearchResults(raw string) ([]models.SearchResultItem, error) {
	// Try to find JSON array between [ and ] — handle extra text from LLM
	raw = strings.TrimSpace(raw)
	start := strings.Index(raw, "[")
	end := strings.LastIndex(raw, "]")
	if start == -1 || end == -1 {
		return []models.SearchResultItem{}, nil
	}

	var items []models.SearchResultItem
	if err := json.Unmarshal([]byte(raw[start:end+1]), &items); err != nil {
		return []models.SearchResultItem{}, nil
	}
	return items, nil
}
```

注意：`parseSearchResults` 需要用到 `encoding/json` 和 `strings`，这两个包当前 `ai_service.go` 已经 import 了 `encoding/json` 但用的是 `encoding/json`（通过 `json.Marshal`）。需要确认 `strings` 是否已 import —— 查看当前 imports，`strings` 已存在（用于 `strings.Builder` 和 `strings.Contains` 在 `BuildReminderEmail` 中）。

当前 `callDeepSeek` 中已经在用 `strings.Builder`，所以 `strings` 已 import。

- [ ] **Step 2: 编译验证**

```bash
export GOROOT="C:/Program Files/Go" && cd backend && go build . 2>&1 && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/ai_service.go
git commit -m "feat: 新增 AI 智能小记搜索 SearchQuickNotes 方法"
```

---

### Task 4: Quick Notes Handler (CRUD + 搜索 + 归档)

**Files:**
- Create: `backend/handlers/quick_notes.go`

- [ ] **Step 1: 创建完整 handler 文件**

```go
package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"report/backend/models"
	"report/backend/services"
	"report/backend/store"
)

type QuickNotesHandler struct {
	store  *store.Store
	aiSvc  *services.AIService
}

func NewQuickNotesHandler(s *store.Store, aiSvc *services.AIService) *QuickNotesHandler {
	return &QuickNotesHandler{store: s, aiSvc: aiSvc}
}

func (h *QuickNotesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	path := strings.TrimSuffix(r.URL.Path, "/")

	switch {
	// Search (specific before generic)
	case r.Method == http.MethodPost && strings.HasSuffix(path, "/search"):
		h.search(w, r)

	// Archive
	case r.Method == http.MethodPost && strings.HasSuffix(path, "/archive"):
		h.archive(w, r)

	// List & Create
	case r.Method == http.MethodGet && path == "/api/v1/quick-notes":
		h.list(w, r)
	case r.Method == http.MethodPost && path == "/api/v1/quick-notes":
		h.create(w, r)

	// Get, Update, Delete (by ID)
	case r.Method == http.MethodGet && strings.HasPrefix(path, "/api/v1/quick-notes/"):
		h.get(w, r)
	case r.Method == http.MethodPut && strings.HasPrefix(path, "/api/v1/quick-notes/"):
		h.update(w, r)
	case r.Method == http.MethodDelete && strings.HasPrefix(path, "/api/v1/quick-notes/"):
		h.delete(w, r)

	case r.Method == http.MethodOptions:
		w.WriteHeader(http.StatusOK)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

// --- list ---
func (h *QuickNotesHandler) list(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	items, err := h.store.ListQuickNotes(status)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if items == nil {
		items = []models.QuickNote{}
	}
	writeJSON(w, http.StatusOK, items)
}

// --- get ---
func (h *QuickNotesHandler) get(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/quick-notes/")
	item, err := h.store.GetQuickNote(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, item)
}

// --- create ---
func (h *QuickNotesHandler) create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateQuickNoteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if req.Content == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "内容不能为空"})
		return
	}
	if req.Tags == nil {
		req.Tags = []string{}
	}

	note := models.QuickNote{
		ID:     generateID(),
		Content: req.Content,
		Tags:   req.Tags,
		Source: req.Source,
		Status: "active",
	}
	if err := h.store.SaveQuickNote(note); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetQuickNote(note.ID)
	writeJSON(w, http.StatusCreated, saved)
}

// --- update ---
func (h *QuickNotesHandler) update(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/quick-notes/")
	existing, err := h.store.GetQuickNote(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}

	var req models.UpdateQuickNoteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}

	if req.Content != nil {
		existing.Content = *req.Content
	}
	if req.Tags != nil {
		existing.Tags = *req.Tags
	}
	if req.Source != nil {
		existing.Source = *req.Source
	}

	if err := h.store.SaveQuickNote(*existing); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetQuickNote(id)
	writeJSON(w, http.StatusOK, saved)
}

// --- delete ---
func (h *QuickNotesHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/quick-notes/")
	if err := h.store.DeleteQuickNote(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// --- search (AI powered) ---
func (h *QuickNotesHandler) search(w http.ResponseWriter, r *http.Request) {
	var req models.SearchQuickNotesReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if req.Query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "搜索词不能为空"})
		return
	}

	notes, err := h.store.ListQuickNotes("active")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if len(notes) == 0 {
		writeJSON(w, http.StatusOK, []models.SearchResultItem{})
		return
	}

	results, err := h.aiSvc.SearchQuickNotes(req.Query, notes)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "AI 搜索失败: " + err.Error()})
		return
	}
	if results == nil {
		results = []models.SearchResultItem{}
	}
	writeJSON(w, http.StatusOK, results)
}

// --- archive ---
func (h *QuickNotesHandler) archive(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/quick-notes/")
	// Strip trailing /archive
	id = strings.TrimSuffix(id, "/archive")

	note, err := h.store.GetQuickNote(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	if note.Status == "archived" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "该小记已归档"})
		return
	}

	var req models.ArchiveQuickNoteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Use defaults if body is empty or malformed
		req = models.ArchiveQuickNoteReq{}
	}

	// Auto-generate title from first line if not provided
	title := req.Title
	if title == "" {
		lines := strings.SplitN(note.Content, "\n", 2)
		title = strings.TrimSpace(lines[0])
		if len([]rune(title)) > 80 {
			runes := []rune(title)
			title = string(runes[:80]) + "..."
		}
	}
	if title == "" {
		title = "未命名小记"
	}

	itemType := req.Type
	if itemType == "" {
		itemType = "note"
	}

	tags := req.Tags
	if tags == nil {
		tags = note.Tags
	}
	if tags == nil {
		tags = []string{}
	}

	// Create knowledge item
	knowledgeItem := models.KnowledgeItem{
		ID:        generateID(),
		Title:     title,
		Type:      itemType,
		Content:   note.Content,
		SourceURL: note.Source,
		Tags:      tags,
	}
	if err := h.store.SaveKnowledge(knowledgeItem); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "归档失败: " + err.Error()})
		return
	}

	// Mark note as archived
	note.Status = "archived"
	note.ArchivedTo = knowledgeItem.ID
	if err := h.store.SaveQuickNote(*note); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "更新小记状态失败: " + err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":       "ok",
		"note_id":      note.ID,
		"knowledge_id": knowledgeItem.ID,
	})
}
```

- [ ] **Step 2: 编译验证**

```bash
export GOROOT="C:/Program Files/Go" && cd backend && go build . 2>&1 && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add backend/handlers/quick_notes.go
git commit -m "feat: 新增 QuickNotesHandler (CRUD + AI搜索 + 归档)"
```

---

### Task 5: 注册路由 + 注入依赖

**Files:**
- Modify: `backend/main.go`

- [ ] **Step 1: 新增 quickNotesHandler 并注册路由**

在 `main.go` 中，`templatesHandler := ...` 行后追加：

```go
quickNotesHandler := handlers.NewQuickNotesHandler(s, aiSvc)
```

在路由注册区域（`templates` 路由之后）追加：

```go
mux.Handle("/api/v1/quick-notes", quickNotesHandler)
mux.Handle("/api/v1/quick-notes/", quickNotesHandler)
```

- [ ] **Step 2: 编译验证**

```bash
export GOROOT="C:/Program Files/Go" && cd backend && go build . 2>&1 && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add backend/main.go
git commit -m "feat: 注册 quick-notes 路由并注入 AI 服务"
```

---

### Task 6: 前端类型定义 + API 方法

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 新增前端类型**

在 `types/index.ts` 末尾追加：

```typescript
export interface QuickNote {
  id: string
  content: string
  tags: string[]
  source: string
  status: 'active' | 'archived'
  archived_to: string
  created_at: string
  updated_at: string
}

export interface QuickNoteReq {
  content: string
  tags?: string[]
  source?: string
}

export interface SearchResultItem {
  id: string
  content: string
  tags: string[]
  score: number
  match_reason: string
  created_at: string
}

export interface ArchiveReq {
  title?: string
  type?: string
  tags?: string[]
}
```

- [ ] **Step 2: 更新 api.ts 导入**

将第一行 import 改为：

```typescript
import type { DailyReport, FullSettings, LoginResp, ReminderTask, WeeklyReport, Task, KnowledgeItem, Template, QuickNote, QuickNoteReq, SearchResultItem, ArchiveReq } from '../types'
```

- [ ] **Step 3: 新增 API 方法**

在 `api.ts` 末尾的 `deleteTemplate` 方法后，`}` 闭合前追加：

```typescript
  // Quick Notes
  listQuickNotes(status?: string) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    const qs = params.toString()
    return request<QuickNote[]>(`/quick-notes${qs ? `?${qs}` : ''}`)
  },
  createQuickNote(data: QuickNoteReq) {
    return request<QuickNote>('/quick-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateQuickNote(id: string, data: { content?: string; tags?: string[]; source?: string }) {
    return request<QuickNote>(`/quick-notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  deleteQuickNote(id: string) {
    return request<{ status: string }>(`/quick-notes/${id}`, {
      method: 'DELETE',
    })
  },
  searchQuickNotes(query: string) {
    return request<SearchResultItem[]>('/quick-notes/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
  },
  archiveQuickNote(id: string, data?: ArchiveReq) {
    return request<{ status: string; note_id: string; knowledge_id: string }>(`/quick-notes/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    })
  },
```

- [ ] **Step 4: 类型检查**

```bash
cd frontend && npx tsc --noEmit 2>&1 && echo "OK"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts
git commit -m "feat: 前端新增 QuickNote 类型和 API 方法"
```

---

### Task 7: 新组件 — QuickNoteForm（快速输入模态框）

**Files:**
- Create: `frontend/src/components/QuickNoteForm.tsx`

- [ ] **Step 1: 创建 QuickNoteForm 组件**

```tsx
import { useState } from 'react'

interface QuickNoteFormData {
  content: string
  tags: string
}

interface QuickNoteFormProps {
  initial?: { content: string; tags: string[] }
  saving?: boolean
  onSave: (data: { content: string; tags: string[] }) => void
  onClose: () => void
}

export default function QuickNoteForm({ initial, saving, onSave, onClose }: QuickNoteFormProps) {
  const [content, setContent] = useState(initial?.content || '')
  const [tags, setTags] = useState(initial?.tags?.join(', ') || '')

  const handleSubmit = () => {
    if (!content.trim()) return
    onSave({
      content: content.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-bg-elevated shadow-xl animate-fade-up">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-elevated/95 backdrop-blur-sm px-5 py-3.5 rounded-t-2xl">
          <h2 className="font-serif text-lg font-semibold text-text-primary">
            {initial ? '编辑小记' : '新建小记'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">内容（支持 Markdown）</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="记录碎片想法、排查笔记..."
              rows={10}
              className="w-full rounded-xl border border-border bg-bg-root px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all resize-none font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">标签（逗号分隔）</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例如：SLB, 排查, 重定向"
              className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border-subtle bg-bg-elevated/95 backdrop-blur-sm px-5 py-3.5 rounded-b-2xl">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || saving}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-soft transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npx tsc --noEmit 2>&1 && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/QuickNoteForm.tsx
git commit -m "feat: 新增 QuickNoteForm 组件"
```

---

### Task 8: 新组件 — QuickNoteCard（小记卡片）

**Files:**
- Create: `frontend/src/components/QuickNoteCard.tsx`

- [ ] **Step 1: 创建 QuickNoteCard 组件**

```tsx
import { Archive, Pencil, Trash2 } from 'lucide-react'
import type { QuickNote, SearchResultItem } from '../types'

interface QuickNoteCardProps {
  note: QuickNote
  searchResult?: SearchResultItem  // populated when this card comes from AI search
  onEdit: (note: QuickNote) => void
  onDelete: (id: string) => void
  onArchive: (note: QuickNote) => void
}

export default function QuickNoteCard({ note, searchResult, onEdit, onDelete, onArchive }: QuickNoteCardProps) {
  const contentLines = note.content.split('\n')
  const preview = contentLines.slice(0, 3).join('\n') + (contentLines.length > 3 ? '\n...' : '')

  return (
    <div className="group rounded-xl border border-border bg-bg-elevated p-4 transition-all duration-200 hover:shadow-sm hover:border-border-visible animate-fade-up">
      {/* Content preview */}
      <div className="min-w-0">
        {searchResult?.match_reason && (
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-0.5 text-[11px] text-accent">
            匹配: {searchResult.match_reason} · 相关度 {searchResult.score}/10
          </div>
        )}
        <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
          {preview}
        </p>
      </div>

      {/* Tags + Actions */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {note.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-md bg-bg-hover px-2 py-0.5 text-[11px] text-text-tertiary">
              {tag}
            </span>
          ))}
          <span className="text-[11px] text-text-tertiary ml-1">
            {new Date(note.created_at).toLocaleDateString('zh-CN')}
          </span>
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={() => onArchive(note)}
            className="rounded-lg p-1.5 text-text-tertiary hover:text-accent hover:bg-accent-subtle transition-all"
            title="归档到知识库"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEdit(note)}
            className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="rounded-lg p-1.5 text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npx tsc --noEmit 2>&1 && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/QuickNoteCard.tsx
git commit -m "feat: 新增 QuickNoteCard 组件"
```

---

### Task 9: 重构 Knowledge 页面 — 双 Tab 布局

**Files:**
- Modify: `frontend/src/pages/Knowledge.tsx`

这是最大的改动，将现有 Knowledge 页面重构为双 Tab。

- [ ] **Step 1: 重写 imports**

```tsx
import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Trash2, Link, Code, FileText, Tag, Archive, Sparkles, Loader2, PenSquare } from 'lucide-react'
import { api } from '../lib/api'
import MarkdownEditor from '../components/MarkdownEditor'
import MarkdownPreview from '../components/MarkdownPreview'
import QuickNoteCard from '../components/QuickNoteCard'
import QuickNoteForm from '../components/QuickNoteForm'
import { useToast } from '../components/Toast'
import type { KnowledgeItem, QuickNote, SearchResultItem, ArchiveReq } from '../types'
```

- [ ] **Step 2: 保留现有常量和类型**

```tsx
const TYPES = [
  { key: 'note', label: '笔记', icon: FileText },
  { key: 'link', label: '链接', icon: Link },
  { key: 'snippet', label: '代码', icon: Code },
] as const

interface KnowledgeFormData {
  title: string
  type: KnowledgeItem['type']
  content: string
  source_url: string
  tags: string
}

const emptyKnowledgeForm: KnowledgeFormData = {
  title: '',
  type: 'note',
  content: '',
  source_url: '',
  tags: '',
}
```

- [ ] **Step 3: 重写组件主函数**

```tsx
type Tab = 'quick-notes' | 'knowledge'

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<Tab>('quick-notes')

  // ===== Quick Notes state =====
  const [notes, setNotes] = useState<QuickNote[]>([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [notesForm, setNotesForm] = useState<QuickNote | null>(null)
  const [showNotesForm, setShowNotesForm] = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)

  // Quick note fast input
  const [fastInput, setFastInput] = useState('')

  // AI Search
  const [aiQuery, setAiQuery] = useState('')
  const [aiSearching, setAiSearching] = useState(false)
  const [aiResults, setAiResults] = useState<SearchResultItem[] | null>(null)

  // Archive
  const [archiving, setArchiving] = useState(false)

  // ===== Knowledge state =====
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([])
  const [knowledgeLoading, setKnowledgeLoading] = useState(true)
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false)
  const [editingKnowledge, setEditingKnowledge] = useState<KnowledgeItem | null>(null)
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormData>(emptyKnowledgeForm)
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Knowledge filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const toast = useToast()

  // Load notes
  const loadNotes = useCallback(async () => {
    try {
      const data = await api.listQuickNotes('active')
      setNotes(data || [])
    } catch { /* ignore */ } finally { setNotesLoading(false) }
  }, [])

  // Load knowledge
  const loadKnowledge = useCallback(async (params?: { search?: string; type?: string; tag?: string }) => {
    try {
      const data = await api.listKnowledge(params)
      setKnowledgeItems(data || [])
    } catch { /* ignore */ } finally { setKnowledgeLoading(false) }
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])
  useEffect(() => { loadKnowledge() }, [loadKnowledge])

  // ===== Quick Note actions =====
  const handleFastSave = async () => {
    if (!fastInput.trim()) return
    try {
      await api.createQuickNote({ content: fastInput.trim() })
      setFastInput('')
      loadNotes()
    } catch {
      toast.error('保存失败')
    }
  }

  const handleNoteSave = async (data: { content: string; tags: string[] }) => {
    setNotesSaving(true)
    try {
      if (notesForm) {
        await api.updateQuickNote(notesForm.id, data)
      } else {
        await api.createQuickNote(data)
      }
      setShowNotesForm(false)
      setNotesForm(null)
      loadNotes()
    } catch {
      toast.error('保存失败')
    } finally {
      setNotesSaving(false)
    }
  }

  const handleDeleteNote = async (id: string) => {
    const ok = await toast.confirm('确定删除该小记？')
    if (!ok) return
    try {
      await api.deleteQuickNote(id)
      loadNotes()
    } catch {
      toast.error('删除失败')
    }
  }

  const handleAISearch = async () => {
    if (!aiQuery.trim()) return
    setAiSearching(true)
    setAiResults(null)
    try {
      const data = await api.searchQuickNotes(aiQuery.trim())
      setAiResults(data)
      if (data.length === 0) {
        toast.error('未找到匹配的小记')
      }
    } catch (err: any) {
      toast.error(err.message || '搜索失败')
    } finally {
      setAiSearching(false)
    }
  }

  const handleArchive = async (note: QuickNote) => {
    setArchiving(true)
    try {
      // Default: use first line as title
      const firstLine = note.content.split('\n')[0].trim().substring(0, 80) || '未命名'
      await api.archiveQuickNote(note.id, { title: firstLine })
      toast.success(`「${firstLine}」已归档到知识库`)
      loadNotes()
      loadKnowledge()
    } catch (err: any) {
      toast.error(err.message || '归档失败')
    } finally {
      setArchiving(false)
    }
  }

  // ===== Knowledge actions =====
  const openCreateKnowledge = () => {
    setEditingKnowledge(null)
    setKnowledgeForm(emptyKnowledgeForm)
    setShowKnowledgeModal(true)
  }

  const openEditKnowledge = (item: KnowledgeItem) => {
    setEditingKnowledge(item)
    setKnowledgeForm({
      title: item.title,
      type: item.type,
      content: item.content,
      source_url: item.source_url,
      tags: item.tags.join(', '),
    })
    setShowKnowledgeModal(true)
  }

  const closeKnowledgeModal = () => {
    setShowKnowledgeModal(false)
    setEditingKnowledge(null)
    setKnowledgeForm(emptyKnowledgeForm)
    setPreviewId(null)
  }

  const handleKnowledgeSubmit = async () => {
    if (!knowledgeForm.title.trim()) return
    const payload = {
      ...knowledgeForm,
      tags: knowledgeForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }
    if (editingKnowledge) {
      await api.updateKnowledge(editingKnowledge.id, payload)
    } else {
      await api.createKnowledge(payload)
    }
    closeKnowledgeModal()
    loadKnowledge()
  }

  const handleDeleteKnowledge = async (id: string) => {
    const ok = await toast.confirm('确定删除该知识片段？')
    if (!ok) return
    await api.deleteKnowledge(id)
    loadKnowledge()
  }

  // ===== Shared helpers =====
  const typeIcon = (t: string) => {
    const def = TYPES.find((x) => x.key === t)
    if (!def) return <FileText className="h-4 w-4 text-text-tertiary" />
    const Icon = def.icon
    return <Icon className="h-4 w-4 text-text-tertiary" />
  }

  const allTags = [...new Set(knowledgeItems.flatMap((item) => item.tags))].sort()

  // Knowledge: Search handler
  const handleKnowledgeSearch = () => {
    setKnowledgeLoading(true)
    loadKnowledge({
      search: search || undefined,
      type: typeFilter || undefined,
      tag: tagFilter || undefined,
    })
  }

  // ===== RENDER =====
  return (
    <div className="space-y-8">
      {/* Header + Tabs */}
      <div className="animate-fade-up">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">知识管理</h1>
        </div>

        {/* Tab switcher */}
        <div className="mt-4 inline-flex rounded-xl border border-border p-1 bg-bg-elevated">
          <button
            onClick={() => setActiveTab('quick-notes')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'quick-notes'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <PenSquare className="h-4 w-4" />
            小记
            {notes.length > 0 && (
              <span className={`text-xs ${activeTab === 'quick-notes' ? 'text-white/70' : 'text-text-tertiary'}`}>
                {notes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'knowledge'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText className="h-4 w-4" />
            知识库
          </button>
        </div>
      </div>

      {/* ===== QUICK NOTES TAB ===== */}
      {activeTab === 'quick-notes' && (
        <div className="space-y-6">
          {/* AI Search bar */}
          <div className="animate-fade-up stagger-1">
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
                  placeholder="AI 智能搜索，输入自然语言查找相关小记..."
                  className="w-full rounded-xl border border-accent/20 bg-bg-elevated pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-accent transition-all"
                />
              </div>
              <button
                onClick={handleAISearch}
                disabled={aiSearching || !aiQuery.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-soft transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {aiSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {aiSearching ? '搜索中...' : 'AI 搜索'}
              </button>
            </div>

            {/* AI results */}
            {aiResults !== null && aiResults.length > 0 && (
              <div className="mt-3 mb-1 text-xs text-text-tertiary">
                AI 找到 {aiResults.length} 条相关小记
                <button onClick={() => { setAiResults(null); setAiQuery('') }} className="ml-2 text-accent hover:underline">清除</button>
              </div>
            )}
          </div>

          {/* Fast input */}
          <div className="animate-fade-up stagger-1">
            <div className="flex gap-2 items-start">
              <textarea
                value={fastInput}
                onChange={(e) => setFastInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                    e.preventDefault()
                    handleFastSave()
                  }
                }}
                placeholder="快速记录...（Enter 保存，Ctrl+Enter 换行）"
                rows={2}
                className="flex-1 rounded-xl border border-border bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all resize-none"
              />
              <button
                onClick={() => setShowNotesForm(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                title="打开完整编辑器"
              >
                <Plus className="h-4 w-4" />
                新建
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notesLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-32 rounded-xl" />
              ))}
            </div>
          ) : (aiResults !== null ? aiResults : notes.filter(n => n.status === 'active')).length === 0 ? (
            <div className="py-16 text-center animate-fade-up">
              <PenSquare className="h-10 w-10 text-text-tertiary/40 mx-auto mb-3" />
              <p className="text-text-tertiary text-sm">
                {aiResults !== null ? 'AI 未找到匹配的小记' : '暂无小记，在上方输入框快速记录'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(aiResults !== null
                ? aiResults.map((r) => {
                    const note = notes.find((n) => n.id === r.id)
                    if (!note) return null
                    return (
                      <div key={r.id} className="animate-fade-up">
                        <QuickNoteCard
                          note={note}
                          searchResult={r}
                          onEdit={(n) => { setNotesForm(n); setShowNotesForm(true) }}
                          onDelete={handleDeleteNote}
                          onArchive={handleArchive}
                        />
                      </div>
                    )
                  }).filter(Boolean)
                : notes.filter(n => n.status === 'active').map((note, i) => (
                    <div key={note.id} className={`animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
                      <QuickNoteCard
                        note={note}
                        onEdit={(n) => { setNotesForm(n); setShowNotesForm(true) }}
                        onDelete={handleDeleteNote}
                        onArchive={handleArchive}
                      />
                    </div>
                  ))
              )}
            </div>
          )}

          {/* QuickNote form modal */}
          {showNotesForm && (
            <QuickNoteForm
              initial={notesForm ? { content: notesForm.content, tags: notesForm.tags } : undefined}
              saving={notesSaving}
              onSave={handleNoteSave}
              onClose={() => { setShowNotesForm(false); setNotesForm(null) }}
            />
          )}
        </div>
      )}

      {/* ===== KNOWLEDGE TAB ===== */}
      {activeTab === 'knowledge' && (
        <div className="space-y-8">
          {/* Header */}
          <div className="animate-fade-up flex items-center justify-between">
            <p className="text-sm text-text-secondary">{knowledgeItems.length} 条记录</p>
            <button
              onClick={openCreateKnowledge}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-accent-soft"
            >
              <Plus className="h-4 w-4" />
              新建片段
            </button>
          </div>

          {/* Search / Filters */}
          <div className="animate-fade-up stagger-1 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleKnowledgeSearch()}
                placeholder="搜索标题或内容..."
                className="w-full rounded-xl border border-border bg-bg-elevated pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                loadKnowledge({ search: search || undefined, type: e.target.value || undefined, tag: tagFilter || undefined })
              }}
              className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-text-primary focus:border-border-focus transition-all"
            >
              <option value="">所有类型</option>
              {TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="h-3.5 w-3.5 text-text-tertiary" />
                <button
                  onClick={() => { setTagFilter(''); loadKnowledge({ search: search || undefined, type: typeFilter || undefined }) }}
                  className={`rounded-lg px-2.5 py-1 text-xs transition-all ${tagFilter === '' ? 'bg-accent-subtle text-accent font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}
                >
                  全部
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => { setTagFilter(tag); loadKnowledge({ search: search || undefined, type: typeFilter || undefined, tag }) }}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-all ${tagFilter === tag ? 'bg-accent-subtle text-accent font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Knowledge list */}
          {knowledgeLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-32 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {knowledgeItems.map((item, i) => (
                <div
                  key={item.id}
                  onClick={() => openEditKnowledge(item)}
                  className={`group animate-fade-up stagger-${Math.min(i + 1, 6)} cursor-pointer rounded-xl border border-border bg-bg-elevated p-5 transition-all duration-200 hover:shadow-sm hover:border-border-visible`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {typeIcon(item.type)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-text-primary leading-snug truncate">{item.title}</h3>
                        {item.source_url && (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-accent hover:underline truncate block mt-0.5"
                          >
                            {item.source_url}
                          </a>
                        )}
                        {item.content && (
                          <p className="mt-1.5 text-xs text-text-tertiary line-clamp-2 leading-relaxed">
                            {item.content.replace(/[#*`>\[\]()\n]/g, ' ').substring(0, 120)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteKnowledge(item.id) }}
                      className="shrink-0 p-1 rounded-md text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {item.tags.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-md bg-bg-hover px-2 py-0.5 text-[11px] text-text-tertiary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 text-[11px] text-text-tertiary">
                    {new Date(item.created_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              ))}
              {knowledgeItems.length === 0 && (
                <div className="col-span-full py-16 text-center">
                  <p className="text-text-tertiary text-sm">暂无知识片段</p>
                  <button
                    onClick={openCreateKnowledge}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-soft transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    创建第一条知识
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Knowledge modal */}
          {showKnowledgeModal && (
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-black/20 backdrop-blur-sm">
              <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-bg-elevated shadow-xl animate-fade-up">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-elevated/95 backdrop-blur-sm px-6 py-4 rounded-t-2xl">
                  <h2 className="font-serif text-lg font-semibold text-text-primary">
                    {editingKnowledge ? '编辑知识' : '新建知识'}
                  </h2>
                  <button onClick={closeKnowledgeModal} className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all">
                    <span className="text-lg leading-none">&times;</span>
                  </button>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">标题</label>
                    <input
                      type="text"
                      value={knowledgeForm.title}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                      placeholder="知识标题"
                      className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">类型</label>
                      <div className="flex gap-1.5">
                        {TYPES.map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => setKnowledgeForm({ ...knowledgeForm, type: t.key })}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                              knowledgeForm.type === t.key
                                ? 'bg-accent-subtle text-accent border border-accent/20'
                                : 'border border-border text-text-tertiary hover:text-text-secondary hover:border-border-visible'
                            }`}
                          >
                            <t.icon className="h-3.5 w-3.5" />
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">来源链接（可选）</label>
                      <input
                        type="url"
                        value={knowledgeForm.source_url}
                        onChange={(e) => setKnowledgeForm({ ...knowledgeForm, source_url: e.target.value })}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">标签（逗号分隔）</label>
                    <input
                      type="text"
                      value={knowledgeForm.tags}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, tags: e.target.value })}
                      placeholder="例如：Go, React, 最佳实践"
                      className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-text-secondary">内容</label>
                      <button
                        type="button"
                        onClick={() => setPreviewId(previewId ? null : 'form')}
                        className="text-xs text-accent hover:text-accent-soft transition-colors"
                      >
                        {previewId === 'form' ? '编辑' : '预览'}
                      </button>
                    </div>
                    {previewId === 'form' ? (
                      <div className="rounded-xl border border-border bg-bg-elevated p-4 min-h-[200px]">
                        <MarkdownPreview content={knowledgeForm.content || '*暂无内容*'} />
                      </div>
                    ) : (
                      <MarkdownEditor
                        value={knowledgeForm.content}
                        onChange={(v) => setKnowledgeForm({ ...knowledgeForm, content: v })}
                        placeholder="内容（支持 Markdown）"
                        minHeight="200px"
                      />
                    )}
                  </div>
                </div>
                <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border-subtle bg-bg-elevated/95 backdrop-blur-sm px-6 py-4 rounded-b-2xl">
                  <button
                    onClick={closeKnowledgeModal}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleKnowledgeSubmit}
                    disabled={!knowledgeForm.title.trim()}
                    className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-soft transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {editingKnowledge ? '保存' : '创建'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

```bash
cd frontend && npx tsc --noEmit 2>&1 && echo "OK"
```

Expected: OK

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Knowledge.tsx
git commit -m "feat: 重构知识页面为双Tab（小记+知识库），集成AI搜索+归档"
```

---

### Task 10: 后端编译 + 启动验证

- [ ] **Step 1: 编译后端**

```bash
export GOROOT="C:/Program Files/Go" && cd backend && go build . 2>&1 && echo "OK"
```

- [ ] **Step 2: 编译前端**

```bash
cd frontend && npx tsc --noEmit 2>&1 && echo "OK"
```

- [ ] **Step 3: 启动后端验证无启动错误**

```bash
export GOROOT="C:/Program Files/Go" && cd backend && timeout 5 go run . 2>&1 || true
```

Expected: 看到 "Server starting on http://127.0.0.1:8080"

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: 最终编译验证通过" --allow-empty
```

---

## 验证方案

1. 启动前后端: `go run .` + `npm run dev`
2. 打开 http://localhost:5173 → 知识页面
3. **小记 Tab**:
   - 快速输入框回车保存 → 卡片出现
   - 点"新建"按钮打开完整编辑器（Markdown + 标签）
   - 编辑 / 删除 / 归档 按钮 hover 显示
   - 归档卡片 → toast 提示成功 → 知识库 Tab 出现对应条目
4. **AI 搜索**:
   - 先创建 3-5 条不同主题的小记
   - AI 搜索框输入查询 → "搜索中..." → 结果卡片显示 match_reason + score
5. **知识库 Tab**: 现有功能保持不变（CRUD + 筛选）

---

## 文件清单

| 文件 | 操作 |
|------|------|
| `backend/models/models.go` | 新增 QuickNote 相关类型 |
| `backend/store/store.go` | 新增 quick_notes DDL + CRUD |
| `backend/services/ai_service.go` | 新增 SearchQuickNotes + parseSearchResults |
| `backend/handlers/quick_notes.go` | **新建** — 完整 handler |
| `backend/main.go` | 注册 quick-notes 路由 |
| `frontend/src/types/index.ts` | 新增 QuickNote 等前端类型 |
| `frontend/src/lib/api.ts` | 新增 quick-notes API 方法 |
| `frontend/src/components/QuickNoteForm.tsx` | **新建** — 编辑模态框 |
| `frontend/src/components/QuickNoteCard.tsx` | **新建** — 小记卡片 |
| `frontend/src/pages/Knowledge.tsx` | 重构为双 Tab |
