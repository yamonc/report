package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"report/backend/models"
	"report/backend/store"
)

type AuthHandler struct {
	store     *store.Store
	jwtSecret string
}

func NewAuthHandler(s *store.Store, jwtSecret string) *AuthHandler {
	return &AuthHandler{store: s, jwtSecret: jwtSecret}
}

func (h *AuthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch {
	case r.Method == http.MethodPost && r.URL.Path == "/api/v1/auth/login":
		h.login(w, r)
	case r.Method == http.MethodGet && r.URL.Path == "/api/v1/auth/me":
		h.me(w, r)
	case r.Method == http.MethodOptions:
		w.WriteHeader(http.StatusOK)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func (h *AuthHandler) login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求格式错误"})
		return
	}

	req.Email = strings.TrimSpace(req.Email)

	if !emailRegex.MatchString(req.Email) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "邮箱格式不正确"})
		return
	}
	if len(req.Password) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "密码不能为空"})
		return
	}

	user, err := h.store.GetUser(req.Email)
	if err != nil {
		// Auto-register
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "注册失败"})
			return
		}
		user = &models.User{
			Email:        req.Email,
			PasswordHash: string(hash),
			CreatedAt:    time.Now(),
		}
		if err := h.store.SaveUser(*user); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "注册失败"})
			return
		}
	} else {
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "密码错误"})
			return
		}
	}

	token, err := GenerateJWT(user.Email, h.jwtSecret)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "生成令牌失败"})
		return
	}

	// Don't expose password hash
	user.PasswordHash = ""
	writeJSON(w, http.StatusOK, models.LoginResp{Token: token, User: *user})
}

func (h *AuthHandler) me(w http.ResponseWriter, r *http.Request) {
	email := r.Context().Value("email").(string)
	user, err := h.store.GetUser(email)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "用户不存在"})
		return
	}
	user.PasswordHash = ""
	writeJSON(w, http.StatusOK, user)
}
