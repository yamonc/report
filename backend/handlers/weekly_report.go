package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"report/backend/models"
	"report/backend/services"
	"report/backend/store"
)

type WeeklyReportHandler struct {
	store *store.Store
	ai    *services.AIService
}

func NewWeeklyReportHandler(s *store.Store, ai *services.AIService) *WeeklyReportHandler {
	return &WeeklyReportHandler{store: s, ai: ai}
}

func (h *WeeklyReportHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	path := strings.TrimPrefix(r.URL.Path, "/api/v1/weekly-reports")
	path = strings.TrimPrefix(path, "/")

	switch r.Method {
	case http.MethodPost:
		if path == "generate" {
			h.generate(w, r)
		} else {
			http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		}
	case http.MethodGet:
		if path == "" {
			h.list(w, r)
		} else {
			h.getByID(w, r, path)
		}
	case http.MethodPut:
		if path != "" {
			h.update(w, r, path)
		} else {
			http.Error(w, `{"error":"id required"}`, http.StatusBadRequest)
		}
	case http.MethodOptions:
		w.WriteHeader(http.StatusOK)
	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func (h *WeeklyReportHandler) generate(w http.ResponseWriter, r *http.Request) {
	var req models.GenerateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if req.WeekStart == "" || req.WeekEnd == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "week_start 和 week_end 不能为空"})
		return
	}

	report, err := h.ai.GenerateWeeklyReport(req.WeekStart, req.WeekEnd)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, report)
}

func (h *WeeklyReportHandler) getByID(w http.ResponseWriter, r *http.Request, id string) {
	report, err := h.store.GetWeeklyReport(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "周报不存在"})
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (h *WeeklyReportHandler) update(w http.ResponseWriter, r *http.Request, id string) {
	var req models.UpdateWeeklyReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}

	existing, err := h.store.GetWeeklyReport(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "周报不存在"})
		return
	}

	if req.Content != "" {
		existing.Content = req.Content
	}
	if req.Status != "" {
		existing.Status = req.Status
	}

	if err := h.store.SaveWeeklyReport(*existing); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetWeeklyReport(id)
	writeJSON(w, http.StatusOK, saved)
}

func (h *WeeklyReportHandler) list(w http.ResponseWriter, r *http.Request) {
	weekStart := r.URL.Query().Get("week_start")
	reports, err := h.store.ListWeeklyReports(weekStart)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, reports)
}
