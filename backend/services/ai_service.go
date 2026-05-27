package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"report/backend/config"
	"report/backend/models"
	"report/backend/store"
)

type AIService struct {
	cfg        *config.Config
	store      *store.Store
	httpClient *http.Client
}

func NewAIService(cfg *config.Config, s *store.Store) *AIService {
	return &AIService{
		cfg:        cfg,
		store:      s,
		httpClient: &http.Client{Timeout: 120 * time.Second},
	}
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
	MaxTokens   int           `json:"max_tokens"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

func (s *AIService) GenerateWeeklyReport(weekStart, weekEnd string) (*models.WeeklyReport, error) {
	existing, err := s.store.FindWeeklyByWeek(weekStart, weekEnd)
	if err == nil {
		return existing, nil
	}

	reports, err := s.store.ListDailyReports(weekStart, weekEnd)
	if err != nil {
		return nil, fmt.Errorf("获取日报失败: %w", err)
	}
	if len(reports) == 0 {
		return nil, fmt.Errorf("该周没有日报记录，请先填写日报")
	}

	var dailyContent strings.Builder
	for _, r := range reports {
		dailyContent.WriteString(fmt.Sprintf("## %s\n\n%s\n\n---\n\n", r.Date, r.Content))
	}

	systemPrompt := "你是一个专业的工作周报生成助手。根据用户提供的每日日报内容，生成一份结构清晰、语言简洁的周报。周报应包含：本周工作概述、重点工作内容、遇到的问题及解决方案、下周工作计划。请使用 Markdown 格式输出。"
	userPrompt := fmt.Sprintf("请根据以下日报内容，生成一份周报（周范围：%s 至 %s）：\n\n%s", weekStart, weekEnd, dailyContent.String())

	aiContent, err := s.callDeepSeek(systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("AI 生成失败: %w", err)
	}

	id := fmt.Sprintf("%s_%s", weekStart, weekEnd)
	report := &models.WeeklyReport{
		ID:        id,
		WeekStart: weekStart,
		WeekEnd:   weekEnd,
		Content:   aiContent,
		Status:    "draft",
	}
	if err := s.store.SaveWeeklyReport(*report); err != nil {
		return nil, fmt.Errorf("保存周报失败: %w", err)
	}
	return report, nil
}

func (s *AIService) callDeepSeek(systemPrompt, userPrompt string) (string, error) {
	model := "deepseek-chat"
	baseURL := s.cfg.DeepSeekBaseURL
	apiKey := s.cfg.DeepSeekAPIKey

	if settings, err := s.store.GetFullSettings(); err == nil && settings.AI.BaseURL != "" {
		if settings.AI.Model != "" {
			model = settings.AI.Model
		}
		if settings.AI.BaseURL != "" {
			baseURL = settings.AI.BaseURL
		}
		if settings.AI.APIKey != "" {
			apiKey = settings.AI.APIKey
		}
	}

	reqBody := chatRequest{
		Model: model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: 0.7,
		MaxTokens:   4000,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	url := baseURL + "/v1/chat/completions"
	req, err := http.NewRequest("POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("API 请求失败: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API 返回错误 (%d): %s", resp.StatusCode, string(respBytes))
	}

	var chatResp chatResponse
	if err := json.Unmarshal(respBytes, &chatResp); err != nil {
		return "", err
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("AI 未返回任何内容")
	}

	return chatResp.Choices[0].Message.Content, nil
}
