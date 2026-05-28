package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"report/backend/models"
	"report/backend/store"
)

type TasksHandler struct {
	store *store.Store
}

func NewTasksHandler(s *store.Store) *TasksHandler {
	return &TasksHandler{store: s}
}

func (h *TasksHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	path := strings.TrimSuffix(r.URL.Path, "/")

	switch {
	case r.Method == http.MethodGet && path == "/api/v1/tasks":
		h.list(w, r)
	case r.Method == http.MethodPost && path == "/api/v1/tasks":
		h.create(w, r)
	case r.Method == http.MethodGet && strings.HasPrefix(path, "/api/v1/tasks/"):
		h.get(w, r)
	case r.Method == http.MethodPut && strings.HasPrefix(path, "/api/v1/tasks/"):
		h.update(w, r)
	case r.Method == http.MethodPatch && strings.HasSuffix(path, "/status"):
		h.updateStatus(w, r)
	case r.Method == http.MethodDelete && strings.HasPrefix(path, "/api/v1/tasks/"):
		h.delete(w, r)
	case r.Method == http.MethodOptions:
		w.WriteHeader(http.StatusOK)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *TasksHandler) list(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	category := r.URL.Query().Get("category")
	priority := r.URL.Query().Get("priority")
	tasks, err := h.store.ListTasks(status, category, priority)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if tasks == nil {
		tasks = []models.Task{}
	}
	writeJSON(w, http.StatusOK, tasks)
}

func (h *TasksHandler) get(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/tasks/")
	if strings.HasSuffix(id, "/status") {
		return // handled by updateStatus
	}
	task, err := h.store.GetTask(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "任务不存在"})
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (h *TasksHandler) create(w http.ResponseWriter, r *http.Request) {
	var req models.TaskReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if req.Title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "标题不能为空"})
		return
	}
	if req.Status == "" {
		req.Status = "todo"
	}
	if req.Priority == "" {
		req.Priority = "medium"
	}
	if req.Category == "" {
		req.Category = "其他"
	}

	task := models.Task{
		ID:          generateID(),
		Title:       req.Title,
		Description: req.Description,
		Status:      req.Status,
		Priority:    req.Priority,
		Category:    req.Category,
		DueDate:     req.DueDate,
	}
	if err := h.store.SaveTask(task); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetTask(task.ID)
	writeJSON(w, http.StatusCreated, saved)
}

func (h *TasksHandler) update(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/tasks/")

	existing, err := h.store.GetTask(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "任务不存在"})
		return
	}

	var req models.TaskReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}

	if req.Title != "" {
		existing.Title = req.Title
	}
	existing.Description = req.Description
	if req.Status != "" {
		existing.Status = req.Status
	}
	if req.Priority != "" {
		existing.Priority = req.Priority
	}
	if req.Category != "" {
		existing.Category = req.Category
	}
	existing.DueDate = req.DueDate

	if err := h.store.SaveTask(*existing); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetTask(id)
	writeJSON(w, http.StatusOK, saved)
}

func (h *TasksHandler) updateStatus(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimSuffix(r.URL.Path, "/status")
	id := extractID(path, "/api/v1/tasks/")

	existing, err := h.store.GetTask(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "任务不存在"})
		return
	}

	var req models.TaskStatusReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if req.Status == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "状态不能为空"})
		return
	}

	existing.Status = req.Status
	if err := h.store.SaveTask(*existing); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetTask(id)
	writeJSON(w, http.StatusOK, saved)
}

func (h *TasksHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := extractID(r.URL.Path, "/api/v1/tasks/")
	if err := h.store.DeleteTask(id); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
