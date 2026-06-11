package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"report/backend/models"
	"report/backend/store"
)

type DailyReportHandler struct {
	store *store.Store
}

func NewDailyReportHandler(s *store.Store) *DailyReportHandler {
	return &DailyReportHandler{store: s}
}

func (h *DailyReportHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// /api/v1/daily-reports/xxx or /api/v1/daily-reports
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/daily-reports")
	path = strings.TrimPrefix(path, "/")

	switch r.Method {
	case http.MethodPost:
		if path == "import" {
			h.importReports(w, r)
		} else {
			h.create(w, r)
		}
	case http.MethodGet:
		if path == "export" {
			h.exportReports(w, r)
		} else if path == "" {
			h.list(w, r)
		} else {
			h.getByDate(w, r, path)
		}
	case http.MethodPut:
		if path != "" {
			h.update(w, r, path)
		} else {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "date required"})
		}
	case http.MethodDelete:
		if path != "" {
			h.delete(w, r, path)
		} else {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "date required"})
		}
	case http.MethodOptions:
		w.WriteHeader(http.StatusOK)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *DailyReportHandler) create(w http.ResponseWriter, r *http.Request) {
	var req models.DailyReportReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if req.Date == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "日期不能为空"})
		return
	}

	report := models.DailyReport{Date: req.Date, Content: req.Content}
	if err := h.store.SaveDailyReport(report); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetDailyReport(req.Date)
	writeJSON(w, http.StatusCreated, saved)
}

func (h *DailyReportHandler) getByDate(w http.ResponseWriter, r *http.Request, date string) {
	report, err := h.store.GetDailyReport(date)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "日报不存在"})
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (h *DailyReportHandler) update(w http.ResponseWriter, r *http.Request, date string) {
	var req models.DailyReportReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}

	report := models.DailyReport{Date: date, Content: req.Content}
	if err := h.store.SaveDailyReport(report); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	saved, _ := h.store.GetDailyReport(date)
	writeJSON(w, http.StatusOK, saved)
}

func (h *DailyReportHandler) delete(w http.ResponseWriter, r *http.Request, date string) {
	if err := h.store.DeleteDailyReport(date); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *DailyReportHandler) list(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	reports, err := h.store.ListDailyReports(from, to)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, reports)
}

// ============ Import/Export ============

func (h *DailyReportHandler) exportReports(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	reports, err := h.store.ListDailyReports(from, to)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Build markdown content with month header
	var sb strings.Builder
	var currentMonth string

	for _, report := range reports {
		// Extract YYYY, MM, DD from date (YYYY-MM-DD)
		parts := strings.Split(report.Date, "-")
		if len(parts) != 3 {
			continue
		}
		year, month, day := parts[0], parts[1], parts[2]

		// Add month header if new month
		monthKey := year + "-" + month
		if monthKey != currentMonth {
			currentMonth = monthKey
			monthNum := month
			if len(monthNum) == 2 && monthNum[0] == '0' {
				monthNum = monthNum[1:]
			}
			sb.WriteString("# " + monthNum + "月\n\n")
		}

		// Write date and content
		sb.WriteString("## " + month + day + "\n\n")
		sb.WriteString(report.Content + "\n\n")
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(sb.String()))
}

type ImportReq struct {
	Content string `json:"content"`
	Year    int    `json:"year"`
}

func (h *DailyReportHandler) importReports(w http.ResponseWriter, r *http.Request) {
	var req ImportReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}
	if req.Content == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "内容不能为空"})
		return
	}
	if req.Year == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "年份不能为空"})
		return
	}

	// Parse markdown and extract reports
	reports := parseMarkdownReports(req.Content, req.Year)
	if len(reports) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "未找到有效的日报内容"})
		return
	}

	// Batch save
	if err := h.store.SaveDailyReportsBatch(reports); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "ok",
		"count":  len(reports),
	})
}

// parseMarkdownReports parses markdown content and extracts daily reports.
// Format: # X月 (month header, optional) + ## MMDD (date header) followed by content
func parseMarkdownReports(content string, year int) []models.DailyReport {
	var reports []models.DailyReport

	// Match date headers like ## 0104 (MMDD format) - must be exactly 2 hashes
	datePattern := regexp.MustCompile(`^##\s*(\d{4})\s*$`)

	scanner := bufio.NewScanner(strings.NewReader(content))
	var currentDate string
	var currentContent strings.Builder

	for scanner.Scan() {
		line := scanner.Text()
		matches := datePattern.FindStringSubmatch(line)

		if matches != nil {
			// Save previous report if exists
			if currentDate != "" {
				c := strings.TrimSpace(currentContent.String())
				if c != "" {
					reports = append(reports, models.DailyReport{
						Date:    currentDate,
						Content: c,
					})
				}
			}

			// Parse new date: MMDD -> YYYY-MM-DD
			mmdd := matches[1]
			if len(mmdd) == 4 {
				month := mmdd[:2]
				day := mmdd[2:]
				currentDate = fmt.Sprintf("%d-%s-%s", year, month, day)
			} else {
				currentDate = ""
			}
			currentContent.Reset()
		} else if currentDate != "" {
			// Accumulate content for current date
			if currentContent.Len() > 0 {
				currentContent.WriteString("\n")
			}
			currentContent.WriteString(line)
		}
	}

	// Save last report
	if currentDate != "" {
		c := strings.TrimSpace(currentContent.String())
		if c != "" {
			reports = append(reports, models.DailyReport{
				Date:    currentDate,
				Content: c,
			})
		}
	}

	return reports
}
