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

// DiagnoseSMTPError translates common SMTP errors into actionable Chinese messages.
func DiagnoseSMTPError(err error) string {
	msg := err.Error()
	lower := strings.ToLower(msg)

	switch {
	case strings.Contains(lower, "535") && strings.Contains(lower, "login fail"):
		return "SMTP 认证失败（错误码 535）。常见原因：\n" +
			"• QQ邮箱：必须使用「授权码」而非 QQ 密码。请登录 QQ邮箱 → 设置 → 账户 → POP3/SMTP 服务 → 生成授权码\n" +
			"• 163邮箱：同样需要授权码，在邮箱设置中开启 SMTP 并获取\n" +
			"• Gmail：需要开启两步验证后生成应用专用密码"

	case strings.Contains(lower, "530"):
		return "SMTP 认证失败（错误码 530）。可能需要：\n" +
			"• 确认邮箱已开启 SMTP 服务\n" +
			"• 使用授权码而非登录密码"

	case strings.Contains(lower, "550"):
		return "邮件被拒收（错误码 550）。可能原因：\n" +
			"• 收件地址不存在\n" +
			"• 发件人邮箱未通过验证\n" +
			"• 邮件内容被判定为垃圾邮件"

	case strings.Contains(lower, "554"):
		return "邮件被拒绝（错误码 554）。可能原因：\n" +
			"• 发送频率过高被限制\n" +
			"• 邮件内容触发安全策略"

	case strings.Contains(lower, "tls"):
		return "TLS/SSL 连接失败。请检查端口配置：\n" +
			"• 端口 587 → 使用 STARTTLS（推荐）\n" +
			"• 端口 465 → 使用 SSL 直连\n" +
			"• 端口 25  → 无加密（不推荐）"

	case strings.Contains(lower, "timeout") || strings.Contains(lower, "deadline"):
		return "连接 SMTP 服务器超时，请检查：\n" +
			"• 服务器地址是否正确\n" +
			"• 端口号是否正确\n" +
			"• 网络是否能访问该服务器"

	case strings.Contains(lower, "connection refused"):
		return "SMTP 服务器拒绝连接，请检查端口号是否正确（常见：587 或 465）"

	case strings.Contains(lower, "no such host") || strings.Contains(lower, "dns"):
		return "无法解析 SMTP 服务器地址，请检查服务器域名是否正确"

	default:
		return "发送失败: " + msg
	}
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
