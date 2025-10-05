package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Auth     AuthConfig
	Upload   UploadConfig
	CORS     CORSConfig
	Calendar CalendarConfig
	Logging  LoggingConfig
}

type ServerConfig struct {
	Host         string
	Port         int
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

type DatabaseConfig struct {
	URL             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

type AuthConfig struct {
	DeviceAPIKey       string
	TokenTTL           time.Duration
	RateLimitPerMinute float64
	RateLimitBurst     int
}

type UploadConfig struct {
	Path           string
	MaxMessageSize int64
}

type CORSConfig struct {
	AllowedOrigins []string
	MaxAge         int
}

type CalendarConfig struct {
	CredentialsPath string
	CalendarID      string
	SyncInterval    time.Duration
}

type LoggingConfig struct {
	Debug   bool
	LogFile string
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Host:         getEnv("SERVER_HOST", "0.0.0.0"),
			Port:         getEnvInt("SERVER_PORT", 8080),
			ReadTimeout:  getEnvDuration("SERVER_READ_TIMEOUT", 10*time.Second),
			WriteTimeout: getEnvDuration("SERVER_WRITE_TIMEOUT", 30*time.Second),
			IdleTimeout:  getEnvDuration("SERVER_IDLE_TIMEOUT", 1*time.Minute),
		},
		Database: DatabaseConfig{
			URL:             getEnv("DATABASE_URL", ""),
			MaxOpenConns:    getEnvInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getEnvInt("DB_MAX_IDLE_CONNS", 25),
			ConnMaxLifetime: getEnvDuration("DB_CONN_MAX_LIFETIME", 5*time.Minute),
		},
		Auth: AuthConfig{
			DeviceAPIKey:       getEnv("DEVICE_API_KEY", ""),
			TokenTTL:           getEnvDuration("TOKEN_TTL", 7*24*time.Hour),
			RateLimitPerMinute: getEnvFloat("RATE_LIMIT_PER_MINUTE", 10.0),
			RateLimitBurst:     getEnvInt("RATE_LIMIT_BURST", 5),
		},
		Upload: UploadConfig{
			Path:           getEnv("UPLOAD_PATH", "./uploads"),
			MaxMessageSize: getEnvInt64("MAX_MESSAGE_SIZE", 512*1024), // 512 KB
		},
		CORS: CORSConfig{
			AllowedOrigins: parseAllowedOrigins(getEnv("CORS_ALLOWED_ORIGINS", "*")),
			MaxAge:         getEnvInt("CORS_MAX_AGE", 300),
		},
		Calendar: CalendarConfig{
			CredentialsPath: getEnv("GOOGLE_CREDENTIALS_PATH", ""),
			CalendarID:      getEnv("GOOGLE_CALENDAR_ID", ""),
			SyncInterval:    getEnvDuration("CALENDAR_SYNC_INTERVAL", 1*time.Minute),
		},
		Logging: LoggingConfig{
			Debug:   getEnvBool("DEBUG", false),
			LogFile: getEnv("LOG_FILE", "app.log"),
		},
	}

	// Validate required fields
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.Database.URL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}

	if c.Auth.DeviceAPIKey == "" {
		return fmt.Errorf("DEVICE_API_KEY is required for device authentication")
	}

	if c.Server.Port < 1 || c.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", c.Server.Port)
	}

	if c.Calendar.CredentialsPath == "" {
		return fmt.Errorf("GOOGLE_CREDENTIALS_PATH is required for calendar integration")
	}

	if c.Calendar.CalendarID == "" {
		return fmt.Errorf("GOOGLE_CALENDAR_ID is required for calendar integration")
	}

	return nil
}

func (c *Config) GetServerAddress() string {
	return fmt.Sprintf("%s:%d", c.Server.Host, c.Server.Port)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

func parseAllowedOrigins(originsStr string) []string {
	if originsStr == "" || originsStr == "*" {
		return []string{"*"}
	}

	origins := strings.Split(originsStr, ",")
	for i, origin := range origins {
		origins[i] = strings.TrimSpace(origin)
	}

	return origins
}
