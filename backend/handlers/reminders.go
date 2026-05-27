package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"report/backend/models"
	"report/backend/store"
)

type RemindersHandler struct {
	store *store.Store
}

func NewRemindersHandler(s *store.Store) *RemindersHandler {
	return &RemindersHandler{store: s}
}

func (h *RemindersHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	path := strings.TrimSuffix(r.URL.Path, "/")

	switch {
	case r.Method == http.MethodGet && path == "/api/v1/reminders":
		h.list(w, r)
	case r.Method == http.MethodPost && path == "/api/v1/reminders":
		h.create(w, r)
	case r.Method == http.MethodPut && strings.HasPrefix(path, "/api/v1/reminders/"):
		h.update(w, r)
	case r.Method == http.MethodDelete && strings.HasPrefix(path, "/api/v1/reminders/"):
		h.delete(w, r)
	case r.Method == http.MethodOptions:
		w.WriteHeader(http.StatusOK)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *RemindersHandler) list(w http.ResponseWriter, r *http.Request) {
	reminders, err := h.store.ListReminders()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if reminders == nil {
		reminders = []models.ReminderTask{}
	}
	writeJSON(w, http.StatusOK, reminders)
}

func (h *RemindersHandler) create(w http.ResponseWriter, r *http.Request) {
	var task models.ReminderTask
	if err := json.NewDecoder(r.Body).Decode(&task); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if task.Name == "" || task.Message == "" || task.Time == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "名称、提醒内容和时间不能为空"})
		return
	}
	if task.ScheduleType != "daily" && task.ScheduleType != "weekly" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "类型必须是 daily 或 weekly"})
		return
	}

	task.ID = generateID()
	task.CreatedAt = time.Now()
	task.Enabled = true

	if err := h.store.SaveReminder(task); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

func (h *RemindersHandler) update(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/reminders/")

	reminders, err := h.store.ListReminders()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	var task *models.ReminderTask
	for i := range reminders {
		if reminders[i].ID == id {
			task = &reminders[i]
			break
		}
	}
	if task == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "提醒不存在"})
		return
	}

	var req models.UpdateReminderReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}

	if req.Name != nil {
		task.Name = *req.Name
	}
	if req.Enabled != nil {
		task.Enabled = *req.Enabled
	}
	if req.ScheduleType != nil {
		task.ScheduleType = *req.ScheduleType
	}
	if req.Time != nil {
		task.Time = *req.Time
	}
	if req.Weekday != nil {
		task.Weekday = *req.Weekday
	}
	if req.Message != nil {
		task.Message = *req.Message
	}

	if err := h.store.SaveReminder(*task); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (h *RemindersHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/reminders/")
	if err := h.store.DeleteReminder(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func generateID() string {
	return strings.ReplaceAll(time.Now().Format("20060102150405.000000"), ".", "")
}

func extractID(path, prefix string) string {
	s := strings.TrimPrefix(path, prefix)
	s = strings.TrimSuffix(s, "/")
	return s
}
