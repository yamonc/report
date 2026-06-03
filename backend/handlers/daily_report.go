package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"report/backend/models"
	"report/backend/store"
)

type DailyReportHandler struct {
	store *store.Store
}

func NewDailyReportHandler(s *store.Store) *DailyReportHandler {
	return &DailyReportHandler{store: s}
}

func (h *DailyReportHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// /api/v1/daily-reports/xxx or /api/v1/daily-reports
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/daily-reports")
	path = strings.TrimPrefix(path, "/")

	switch r.Method {
	case http.MethodPost:
		h.create(w, r)
	case http.MethodGet:
		if path == "" {
			h.list(w, r)
		} else {
			h.getByDate(w, r, path)
		}
	case http.MethodPut:
		if path != "" {
			h.update(w, r, path)
		} else {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "date required"})
		}
	case http.MethodDelete:
		if path != "" {
			h.delete(w, r, path)
		} else {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "date required"})
		}
	case http.MethodOptions:
		w.WriteHeader(http.StatusOK)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *DailyReportHandler) create(w http.ResponseWriter, r *http.Request) {
	var req models.DailyReportReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if req.Date == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "日期不能为空"})
		return
	}

	report := models.DailyReport{Date: req.Date, Content: req.Content}
	if err := h.store.SaveDailyReport(report); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetDailyReport(req.Date)
	writeJSON(w, http.StatusCreated, saved)
}

func (h *DailyReportHandler) getByDate(w http.ResponseWriter, r *http.Request, date string) {
	report, err := h.store.GetDailyReport(date)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "日报不存在"})
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (h *DailyReportHandler) update(w http.ResponseWriter, r *http.Request, date string) {
	var req models.DailyReportReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}

	report := models.DailyReport{Date: date, Content: req.Content}
	if err := h.store.SaveDailyReport(report); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetDailyReport(date)
	writeJSON(w, http.StatusOK, saved)
}

func (h *DailyReportHandler) delete(w http.ResponseWriter, r *http.Request, date string) {
	if err := h.store.DeleteDailyReport(date); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *DailyReportHandler) list(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	reports, err := h.store.ListDailyReports(from, to)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, reports)
}
