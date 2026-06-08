package services

import (
	"crypto/tls"
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
	return s.send(smtpCfg, toEmail, subject, body)
}

func (s *EmailService) SendTestEmail(smtpCfg models.SMTPConfig) error {
	subject := "[工作日报] SMTP 测试邮件"
	body := "这封邮件用于验证你的 SMTP 邮箱配置是否正确。\n\n如果你收到了这封邮件，说明配置成功了。"
	return s.send(smtpCfg, smtpCfg.Username, subject, body)
}

func (s *EmailService) send(smtpCfg models.SMTPConfig, toEmail, subject, body string) error {
	if smtpCfg.Host == "" || smtpCfg.Username == "" {
		return fmt.Errorf("SMTP 未配置：服务器地址和发件邮箱不能为空")
	}

	addr := fmt.Sprintf("%s:%d", smtpCfg.Host, smtpCfg.Port)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: =?UTF-8?B?%s?=\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		smtpCfg.Username, toEmail, encodeSubject(subject), body)

	auth := smtp.PlainAuth("", smtpCfg.Username, smtpCfg.Password, smtpCfg.Host)

	switch smtpCfg.Port {
	case 465:
		return s.sendWithSSL(addr, smtpCfg.Host, auth, smtpCfg.Username, toEmail, msg)
	default:
		return smtp.SendMail(addr, auth, smtpCfg.Username, []string{toEmail}, []byte(msg))
	}
}

func (s *EmailService) sendWithSSL(addr, host string, auth smtp.Auth, from, to, msg string) error {
	tlsConfig := &tls.Config{
		ServerName:         host,
		InsecureSkipVerify: false,
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("TLS 连接失败: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("SMTP 客户端创建失败: %w", err)
	}
	defer client.Quit()

	if auth != nil {
		if err = client.Auth(auth); err != nil {
			return fmt.Errorf("SMTP 认证失败: %w", err)
		}
	}

	if err = client.Mail(from); err != nil {
		return fmt.Errorf("发件人设置失败: %w", err)
	}
	if err = client.Rcpt(to); err != nil {
		return fmt.Errorf("收件人设置失败: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("邮件数据发送失败: %w", err)
	}
	_, err = w.Write([]byte(msg))
	if err != nil {
		return fmt.Errorf("邮件写入失败: %w", err)
	}
	err = w.Close()
	if err != nil {
		return fmt.Errorf("邮件关闭失败: %w", err)
	}

	return nil
}

func encodeSubject(s string) string {
	return b64Encode([]byte(s))
}

func b64Encode(data []byte) string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	var result string
	for i := 0; i < len(data); i += 3 {
		var b [3]byte
		var rem int
		for j := 0; j < 3; j++ {
			if i+j < len(data) {
				b[j] = data[i+j]
				rem++
			}
		}
		result += string(alphabet[b[0]>>2])
		if rem >= 1 {
			result += string(alphabet[((b[0]&3)<<4)|(b[1]>>4)])
		} else {
			result += string(alphabet[(b[0]&3)<<4]) + "="
		}
		if rem >= 2 {
			result += string(alphabet[((b[1]&15)<<2)|(b[2]>>6)])
		} else if rem >= 1 {
			result += string(alphabet[((b[1]&15)<<2)]) + "="
		}
		if rem >= 3 {
			result += string(alphabet[b[2]&63])
		} else {
			result += "="
		}
	}
	return result
}

func BuildReminderEmail(task models.ReminderTask) (subject, body string) {
	subject = fmt.Sprintf("【提醒】%s", task.Name)
	body = task.Message
	if !strings.Contains(body, task.Name) {
		body = fmt.Sprintf("%s\n\n—— %s", body, task.Name)
	}
	return
}
