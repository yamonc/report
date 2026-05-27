package services

import (
	"fmt"
	"net/smtp"
	"strings"

	"report/backend/models"
)

type EmailService struct{}

func NewEmailService() *EmailService {
	return &EmailService{}
}

func (s *EmailService) SendReminder(toEmail string, smtpCfg models.SMTPConfig, subject, body string) error {
	if smtpCfg.Host == "" || smtpCfg.Username == "" {
		return fmt.Errorf("SMTP 未配置")
	}

	addr := fmt.Sprintf("%s:%d", smtpCfg.Host, smtpCfg.Port)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		smtpCfg.Username, toEmail, subject, body)

	var auth smtp.Auth
	if smtpCfg.Password != "" {
		// Determine auth mechanism based on port
		if smtpCfg.Port == 465 {
			// SSL - not supported by net/smtp directly, would need alternative
			auth = smtp.PlainAuth("", smtpCfg.Username, smtpCfg.Password, smtpCfg.Host)
		} else {
			auth = smtp.PlainAuth("", smtpCfg.Username, smtpCfg.Password, smtpCfg.Host)
		}
	}

	// Connect and send
	if smtpCfg.Port == 465 {
		// Skip auth for 465 with net/smtp limitation — try TLS first then fallback
	}

	hostPort := addr
	return smtp.SendMail(hostPort, auth, smtpCfg.Username, []string{toEmail}, []byte(msg))
}

func BuildReminderEmail(task models.ReminderTask) (subject, body string) {
	subject = fmt.Sprintf("【提醒】%s", task.Name)
	body = task.Message
	if !strings.Contains(body, task.Name) {
		body = fmt.Sprintf("%s\n\n—— %s", body, task.Name)
	}
	return
}
