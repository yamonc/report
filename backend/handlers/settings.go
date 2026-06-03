package handlers

import (
	"encoding/json"
	"net/http"

	"report/backend/models"
	"report/backend/store"
)

type SettingsHandler struct {
	store *store.Store
}

func NewSettingsHandler(s *store.Store) *SettingsHandler {
	return &SettingsHandler{store: s}
}

func (h *SettingsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		h.get(w, r)
	case http.MethodPut:
		h.save(w, r)
	case http.MethodOptions:
		w.WriteHeader(http.StatusOK)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *SettingsHandler) get(w http.ResponseWriter, r *http.Request) {
	settings, err := h.store.GetFullSettings()
	if err != nil || settings == nil {
		// First access: initialize with defaults
		defaultAI := models.AISettings{
			Provider: "deepseek",
			BaseURL:  "https://api.deepseek.com",
			Model:    "deepseek-chat",
		}
		settings = &models.FullSettings{
			AI:        defaultAI,
			SMTP:      models.SMTPConfig{Port: 587},
			Reminders: models.DefaultReminders(),
		}
		h.store.SaveFullSettings(settings)
	}

	if settings.AI.BaseURL == "" {
		settings.AI.BaseURL = "https://api.deepseek.com"
	}
	if settings.AI.Model == "" {
		settings.AI.Model = "deepseek-chat"
	}
	if settings.AI.Provider == "" {
		settings.AI.Provider = "deepseek"
	}
	if len(settings.Reminders) == 0 {
		settings.Reminders = models.DefaultReminders()
		h.store.SaveFullSettings(settings)
	}

	writeJSON(w, http.StatusOK, settings)
}

func (h *SettingsHandler) save(w http.ResponseWriter, r *http.Request) {
	var settings models.FullSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if err := h.store.SaveFullSettings(&settings); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
