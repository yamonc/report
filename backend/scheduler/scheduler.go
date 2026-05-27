package scheduler

import (
	"log"
	"sync"
	"time"

	"report/backend/services"
	"report/backend/store"
)

type Scheduler struct {
	store     *store.Store
	emailSvc  *services.EmailService
	stopCh    chan struct{}
	triggered map[string]string // taskID -> "2006-01-02"
	mu        sync.Mutex
}

func New(store *store.Store, emailSvc *services.EmailService) *Scheduler {
	return &Scheduler{
		store:     store,
		emailSvc:  emailSvc,
		stopCh:    make(chan struct{}),
		triggered: make(map[string]string),
	}
}

func (s *Scheduler) Start() {
	log.Println("[Scheduler] Started — checking reminders every minute")
	ticker := time.NewTicker(60 * time.Second)

	for {
		select {
		case <-s.stopCh:
			ticker.Stop()
			log.Println("[Scheduler] Stopped")
			return
		case t := <-ticker.C:
			s.checkAndSend(t)
		}
	}
}

func (s *Scheduler) Stop() {
	close(s.stopCh)
}

func (s *Scheduler) checkAndSend(now time.Time) {
	reminders, err := s.store.ListReminders()
	if err != nil {
		log.Printf("[Scheduler] Failed to list reminders: %v", err)
		return
	}

	settings, err := s.store.GetFullSettings()
	if err != nil {
		log.Printf("[Scheduler] Failed to get settings: %v", err)
		return
	}

	if settings.SMTP.Host == "" {
		return // SMTP not configured, skip
	}

	currentTime := now.Format("15:04")
	currentDate := now.Format("2006-01-02")
	currentWeekday := int(now.Weekday())

	for _, task := range reminders {
		if !task.Enabled {
			continue
		}

		// Time match (within same minute)
		if task.Time != currentTime {
			continue
		}

		// Schedule type match
		if task.ScheduleType == "weekly" && task.Weekday != currentWeekday {
			continue
		}

		// Dedup: same task won't trigger twice on same day
		s.mu.Lock()
		lastDate := s.triggered[task.ID]
		if lastDate == currentDate {
			s.mu.Unlock()
			continue
		}
		s.triggered[task.ID] = currentDate
		s.mu.Unlock()

		// Get user email from users (first user in store)
		subject, body := services.BuildReminderEmail(task)

		// The user email should come from the authenticated context.
		// For now, we find the first user in the store.
		userEmail := s.getPrimaryUserEmail()
		if userEmail == "" {
			log.Println("[Scheduler] No user found, skipping email")
			continue
		}

		if err := s.emailSvc.SendReminder(userEmail, settings.SMTP, subject, body); err != nil {
			log.Printf("[Scheduler] Failed to send reminder %q to %s: %v", task.Name, userEmail, err)
		} else {
			log.Printf("[Scheduler] Sent reminder %q to %s", task.Name, userEmail)
		}
	}
}

func (s *Scheduler) getPrimaryUserEmail() string {
	settings, err := s.store.GetFullSettings()
	if err != nil {
		return ""
	}
	if settings.SMTP.Username != "" {
		return settings.SMTP.Username
	}
	return ""
}
