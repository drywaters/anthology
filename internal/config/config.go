package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config aggregates runtime configuration for the Anthology services.
type Config struct {
	Environment    string
	HTTPPort       int
	DatabaseURL    string
	DataStore      string
	LogLevel       string
	AllowedOrigins []string
	APIToken       string
}

// Load reads configuration from environment variables with sensible defaults for local development.
func Load() (Config, error) {
	cfg := Config{
		Environment:    getEnv("APP_ENV", "development"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		DataStore:      strings.ToLower(getEnv("DATA_STORE", "memory")),
		LogLevel:       strings.ToLower(getEnv("LOG_LEVEL", "info")),
		AllowedOrigins: parseCSV(getEnv("ALLOWED_ORIGINS", "http://localhost:4200,http://localhost:8080")),
		APIToken:       strings.TrimSpace(getEnv("API_TOKEN", "")),
	}

	portValue := getEnv("PORT", getEnv("HTTP_PORT", "8080"))
	port, err := strconv.Atoi(portValue)
	if err != nil {
		return Config{}, fmt.Errorf("invalid port %q: %w", portValue, err)
	}
	cfg.HTTPPort = port

	if cfg.DataStore == "postgres" && cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATA_STORE is postgres but DATABASE_URL is not set")
	}

	return cfg, nil
}

// HTTPAddress returns the address the HTTP server should bind to.
func (c Config) HTTPAddress() string {
	return fmt.Sprintf(":%d", c.HTTPPort)
}

// UseInMemoryStore returns true if the in-memory repository should be used.
func (c Config) UseInMemoryStore() bool {
	return c.DataStore == "memory"
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func parseCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
