package middleware

import (
	"context"
	"net/http"
	"strings"

	"report/backend/handlers"
)

var publicPaths = map[string]bool{
	"/api/v1/auth/login": true,
	"/api/v1/health":     true,
}

func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Check exact path match first, then prefix match
			if publicPaths[r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}

			auth := r.Header.Get("Authorization")
			if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"未登录"}`))
				return
			}

			email, err := handlers.ParseJWT(strings.TrimPrefix(auth, "Bearer "), jwtSecret)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"登录已过期，请重新登录"}`))
				return
			}

			ctx := context.WithValue(r.Context(), "email", email)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
