package store

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"report/backend/models"
)

type Store struct {
	dir string
	mu  sync.RWMutex
}

func New(dir string) *Store {
	os.MkdirAll(dir, 0755)
	return &Store{dir: dir}
}

func (s *Store) dailyPath() string {
	return filepath.Join(s.dir, "daily_reports.json")
}

func (s *Store) weeklyPath() string {
	return filepath.Join(s.dir, "weekly_reports.json")
}

func (s *Store) settingsPath() string {
	return filepath.Join(s.dir, "settings.json")
}

func (s *Store) usersPath() string {
	return filepath.Join(s.dir, "users.json")
}

func (s *Store) remindersPath() string {
	return filepath.Join(s.dir, "reminders.json")
}

func (s *Store) readJSON(path string, v interface{}) error {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return json.Unmarshal(data, v)
}

func (s *Store) writeJSON(path string, v interface{}) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return ioutil.WriteFile(path, data, 0644)
}

// Daily Reports

func (s *Store) SaveDailyReport(r models.DailyReport) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var reports []models.DailyReport
	s.readJSON(s.dailyPath(), &reports)

	now := time.Now()
	for i, existing := range reports {
		if existing.Date == r.Date {
			r.CreatedAt = existing.CreatedAt
			r.UpdatedAt = now
			reports[i] = r
			return s.writeJSON(s.dailyPath(), reports)
		}
	}

	r.CreatedAt = now
	r.UpdatedAt = now
	reports = append(reports, r)
	return s.writeJSON(s.dailyPath(), reports)
}

func (s *Store) GetDailyReport(date string) (*models.DailyReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var reports []models.DailyReport
	s.readJSON(s.dailyPath(), &reports)

	for _, r := range reports {
		if r.Date == date {
			return &r, nil
		}
	}
	return nil, fmt.Errorf("日报不存在: %s", date)
}

func (s *Store) ListDailyReports(from, to string) ([]models.DailyReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var reports []models.DailyReport
	s.readJSON(s.dailyPath(), &reports)

	result := make([]models.DailyReport, 0)
	for _, r := range reports {
		if from != "" && r.Date < from {
			continue
		}
		if to != "" && r.Date > to {
			continue
		}
		result = append(result, r)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Date > result[j].Date
	})

	return result, nil
}

// Weekly Reports

func (s *Store) SaveWeeklyReport(r models.WeeklyReport) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var reports []models.WeeklyReport
	s.readJSON(s.weeklyPath(), &reports)

	now := time.Now()
	for i, existing := range reports {
		if existing.ID == r.ID {
			r.CreatedAt = existing.CreatedAt
			r.UpdatedAt = now
			reports[i] = r
			return s.writeJSON(s.weeklyPath(), reports)
		}
	}

	r.CreatedAt = now
	r.UpdatedAt = now
	reports = append(reports, r)
	return s.writeJSON(s.weeklyPath(), reports)
}

func (s *Store) GetWeeklyReport(id string) (*models.WeeklyReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var reports []models.WeeklyReport
	s.readJSON(s.weeklyPath(), &reports)

	for _, r := range reports {
		if r.ID == id {
			return &r, nil
		}
	}
	return nil, fmt.Errorf("周报不存在: %s", id)
}

func (s *Store) ListWeeklyReports(weekStart string) ([]models.WeeklyReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var reports []models.WeeklyReport
	s.readJSON(s.weeklyPath(), &reports)

	result := make([]models.WeeklyReport, 0)
	for _, r := range reports {
		if weekStart != "" && r.WeekStart != weekStart {
			continue
		}
		result = append(result, r)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].WeekStart > result[j].WeekStart
	})

	return result, nil
}

func (s *Store) FindWeeklyByWeek(weekStart, weekEnd string) (*models.WeeklyReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var reports []models.WeeklyReport
	s.readJSON(s.weeklyPath(), &reports)

	for _, r := range reports {
		if r.WeekStart == weekStart && r.WeekEnd == weekEnd {
			return &r, nil
		}
	}
	return nil, fmt.Errorf("周报不存在")
}

func (s *Store) GetSettings() (*models.AISettings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var settings models.AISettings
	if err := s.readJSON(s.settingsPath(), &settings); err != nil {
		return nil, err
	}
	return &settings, nil
}

func (s *Store) SaveSettings(settings *models.AISettings) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.writeJSON(s.settingsPath(), settings)
}

// Users

func (s *Store) SaveUser(u models.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var users []models.User
	s.readJSON(s.usersPath(), &users)

	for i, existing := range users {
		if existing.Email == u.Email {
			users[i] = u
			return s.writeJSON(s.usersPath(), users)
		}
	}
	users = append(users, u)
	return s.writeJSON(s.usersPath(), users)
}

func (s *Store) GetUser(email string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var users []models.User
	s.readJSON(s.usersPath(), &users)

	for _, u := range users {
		if u.Email == email {
			return &u, nil
		}
	}
	return nil, fmt.Errorf("用户不存在: %s", email)
}

// Reminders

func (s *Store) ListReminders() ([]models.ReminderTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var reminders []models.ReminderTask
	s.readJSON(s.remindersPath(), &reminders)
	if reminders == nil {
		reminders = []models.ReminderTask{}
	}
	return reminders, nil
}

func (s *Store) SaveReminder(r models.ReminderTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var reminders []models.ReminderTask
	s.readJSON(s.remindersPath(), &reminders)

	for i, existing := range reminders {
		if existing.ID == r.ID {
			reminders[i] = r
			return s.writeJSON(s.remindersPath(), reminders)
		}
	}
	reminders = append(reminders, r)
	return s.writeJSON(s.remindersPath(), reminders)
}

func (s *Store) DeleteReminder(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var reminders []models.ReminderTask
	s.readJSON(s.remindersPath(), &reminders)

	for i, r := range reminders {
		if r.ID == id {
			reminders = append(reminders[:i], reminders[i+1:]...)
			return s.writeJSON(s.remindersPath(), reminders)
		}
	}
	return fmt.Errorf("提醒不存在: %s", id)
}

func (s *Store) tasksPath() string {
	return filepath.Join(s.dir, "tasks.json")
}

func (s *Store) knowledgePath() string {
	return filepath.Join(s.dir, "knowledge.json")
}

// Tasks

func (s *Store) ListTasks(status, category, priority string) ([]models.Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var tasks []models.Task
	s.readJSON(s.tasksPath(), &tasks)

	result := make([]models.Task, 0)
	for _, t := range tasks {
		if status != "" && t.Status != status {
			continue
		}
		if category != "" && t.Category != category {
			continue
		}
		if priority != "" && t.Priority != priority {
			continue
		}
		result = append(result, t)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})

	return result, nil
}

func (s *Store) GetTask(id string) (*models.Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var tasks []models.Task
	s.readJSON(s.tasksPath(), &tasks)

	for _, t := range tasks {
		if t.ID == id {
			return &t, nil
		}
	}
	return nil, fmt.Errorf("任务不存在: %s", id)
}

func (s *Store) SaveTask(t models.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var tasks []models.Task
	s.readJSON(s.tasksPath(), &tasks)

	now := time.Now()
	for i, existing := range tasks {
		if existing.ID == t.ID {
			t.CreatedAt = existing.CreatedAt
			t.UpdatedAt = now
			tasks[i] = t
			return s.writeJSON(s.tasksPath(), tasks)
		}
	}

	t.CreatedAt = now
	t.UpdatedAt = now
	tasks = append(tasks, t)
	return s.writeJSON(s.tasksPath(), tasks)
}

func (s *Store) DeleteTask(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var tasks []models.Task
	s.readJSON(s.tasksPath(), &tasks)

	for i, t := range tasks {
		if t.ID == id {
			tasks = append(tasks[:i], tasks[i+1:]...)
			return s.writeJSON(s.tasksPath(), tasks)
		}
	}
	return fmt.Errorf("任务不存在: %s", id)
}

// Knowledge

func (s *Store) ListKnowledge(search, itemType, tag string) ([]models.KnowledgeItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var items []models.KnowledgeItem
	s.readJSON(s.knowledgePath(), &items)

	result := make([]models.KnowledgeItem, 0)
	for _, item := range items {
		if itemType != "" && item.Type != itemType {
			continue
		}
		if search != "" {
			lower := strings.ToLower(search)
			if !strings.Contains(strings.ToLower(item.Title), lower) &&
				!strings.Contains(strings.ToLower(item.Content), lower) {
				continue
			}
		}
		if tag != "" {
			found := false
			for _, t := range item.Tags {
				if t == tag {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		result = append(result, item)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})

	return result, nil
}

func (s *Store) GetKnowledge(id string) (*models.KnowledgeItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var items []models.KnowledgeItem
	s.readJSON(s.knowledgePath(), &items)

	for _, item := range items {
		if item.ID == id {
			return &item, nil
		}
	}
	return nil, fmt.Errorf("知识片段不存在: %s", id)
}

func (s *Store) SaveKnowledge(item models.KnowledgeItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var items []models.KnowledgeItem
	s.readJSON(s.knowledgePath(), &items)

	now := time.Now()
	for i, existing := range items {
		if existing.ID == item.ID {
			item.CreatedAt = existing.CreatedAt
			item.UpdatedAt = now
			items[i] = item
			return s.writeJSON(s.knowledgePath(), items)
		}
	}

	item.CreatedAt = now
	item.UpdatedAt = now
	items = append(items, item)
	return s.writeJSON(s.knowledgePath(), items)
}

func (s *Store) DeleteKnowledge(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var items []models.KnowledgeItem
	s.readJSON(s.knowledgePath(), &items)

	for i, item := range items {
		if item.ID == id {
			items = append(items[:i], items[i+1:]...)
			return s.writeJSON(s.knowledgePath(), items)
		}
	}
	return fmt.Errorf("知识片段不存在: %s", id)
}

func (s *Store) SaveAllReminders(reminders []models.ReminderTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.writeJSON(s.remindersPath(), reminders)
}

// Extended settings with SMTP and reminders

func (s *Store) GetFullSettings() (*models.FullSettings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var settings models.FullSettings
	if err := s.readJSON(s.settingsPath(), &settings); err != nil {
		return nil, err
	}
	if settings.AI.Provider == "" {
		settings.AI = models.AISettings{
			Provider: "deepseek",
			BaseURL:  "https://api.deepseek.com",
			Model:    "deepseek-chat",
		}
	}
	return &settings, nil
}

func (s *Store) SaveFullSettings(settings *models.FullSettings) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.writeJSON(s.settingsPath(), settings)
}
