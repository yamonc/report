package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"report/backend/models"
	"report/backend/store"
)

type TemplatesHandler struct {
	store *store.Store
}

func NewTemplatesHandler(s *store.Store) *TemplatesHandler {
	return &TemplatesHandler{store: s}
}

func (h *TemplatesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	path := strings.TrimSuffix(r.URL.Path, "/")

	switch {
	case r.Method == http.MethodGet && path == "/api/v1/templates":
		h.list(w, r)
	case r.Method == http.MethodPost && path == "/api/v1/templates":
		h.create(w, r)
	case r.Method == http.MethodPut && strings.HasPrefix(path, "/api/v1/templates/"):
		h.update(w, r)
	case r.Method == http.MethodDelete && strings.HasPrefix(path, "/api/v1/templates/"):
		h.delete(w, r)
	case r.Method == http.MethodOptions:
		w.WriteHeader(http.StatusOK)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *TemplatesHandler) list(w http.ResponseWriter, r *http.Request) {
	templates, err := h.store.ListTemplates()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if templates == nil {
		templates = []models.Template{}
	}
	writeJSON(w, http.StatusOK, templates)
}

func (h *TemplatesHandler) create(w http.ResponseWriter, r *http.Request) {
	var req models.TemplateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "模板名称不能为空"})
		return
	}
	if len(req.Fields) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "模板至少需要一个字段"})
		return
	}

	t := models.Template{
		ID:        generateID(),
		Name:      req.Name,
		Fields:    req.Fields,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := h.store.SaveTemplate(t); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (h *TemplatesHandler) update(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/templates/")

	template, err := h.store.GetTemplate(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}

	var req models.TemplateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}

	if req.Name != "" {
		template.Name = req.Name
	}
	if req.Fields != nil {
		template.Fields = req.Fields
	}

	if err := h.store.SaveTemplate(*template); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, template)
}

func (h *TemplatesHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/templates/")
	if err := h.store.DeleteTemplate(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
