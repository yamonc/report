package models

import "time"

type DailyReport struct {
	Date      string    `json:"date"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type WeeklyReport struct {
	ID        string    `json:"id"`
	WeekStart string    `json:"week_start"`
	WeekEnd   string    `json:"week_end"`
	Content   string    `json:"content"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type DailyReportReq struct {
	Date    string `json:"date"`
	Content string `json:"content"`
}

type GenerateReq struct {
	WeekStart string `json:"week_start"`
	WeekEnd   string `json:"week_end"`
}

type UpdateWeeklyReq struct {
	Content string `json:"content"`
	Status  string `json:"status"`
}

type AISettings struct {
	Provider string `json:"provider"`
	BaseURL  string `json:"base_url"`
	APIKey   string `json:"api_key"`
	Model    string `json:"model"`
}

type User struct {
	Email        string    `json:"email"`
	PasswordHash string    `json:"password_hash"`
	CreatedAt    time.Time `json:"created_at"`
}

type LoginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResp struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type ReminderTask struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Enabled      bool      `json:"enabled"`
	ScheduleType string    `json:"schedule_type"`
	Time         string    `json:"time"`
	Weekday      int       `json:"weekday"`
	Message      string    `json:"message"`
	CreatedAt    time.Time `json:"created_at"`
}

type UpdateReminderReq struct {
	Name         *string `json:"name,omitempty"`
	Enabled      *bool   `json:"enabled,omitempty"`
	ScheduleType *string `json:"schedule_type,omitempty"`
	Time         *string `json:"time,omitempty"`
	Weekday      *int    `json:"weekday,omitempty"`
	Message      *string `json:"message,omitempty"`
}

type SMTPConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type FullSettings struct {
	AI      AISettings     `json:"ai"`
	SMTP    SMTPConfig     `json:"smtp"`
	Reminders []ReminderTask `json:"reminders"`
}

type Task struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	Priority    string    `json:"priority"`
	Category    string    `json:"category"`
	DueDate     string    `json:"due_date"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TaskReq struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"`
	Priority    string `json:"priority"`
	Category    string `json:"category"`
	DueDate     string `json:"due_date"`
}

type TaskStatusReq struct {
	Status string `json:"status"`
}

type KnowledgeItem struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Type      string    `json:"type"`
	Content   string    `json:"content"`
	SourceURL string    `json:"source_url"`
	Tags      []string  `json:"tags"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type KnowledgeReq struct {
	Title     string   `json:"title"`
	Type      string   `json:"type"`
	Content   string   `json:"content"`
	SourceURL string   `json:"source_url"`
	Tags      []string `json:"tags"`
}

type Template struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Fields    []string  `json:"fields"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TemplateReq struct {
	Name   string   `json:"name"`
	Fields []string `json:"fields"`
}

// ============ Quick Notes ============

type QuickNote struct {
	ID         string    `json:"id"`
	Content    string    `json:"content"`
	Tags       []string  `json:"tags"`
	Source     string    `json:"source"`
	Status     string    `json:"status"`
	ArchivedTo string    `json:"archived_to"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type CreateQuickNoteReq struct {
	Content string   `json:"content"`
	Tags    []string `json:"tags"`
	Source  string   `json:"source"`
}

type UpdateQuickNoteReq struct {
	Content *string   `json:"content,omitempty"`
	Tags    *[]string `json:"tags,omitempty"`
	Source  *string   `json:"source,omitempty"`
}

type SearchQuickNotesReq struct {
	Query string `json:"query"`
}

type SearchResultItem struct {
	ID          string   `json:"id"`
	Content     string   `json:"content"`
	Tags        []string `json:"tags"`
	Score       int      `json:"score"`
	MatchReason string   `json:"match_reason"`
	CreatedAt   string   `json:"created_at"`
}

type ArchiveQuickNoteReq struct {
	Title string   `json:"title"`
	Type  string   `json:"type"`
	Tags  []string `json:"tags"`
}

func DefaultReminders() []ReminderTask {
	now := time.Now()
	return []ReminderTask{
		{
			ID:           "default-daily-report",
			Name:         "填写日报",
			Enabled:      true,
			ScheduleType: "daily",
			Time:         "18:00",
			Weekday:      0,
			Message:      "该填写今天的日报啦，记得记录今日工作内容。",
			CreatedAt:    now,
		},
		{
			ID:           "default-weekly-report",
			Name:         "填写周报",
			Enabled:      true,
			ScheduleType: "weekly",
			Time:         "17:00",
			Weekday:      5,
			Message:      "该填写本周周报啦，记得总结本周工作内容。",
			CreatedAt:    now,
		},
	}
}
