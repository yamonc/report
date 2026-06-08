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
	store *store.Store
	aiSvc *services.AIService
}

func NewQuickNotesHandler(s *store.Store, aiSvc *services.AIService) *QuickNotesHandler {
	return &QuickNotesHandler{store: s, aiSvc: aiSvc}
}

func (h *QuickNotesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	path := strings.TrimSuffix(r.URL.Path, "/")

	switch {
	// Search (specific before generic to avoid ID extraction matching "search" as ID)
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
		ID:      generateID(),
		Content: req.Content,
		Tags:    req.Tags,
		Source:  req.Source,
		Status:  "active",
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
	var req models.SearchQuickNoteReq
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
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
	if r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
			return
		}
	}

	// Auto-generate title from first line if not provided
	title := req.Title
	if title == "" {
		lines := strings.SplitN(note.Content, "\n", 2)
		title = strings.TrimSpace(lines[0])
		runes := []rune(title)
		if len(runes) > 80 {
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
