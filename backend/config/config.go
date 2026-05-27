package config

import "os"

type Config struct {
	Port            string
	DBPath          string
	DeepSeekAPIKey  string
	DeepSeekBaseURL string
	JWTSecret       string
}

func Load() *Config {
	return &Config{
		Port:            getEnv("PORT", "8080"),
		DBPath:          getEnv("DB_PATH", "./data"),
		DeepSeekAPIKey:  getEnv("DEEPSEEK_API_KEY", ""),
		DeepSeekBaseURL: getEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
		JWTSecret:       getEnv("JWT_SECRET", "report-jwt-secret"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
