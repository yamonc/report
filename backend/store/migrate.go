package store

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"

	"report/backend/models"
)

func (s *Store) createTables() {
	ddl := []string{
		`CREATE TABLE IF NOT EXISTS daily_reports (
			date       TEXT PRIMARY KEY,
			content    TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS weekly_reports (
			id         TEXT PRIMARY KEY,
			week_start TEXT NOT NULL,
			week_end   TEXT NOT NULL,
			content    TEXT NOT NULL DEFAULT '',
			status     TEXT NOT NULL DEFAULT 'draft',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_weekly_week_range ON weekly_reports(week_start, week_end)`,
		`CREATE TABLE IF NOT EXISTS settings (
			id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
			ai_provider   TEXT NOT NULL DEFAULT 'deepseek',
			ai_base_url   TEXT NOT NULL DEFAULT 'https://api.deepseek.com',
			ai_api_key    TEXT NOT NULL DEFAULT '',
			ai_model      TEXT NOT NULL DEFAULT 'deepseek-chat',
			smtp_host     TEXT NOT NULL DEFAULT '',
			smtp_port     INTEGER NOT NULL DEFAULT 587,
			smtp_username TEXT NOT NULL DEFAULT '',
			smtp_password TEXT NOT NULL DEFAULT ''
		)`,
		`CREATE TABLE IF NOT EXISTS users (
			email         TEXT PRIMARY KEY,
			password_hash TEXT NOT NULL DEFAULT '',
			created_at    TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS reminders (
			id            TEXT PRIMARY KEY,
			name          TEXT NOT NULL,
			enabled       INTEGER NOT NULL DEFAULT 1,
			schedule_type TEXT NOT NULL DEFAULT 'daily',
			time          TEXT NOT NULL DEFAULT '',
			weekday       INTEGER NOT NULL DEFAULT 0,
			message       TEXT NOT NULL DEFAULT '',
			created_at    TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS tasks (
			id          TEXT PRIMARY KEY,
			title       TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			status      TEXT NOT NULL DEFAULT 'todo',
			priority    TEXT NOT NULL DEFAULT 'medium',
			category    TEXT NOT NULL DEFAULT '其他',
			due_date    TEXT NOT NULL DEFAULT '',
			created_at  TEXT NOT NULL,
			updated_at  TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
		`CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category)`,
		`CREATE TABLE IF NOT EXISTS templates (
			id         TEXT PRIMARY KEY,
			name       TEXT NOT NULL,
			fields     TEXT NOT NULL DEFAULT '[]',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS knowledge_items (
			id         TEXT PRIMARY KEY,
			title      TEXT NOT NULL,
			type       TEXT NOT NULL DEFAULT 'note',
			content    TEXT NOT NULL DEFAULT '',
			source_url TEXT NOT NULL DEFAULT '',
			tags       TEXT NOT NULL DEFAULT '[]',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS quick_notes (
			id TEXT PRIMARY KEY,
			content TEXT NOT NULL,
			tags TEXT DEFAULT '[]',
			source TEXT DEFAULT '',
			status TEXT DEFAULT 'active',
			archived_to TEXT DEFAULT '',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
	}

	for _, stmt := range ddl {
		if _, err := s.db.Exec(stmt); err != nil {
			log.Printf("WARNING: create table failed: %v\nSQL: %s", err, stmt)
		}
	}

	// Ensure the singleton settings row exists
	s.ensureSettingsRow()
}

func (s *Store) migrateFromJSON(dir string) {
	// Check if DB already has data
	var count int
	if err := s.db.QueryRow("SELECT COUNT(*) FROM daily_reports").Scan(&count); err != nil {
		log.Printf("WARNING: migration check failed: %v", err)
		return
	}
	if count > 0 {
		return // already migrated
	}

	// Check if any legacy JSON files exist
	files := []string{
		"daily_reports.json", "weekly_reports.json", "settings.json",
		"users.json", "reminders.json", "tasks.json", "knowledge.json",
	}
	hasJSON := false
	for _, f := range files {
		if _, err := os.Stat(filepath.Join(dir, f)); err == nil {
			hasJSON = true
			break
		}
	}
	if !hasJSON {
		return // fresh start
	}

	log.Println("[migrate] JSON files detected, migrating to SQLite...")

	// Migrate daily_reports
	if data, err := os.ReadFile(filepath.Join(dir, "daily_reports.json")); err == nil {
		var reports []models.DailyReport
		if json.Unmarshal(data, &reports) == nil {
			for _, r := range reports {
				s.SaveDailyReport(r)
			}
			log.Printf("[migrate] daily_reports: %d rows", len(reports))
		}
	}

	// Migrate weekly_reports
	if data, err := os.ReadFile(filepath.Join(dir, "weekly_reports.json")); err == nil {
		var reports []models.WeeklyReport
		if json.Unmarshal(data, &reports) == nil {
			for _, r := range reports {
				s.SaveWeeklyReport(r)
			}
			log.Printf("[migrate] weekly_reports: %d rows", len(reports))
		}
	}

	// Migrate settings.json — extract AI, SMTP, and reminders
	// We process settings.json reminders FIRST, then reminders.json overwrites
	if data, err := os.ReadFile(filepath.Join(dir, "settings.json")); err == nil {
		var fs models.FullSettings
		if json.Unmarshal(data, &fs) == nil {
			// Save AI + SMTP settings
			s.SaveFullSettings(&fs)
			log.Printf("[migrate] settings: migrated AI + SMTP + %d reminders from settings.json", len(fs.Reminders))
		}
	}

	// Migrate users
	if data, err := os.ReadFile(filepath.Join(dir, "users.json")); err == nil {
		var users []models.User
		if json.Unmarshal(data, &users) == nil {
			for _, u := range users {
				s.SaveUser(u)
			}
			log.Printf("[migrate] users: %d rows", len(users))
		}
	}

	// Migrate reminders.json — overwrites any from settings.json (INSERT OR REPLACE)
	if data, err := os.ReadFile(filepath.Join(dir, "reminders.json")); err == nil {
		var reminders []models.ReminderTask
		if json.Unmarshal(data, &reminders) == nil {
			for _, r := range reminders {
				s.SaveReminder(r)
			}
			log.Printf("[migrate] reminders: %d rows from reminders.json", len(reminders))
		}
	}

	// Migrate tasks
	if data, err := os.ReadFile(filepath.Join(dir, "tasks.json")); err == nil {
		var tasks []models.Task
		if json.Unmarshal(data, &tasks) == nil {
			for _, t := range tasks {
				s.SaveTask(t)
			}
			log.Printf("[migrate] tasks: %d rows", len(tasks))
		}
	}

	// Migrate knowledge
	if data, err := os.ReadFile(filepath.Join(dir, "knowledge.json")); err == nil {
		var items []models.KnowledgeItem
		if json.Unmarshal(data, &items) == nil {
			for _, item := range items {
				s.SaveKnowledge(item)
			}
			log.Printf("[migrate] knowledge: %d rows", len(items))
		}
	}

	log.Println("[migrate] Migration complete.")
}
