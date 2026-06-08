package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"time"

	"report/backend/models"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func New(dir string) *Store {
	os.MkdirAll(dir, 0755)

	dbPath := dir + "/report.db"
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		panic(fmt.Sprintf("open database: %v", err))
	}

	db.Exec("PRAGMA journal_mode=WAL")
	db.Exec("PRAGMA busy_timeout=5000")

	s := &Store{db: db}
	s.createTables()
	s.migrateFromJSON(dir)
	return s
}

// --- helpers ---

func formatTime(t time.Time) string {
	return t.Format(time.RFC3339Nano)
}

func parseTime(s string) (time.Time, error) {
	return time.Parse(time.RFC3339Nano, s)
}

func marshalTags(tags []string) string {
	if tags == nil {
		return "[]"
	}
	b, _ := json.Marshal(tags)
	return string(b)
}

func unmarshalTags(s string) []string {
	var tags []string
	json.Unmarshal([]byte(s), &tags)
	if tags == nil {
		tags = []string{}
	}
	return tags
}

// ============ Daily Reports ============

func (s *Store) SaveDailyReport(r models.DailyReport) error {
	now := time.Now()
	existing, err := s.GetDailyReport(r.Date)
	if err == nil {
		r.CreatedAt = existing.CreatedAt
	} else {
		r.CreatedAt = now
	}
	r.UpdatedAt = now

	_, err = s.db.Exec(
		`INSERT OR REPLACE INTO daily_reports (date, content, created_at, updated_at)
		 VALUES (?, ?, ?, ?)`,
		r.Date, r.Content, formatTime(r.CreatedAt), formatTime(r.UpdatedAt),
	)
	return err
}

func (s *Store) GetDailyReport(date string) (*models.DailyReport, error) {
	var r models.DailyReport
	var ca, ua string
	err := s.db.QueryRow(
		`SELECT date, content, created_at, updated_at FROM daily_reports WHERE date = ?`,
		date,
	).Scan(&r.Date, &r.Content, &ca, &ua)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("日报不存在: %s", date)
	}
	if err != nil {
		return nil, err
	}
	r.CreatedAt, _ = parseTime(ca)
	r.UpdatedAt, _ = parseTime(ua)
	return &r, nil
}

func (s *Store) ListDailyReports(from, to string) ([]models.DailyReport, error) {
	q := "SELECT date, content, created_at, updated_at FROM daily_reports WHERE 1=1"
	args := []interface{}{}
	if from != "" {
		q += " AND date >= ?"
		args = append(args, from)
	}
	if to != "" {
		q += " AND date <= ?"
		args = append(args, to)
	}
	q += " ORDER BY date DESC"

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.DailyReport, 0)
	for rows.Next() {
		var r models.DailyReport
		var ca, ua string
		if err := rows.Scan(&r.Date, &r.Content, &ca, &ua); err != nil {
			return nil, err
		}
		r.CreatedAt, _ = parseTime(ca)
		r.UpdatedAt, _ = parseTime(ua)
		result = append(result, r)
	}
	return result, rows.Err()
}

func (s *Store) DeleteDailyReport(date string) error {
	result, err := s.db.Exec(`DELETE FROM daily_reports WHERE date = ?`, date)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("日报不存在: %s", date)
	}
	return nil
}

// ============ Weekly Reports ============

func (s *Store) SaveWeeklyReport(r models.WeeklyReport) error {
	now := time.Now()
	existing, err := s.GetWeeklyReport(r.ID)
	if err == nil {
		r.CreatedAt = existing.CreatedAt
	} else {
		r.CreatedAt = now
	}
	r.UpdatedAt = now

	_, err = s.db.Exec(
		`INSERT OR REPLACE INTO weekly_reports (id, week_start, week_end, content, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		r.ID, r.WeekStart, r.WeekEnd, r.Content, r.Status,
		formatTime(r.CreatedAt), formatTime(r.UpdatedAt),
	)
	return err
}

func (s *Store) GetWeeklyReport(id string) (*models.WeeklyReport, error) {
	var r models.WeeklyReport
	var ca, ua string
	err := s.db.QueryRow(
		`SELECT id, week_start, week_end, content, status, created_at, updated_at
		 FROM weekly_reports WHERE id = ?`, id,
	).Scan(&r.ID, &r.WeekStart, &r.WeekEnd, &r.Content, &r.Status, &ca, &ua)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("周报不存在: %s", id)
	}
	if err != nil {
		return nil, err
	}
	r.CreatedAt, _ = parseTime(ca)
	r.UpdatedAt, _ = parseTime(ua)
	return &r, nil
}

func (s *Store) ListWeeklyReports(weekStart string) ([]models.WeeklyReport, error) {
	q := "SELECT id, week_start, week_end, content, status, created_at, updated_at FROM weekly_reports WHERE 1=1"
	args := []interface{}{}
	if weekStart != "" {
		q += " AND week_start = ?"
		args = append(args, weekStart)
	}
	q += " ORDER BY week_start DESC"

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.WeeklyReport, 0)
	for rows.Next() {
		var r models.WeeklyReport
		var ca, ua string
		if err := rows.Scan(&r.ID, &r.WeekStart, &r.WeekEnd, &r.Content, &r.Status, &ca, &ua); err != nil {
			return nil, err
		}
		r.CreatedAt, _ = parseTime(ca)
		r.UpdatedAt, _ = parseTime(ua)
		result = append(result, r)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].WeekStart > result[j].WeekStart
	})
	return result, rows.Err()
}

func (s *Store) FindWeeklyByWeek(weekStart, weekEnd string) (*models.WeeklyReport, error) {
	var r models.WeeklyReport
	var ca, ua string
	err := s.db.QueryRow(
		`SELECT id, week_start, week_end, content, status, created_at, updated_at
		 FROM weekly_reports WHERE week_start = ? AND week_end = ?`,
		weekStart, weekEnd,
	).Scan(&r.ID, &r.WeekStart, &r.WeekEnd, &r.Content, &r.Status, &ca, &ua)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("周报不存在")
	}
	if err != nil {
		return nil, err
	}
	r.CreatedAt, _ = parseTime(ca)
	r.UpdatedAt, _ = parseTime(ua)
	return &r, nil
}

// ============ Settings ============

func (s *Store) ensureSettingsRow() {
	s.db.Exec(`INSERT OR IGNORE INTO settings (id) VALUES (1)`)
}

func (s *Store) GetSettings() (*models.AISettings, error) {
	s.ensureSettingsRow()
	var settings models.AISettings
	err := s.db.QueryRow(
		`SELECT ai_provider, ai_base_url, ai_api_key, ai_model FROM settings WHERE id = 1`,
	).Scan(&settings.Provider, &settings.BaseURL, &settings.APIKey, &settings.Model)
	if err != nil {
		return nil, err
	}
	return &settings, nil
}

func (s *Store) SaveSettings(settings *models.AISettings) error {
	s.ensureSettingsRow()
	_, err := s.db.Exec(
		`UPDATE settings SET ai_provider=?, ai_base_url=?, ai_api_key=?, ai_model=? WHERE id=1`,
		settings.Provider, settings.BaseURL, settings.APIKey, settings.Model,
	)
	return err
}

func (s *Store) GetFullSettings() (*models.FullSettings, error) {
	s.ensureSettingsRow()

	var fs models.FullSettings
	err := s.db.QueryRow(
		`SELECT ai_provider, ai_base_url, ai_api_key, ai_model,
		        smtp_host, smtp_port, smtp_username, smtp_password
		 FROM settings WHERE id = 1`,
	).Scan(&fs.AI.Provider, &fs.AI.BaseURL, &fs.AI.APIKey, &fs.AI.Model,
		&fs.SMTP.Host, &fs.SMTP.Port, &fs.SMTP.Username, &fs.SMTP.Password)
	if err != nil {
		return nil, err
	}

	// Apply defaults
	if fs.AI.Provider == "" {
		fs.AI = models.AISettings{
			Provider: "deepseek",
			BaseURL:  "https://api.deepseek.com",
			Model:    "deepseek-chat",
		}
	}

	// Read reminders from the reminders table (single source of truth)
	reminders, err := s.ListReminders()
	if err != nil {
		return nil, err
	}
	fs.Reminders = reminders

	return &fs, nil
}

func (s *Store) SaveFullSettings(settings *models.FullSettings) error {
	s.ensureSettingsRow()

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(
		`UPDATE settings SET
			ai_provider=?, ai_base_url=?, ai_api_key=?, ai_model=?,
			smtp_host=?, smtp_port=?, smtp_username=?, smtp_password=?
		 WHERE id=1`,
		settings.AI.Provider, settings.AI.BaseURL, settings.AI.APIKey, settings.AI.Model,
		settings.SMTP.Host, settings.SMTP.Port, settings.SMTP.Username, settings.SMTP.Password,
	)
	if err != nil {
		return err
	}

	// Sync reminders from FullSettings into the reminders table
	if settings.Reminders != nil {
		for _, r := range settings.Reminders {
			ca := r.CreatedAt
			if ca.IsZero() {
				ca = time.Now()
			}
			_, err := tx.Exec(
				`INSERT OR REPLACE INTO reminders (id, name, enabled, schedule_type, time, weekday, message, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				r.ID, r.Name, boolToInt(r.Enabled), r.ScheduleType, r.Time, r.Weekday, r.Message, formatTime(ca),
			)
			if err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// ============ Users ============

func (s *Store) SaveUser(u models.User) error {
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO users (email, password_hash, created_at) VALUES (?, ?, ?)`,
		u.Email, u.PasswordHash, formatTime(u.CreatedAt),
	)
	return err
}

func (s *Store) GetUser(email string) (*models.User, error) {
	var u models.User
	var ca string
	err := s.db.QueryRow(
		`SELECT email, password_hash, created_at FROM users WHERE email = ?`, email,
	).Scan(&u.Email, &u.PasswordHash, &ca)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("用户不存在: %s", email)
	}
	if err != nil {
		return nil, err
	}
	u.CreatedAt, _ = parseTime(ca)
	return &u, nil
}

// ============ Reminders ============

func (s *Store) ListReminders() ([]models.ReminderTask, error) {
	rows, err := s.db.Query(
		`SELECT id, name, enabled, schedule_type, time, weekday, message, created_at FROM reminders`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.ReminderTask, 0)
	for rows.Next() {
		var r models.ReminderTask
		var enabled int
		var ca string
		if err := rows.Scan(&r.ID, &r.Name, &enabled, &r.ScheduleType, &r.Time, &r.Weekday, &r.Message, &ca); err != nil {
			return nil, err
		}
		r.Enabled = enabled != 0
		r.CreatedAt, _ = parseTime(ca)
		result = append(result, r)
	}
	return result, rows.Err()
}

func (s *Store) SaveReminder(r models.ReminderTask) error {
	ca := r.CreatedAt
	if ca.IsZero() {
		ca = time.Now()
	}
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO reminders (id, name, enabled, schedule_type, time, weekday, message, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		r.ID, r.Name, boolToInt(r.Enabled), r.ScheduleType, r.Time, r.Weekday, r.Message, formatTime(ca),
	)
	return err
}

func (s *Store) DeleteReminder(id string) error {
	result, err := s.db.Exec(`DELETE FROM reminders WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("提醒不存在: %s", id)
	}
	return nil
}

func (s *Store) SaveAllReminders(reminders []models.ReminderTask) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM reminders`); err != nil {
		return err
	}
	for _, r := range reminders {
		ca := r.CreatedAt
		if ca.IsZero() {
			ca = time.Now()
		}
		_, err := tx.Exec(
			`INSERT INTO reminders (id, name, enabled, schedule_type, time, weekday, message, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			r.ID, r.Name, boolToInt(r.Enabled), r.ScheduleType, r.Time, r.Weekday, r.Message, formatTime(ca),
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ============ Tasks ============

func (s *Store) ListTasks(status, category, priority string) ([]models.Task, error) {
	q := "SELECT id, title, description, status, priority, category, due_date, created_at, updated_at FROM tasks WHERE 1=1"
	args := []interface{}{}
	if status != "" {
		q += " AND status = ?"
		args = append(args, status)
	}
	if category != "" {
		q += " AND category = ?"
		args = append(args, category)
	}
	if priority != "" {
		q += " AND priority = ?"
		args = append(args, priority)
	}
	q += " ORDER BY created_at DESC"

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.Task, 0)
	for rows.Next() {
		var t models.Task
		var ca, ua string
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.Category, &t.DueDate, &ca, &ua); err != nil {
			return nil, err
		}
		t.CreatedAt, _ = parseTime(ca)
		t.UpdatedAt, _ = parseTime(ua)
		result = append(result, t)
	}
	return result, rows.Err()
}

func (s *Store) GetTask(id string) (*models.Task, error) {
	var t models.Task
	var ca, ua string
	err := s.db.QueryRow(
		`SELECT id, title, description, status, priority, category, due_date, created_at, updated_at
		 FROM tasks WHERE id = ?`, id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.Category, &t.DueDate, &ca, &ua)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("任务不存在: %s", id)
	}
	if err != nil {
		return nil, err
	}
	t.CreatedAt, _ = parseTime(ca)
	t.UpdatedAt, _ = parseTime(ua)
	return &t, nil
}

func (s *Store) SaveTask(t models.Task) error {
	now := time.Now()
	existing, err := s.GetTask(t.ID)
	if err == nil {
		t.CreatedAt = existing.CreatedAt
	} else {
		t.CreatedAt = now
	}
	t.UpdatedAt = now

	_, err = s.db.Exec(
		`INSERT OR REPLACE INTO tasks (id, title, description, status, priority, category, due_date, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.Title, t.Description, t.Status, t.Priority, t.Category, t.DueDate,
		formatTime(t.CreatedAt), formatTime(t.UpdatedAt),
	)
	return err
}

func (s *Store) DeleteTask(id string) error {
	result, err := s.db.Exec(`DELETE FROM tasks WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("任务不存在: %s", id)
	}
	return nil
}

// ============ Knowledge ============

func (s *Store) ListKnowledge(search, itemType, tag string) ([]models.KnowledgeItem, error) {
	q := "SELECT id, title, type, content, source_url, tags, created_at, updated_at FROM knowledge_items WHERE 1=1"
	args := []interface{}{}
	if itemType != "" {
		q += " AND type = ?"
		args = append(args, itemType)
	}
	if search != "" {
		q += " AND (title LIKE ? OR content LIKE ?)"
		like := "%" + search + "%"
		args = append(args, like, like)
	}
	if tag != "" {
		// tag stored as JSON: ["tag1","tag2"] — match with quotes for precision
		q += " AND tags LIKE ?"
		args = append(args, "%\""+tag+"\"%")
	}
	q += " ORDER BY created_at DESC"

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.KnowledgeItem, 0)
	for rows.Next() {
		var item models.KnowledgeItem
		var tagsStr, ca, ua string
		if err := rows.Scan(&item.ID, &item.Title, &item.Type, &item.Content, &item.SourceURL, &tagsStr, &ca, &ua); err != nil {
			return nil, err
		}
		item.Tags = unmarshalTags(tagsStr)
		item.CreatedAt, _ = parseTime(ca)
		item.UpdatedAt, _ = parseTime(ua)
		result = append(result, item)
	}

	// For search filtering, we already did SQL LIKE which is case-insensitive for ASCII,
	// but the original code used strings.ToLower. SQLite LIKE is case-insensitive for ASCII
	// by default, so this matches the original behavior.
	return result, rows.Err()
}

func (s *Store) GetKnowledge(id string) (*models.KnowledgeItem, error) {
	var item models.KnowledgeItem
	var tagsStr, ca, ua string
	err := s.db.QueryRow(
		`SELECT id, title, type, content, source_url, tags, created_at, updated_at
		 FROM knowledge_items WHERE id = ?`, id,
	).Scan(&item.ID, &item.Title, &item.Type, &item.Content, &item.SourceURL, &tagsStr, &ca, &ua)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("知识片段不存在: %s", id)
	}
	if err != nil {
		return nil, err
	}
	item.Tags = unmarshalTags(tagsStr)
	item.CreatedAt, _ = parseTime(ca)
	item.UpdatedAt, _ = parseTime(ua)
	return &item, nil
}

func (s *Store) SaveKnowledge(item models.KnowledgeItem) error {
	now := time.Now()
	existing, err := s.GetKnowledge(item.ID)
	if err == nil {
		item.CreatedAt = existing.CreatedAt
	} else {
		item.CreatedAt = now
	}
	item.UpdatedAt = now

	if item.Tags == nil {
		item.Tags = []string{}
	}

	_, err = s.db.Exec(
		`INSERT OR REPLACE INTO knowledge_items (id, title, type, content, source_url, tags, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		item.ID, item.Title, item.Type, item.Content, item.SourceURL,
		marshalTags(item.Tags),
		formatTime(item.CreatedAt), formatTime(item.UpdatedAt),
	)
	return err
}

func (s *Store) DeleteKnowledge(id string) error {
	result, err := s.db.Exec(`DELETE FROM knowledge_items WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("知识片段不存在: %s", id)
	}
	return nil
}

// ============ Templates ============

func (s *Store) ListTemplates() ([]models.Template, error) {
	rows, err := s.db.Query(
		`SELECT id, name, fields, created_at, updated_at FROM templates ORDER BY created_at ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.Template, 0)
	for rows.Next() {
		var t models.Template
		var fieldsStr, ca, ua string
		if err := rows.Scan(&t.ID, &t.Name, &fieldsStr, &ca, &ua); err != nil {
			return nil, err
		}
		t.Fields = unmarshalTags(fieldsStr)
		t.CreatedAt, _ = parseTime(ca)
		t.UpdatedAt, _ = parseTime(ua)
		result = append(result, t)
	}
	return result, rows.Err()
}

func (s *Store) GetTemplate(id string) (*models.Template, error) {
	var t models.Template
	var fieldsStr, ca, ua string
	err := s.db.QueryRow(
		`SELECT id, name, fields, created_at, updated_at FROM templates WHERE id = ?`, id,
	).Scan(&t.ID, &t.Name, &fieldsStr, &ca, &ua)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("模板不存在: %s", id)
	}
	if err != nil {
		return nil, err
	}
	t.Fields = unmarshalTags(fieldsStr)
	t.CreatedAt, _ = parseTime(ca)
	t.UpdatedAt, _ = parseTime(ua)
	return &t, nil
}

func (s *Store) SaveTemplate(t models.Template) error {
	now := time.Now()
	existing, err := s.GetTemplate(t.ID)
	if err == nil {
		t.CreatedAt = existing.CreatedAt
	} else {
		t.CreatedAt = now
	}
	t.UpdatedAt = now

	if t.Fields == nil {
		t.Fields = []string{}
	}

	_, err = s.db.Exec(
		`INSERT OR REPLACE INTO templates (id, name, fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		t.ID, t.Name, marshalTags(t.Fields), formatTime(t.CreatedAt), formatTime(t.UpdatedAt),
	)
	return err
}

func (s *Store) DeleteTemplate(id string) error {
	result, err := s.db.Exec(`DELETE FROM templates WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("模板不存在: %s", id)
	}
	return nil
}

// ============ Quick Notes ============

func (s *Store) ListQuickNotes(status string) ([]models.QuickNote, error) {
	q := "SELECT id, content, tags, source, status, archived_to, created_at, updated_at FROM quick_notes WHERE 1=1"
	args := []interface{}{}
	if status != "" {
		q += " AND status = ?"
		args = append(args, status)
	}
	q += " ORDER BY created_at DESC"

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.QuickNote, 0)
	for rows.Next() {
		var n models.QuickNote
		var tagsStr, ca, ua string
		if err := rows.Scan(&n.ID, &n.Content, &tagsStr, &n.Source, &n.Status, &n.ArchivedTo, &ca, &ua); err != nil {
			return nil, err
		}
		n.Tags = unmarshalTags(tagsStr)
		n.CreatedAt, _ = parseTime(ca)
		n.UpdatedAt, _ = parseTime(ua)
		result = append(result, n)
	}
	return result, rows.Err()
}

func (s *Store) GetQuickNote(id string) (*models.QuickNote, error) {
	var n models.QuickNote
	var tagsStr, ca, ua string
	err := s.db.QueryRow(
		`SELECT id, content, tags, source, status, archived_to, created_at, updated_at FROM quick_notes WHERE id = ?`, id,
	).Scan(&n.ID, &n.Content, &tagsStr, &n.Source, &n.Status, &n.ArchivedTo, &ca, &ua)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("小记不存在: %s", id)
	}
	if err != nil {
		return nil, err
	}
	n.Tags = unmarshalTags(tagsStr)
	n.CreatedAt, _ = parseTime(ca)
	n.UpdatedAt, _ = parseTime(ua)
	return &n, nil
}

func (s *Store) SaveQuickNote(n models.QuickNote) error {
	now := time.Now()
	existing, err := s.GetQuickNote(n.ID)
	if err == nil {
		n.CreatedAt = existing.CreatedAt
	} else {
		n.CreatedAt = now
	}
	n.UpdatedAt = now

	if n.Tags == nil {
		n.Tags = []string{}
	}

	_, err = s.db.Exec(
		`INSERT OR REPLACE INTO quick_notes (id, content, tags, source, status, archived_to, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		n.ID, n.Content, marshalTags(n.Tags), n.Source, n.Status, n.ArchivedTo,
		formatTime(n.CreatedAt), formatTime(n.UpdatedAt),
	)
	return err
}

func (s *Store) DeleteQuickNote(id string) error {
	result, err := s.db.Exec(`DELETE FROM quick_notes WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("小记不存在: %s", id)
	}
	return nil
}
