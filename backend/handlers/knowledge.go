package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"report/backend/models"
	"report/backend/store"
)

type KnowledgeHandler struct {
	store *store.Store
}

func NewKnowledgeHandler(s *store.Store) *KnowledgeHandler {
	return &KnowledgeHandler{store: s}
}

func (h *KnowledgeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	path := strings.TrimSuffix(r.URL.Path, "/")

	switch {
	case r.Method == http.MethodGet && path == "/api/v1/knowledge":
		h.list(w, r)
	case r.Method == http.MethodPost && path == "/api/v1/knowledge":
		h.create(w, r)
	case r.Method == http.MethodGet && strings.HasPrefix(path, "/api/v1/knowledge/"):
		h.get(w, r)
	case r.Method == http.MethodPut && strings.HasPrefix(path, "/api/v1/knowledge/"):
		h.update(w, r)
	case r.Method == http.MethodDelete && strings.HasPrefix(path, "/api/v1/knowledge/"):
		h.delete(w, r)
	case r.Method == http.MethodOptions:
		w.WriteHeader(http.StatusOK)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *KnowledgeHandler) list(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	itemType := r.URL.Query().Get("type")
	tag := r.URL.Query().Get("tag")
	items, err := h.store.ListKnowledge(search, itemType, tag)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if items == nil {
		items = []models.KnowledgeItem{}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *KnowledgeHandler) get(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/knowledge/")
	item, err := h.store.GetKnowledge(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "知识片段不存在"})
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *KnowledgeHandler) create(w http.ResponseWriter, r *http.Request) {
	var req models.KnowledgeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if req.Title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "标题不能为空"})
		return
	}
	if req.Type == "" {
		req.Type = "note"
	}
	if req.Tags == nil {
		req.Tags = []string{}
	}

	item := models.KnowledgeItem{
		ID:        generateID(),
		Title:     req.Title,
		Type:      req.Type,
		Content:   req.Content,
		SourceURL: req.SourceURL,
		Tags:      req.Tags,
	}
	if err := h.store.SaveKnowledge(item); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetKnowledge(item.ID)
	writeJSON(w, http.StatusCreated, saved)
}

func (h *KnowledgeHandler) update(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/knowledge/")

	existing, err := h.store.GetKnowledge(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "知识片段不存在"})
		return
	}

	var req models.KnowledgeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}

	if req.Title != "" {
		existing.Title = req.Title
	}
	existing.Content = req.Content
	if req.Type != "" {
		existing.Type = req.Type
	}
	existing.SourceURL = req.SourceURL
	if req.Tags != nil {
		existing.Tags = req.Tags
	}

	if err := h.store.SaveKnowledge(*existing); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetKnowledge(id)
	writeJSON(w, http.StatusOK, saved)
}

func (h *KnowledgeHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/knowledge/")
	if err := h.store.DeleteKnowledge(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
