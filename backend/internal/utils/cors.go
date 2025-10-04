package utils

import (
	"os"
	"strings"
)

func GetAllowedOrigins() []string {
	allowedOriginsEnv := os.Getenv("CORS_ALLOWED_ORIGINS")

	// Default to allow all
	if allowedOriginsEnv == "" || allowedOriginsEnv == "*" {
		return []string{"*"}
	}

	// Parse and trim origins
	origins := strings.Split(allowedOriginsEnv, ",")
	for i, origin := range origins {
		origins[i] = strings.TrimSpace(origin)
	}

	return origins
}

func IsOriginAllowed(origin string, allowedOrigins []string) bool {
	// If no origin header, allow (same-origin request)
	if origin == "" {
		return true
	}

	// Check if wildcard is present
	for _, allowed := range allowedOrigins {
		if allowed == "*" {
			return true
		}
		if allowed == origin {
			return true
		}
	}

	return false
}
