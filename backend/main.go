package main

import (
	"log"
	"net/http"

	"report/backend/config"
	"report/backend/handlers"
	"report/backend/middleware"
	"report/backend/scheduler"
	"report/backend/services"
	"report/backend/store"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	cfg := config.Load()

	if cfg.DeepSeekAPIKey == "" {
		log.Println("WARNING: DEEPSEEK_API_KEY not set, AI features will not work")
	}

	s := store.New(cfg.DBPath)

	aiSvc := services.NewAIService(cfg, s)
	emailSvc := services.NewEmailService()

	dailyHandler := handlers.NewDailyReportHandler(s)
	weeklyHandler := handlers.NewWeeklyReportHandler(s, aiSvc)
	settingsHandler := handlers.NewSettingsHandler(s, emailSvc)
	authHandler := handlers.NewAuthHandler(s, cfg.JWTSecret)
	remindersHandler := handlers.NewRemindersHandler(s)
	tasksHandler := handlers.NewTasksHandler(s)
	knowledgeHandler := handlers.NewKnowledgeHandler(s)
	templatesHandler := handlers.NewTemplatesHandler(s)
	quickNotesHandler := handlers.NewQuickNotesHandler(s, aiSvc)

	mux := http.NewServeMux()

	// Public: health check
	mux.HandleFunc("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Public: auth
	mux.Handle("/api/v1/auth/login", authHandler)
	mux.Handle("/api/v1/auth/login/", authHandler)

	// Protected routes
	mux.Handle("/api/v1/auth/me", authHandler)
	mux.Handle("/api/v1/auth/me/", authHandler)
	mux.Handle("/api/v1/daily-reports", dailyHandler)
	mux.Handle("/api/v1/daily-reports/", dailyHandler)
	mux.Handle("/api/v1/weekly-reports", weeklyHandler)
	mux.Handle("/api/v1/weekly-reports/", weeklyHandler)
	mux.Handle("/api/v1/settings", settingsHandler)
	mux.Handle("/api/v1/settings/", settingsHandler)
	mux.Handle("/api/v1/settings/test-email", settingsHandler)
	mux.Handle("/api/v1/settings/test-email/", settingsHandler)
	mux.Handle("/api/v1/reminders", remindersHandler)
	mux.Handle("/api/v1/reminders/", remindersHandler)
	mux.Handle("/api/v1/tasks", tasksHandler)
	mux.Handle("/api/v1/tasks/", tasksHandler)
	mux.Handle("/api/v1/knowledge", knowledgeHandler)
	mux.Handle("/api/v1/knowledge/", knowledgeHandler)
	mux.Handle("/api/v1/templates", templatesHandler)
	mux.Handle("/api/v1/templates/", templatesHandler)
	mux.Handle("/api/v1/quick-notes", quickNotesHandler)
	mux.Handle("/api/v1/quick-notes/", quickNotesHandler)

	// Middleware chain: cors → auth → mux
	handler := corsMiddleware(middleware.AuthMiddleware(cfg.JWTSecret)(mux))

	// Start scheduler
	sched := scheduler.New(s, emailSvc)
	go sched.Start()

	addr := "127.0.0.1:" + cfg.Port
	log.Printf("Server starting on http://%s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
