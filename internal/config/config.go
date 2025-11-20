package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config aggregates runtime configuration for the Anthology services.
type Config struct {
	Environment       string
	HTTPPort          int
	DatabaseURL       string
	DataStore         string
	LogLevel          string
	AllowedOrigins    []string
	APIToken          string
	GoogleBooksAPIKey string
}

// Load reads configuration from environment variables with sensible defaults for local development.
func Load() (Config, error) {
	databaseURL, err := getEnvOrFile("DATABASE_URL", "/run/secrets/anthology_database_url")
	if err != nil {
		return Config{}, err
	}

	apiToken, err := getEnvOrFile("API_TOKEN", "/run/secrets/anthology_api_token")
	if err != nil {
		return Config{}, err
	}

	googleBooksAPIKey, err := getEnvOrFile("GOOGLE_BOOKS_API_KEY", "/run/secrets/anthology_google_books_api_key")
	if err != nil {
		return Config{}, err
	}

	cfg := Config{
		Environment:       getEnv("APP_ENV", "development"),
		DatabaseURL:       databaseURL,
		DataStore:         strings.ToLower(getEnv("DATA_STORE", "memory")),
		LogLevel:          strings.ToLower(getEnv("LOG_LEVEL", "info")),
		AllowedOrigins:    parseCSV(getEnv("ALLOWED_ORIGINS", "http://localhost:4200,http://localhost:8080")),
		APIToken:          strings.TrimSpace(apiToken),
		GoogleBooksAPIKey: strings.TrimSpace(googleBooksAPIKey),
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

	if !strings.EqualFold(cfg.Environment, "development") && cfg.APIToken == "" {
		return Config{}, fmt.Errorf("API_TOKEN is required when APP_ENV=%s", cfg.Environment)
	}

	if cfg.GoogleBooksAPIKey == "" {
		return Config{}, fmt.Errorf("GOOGLE_BOOKS_API_KEY is required")
	}

	allowedOrigins, err := sanitizeAllowedOrigins(cfg.AllowedOrigins, cfg.Environment)
	if err != nil {
		return Config{}, err
	}
	cfg.AllowedOrigins = allowedOrigins

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

func sanitizeAllowedOrigins(origins []string, env string) ([]string, error) {
	cleaned := make([]string, 0, len(origins))
	seen := make(map[string]struct{}, len(origins))
	for _, origin := range enumerateOrigins(origins) {
		if strings.Contains(origin.value, "*") && !strings.EqualFold(env, "development") {
			return nil, fmt.Errorf("ALLOWED_ORIGINS cannot contain wildcard %q when APP_ENV=%s", origin.value, env)
		}

		if _, exists := seen[origin.key]; exists {
			continue
		}

		cleaned = append(cleaned, origin.value)
		seen[origin.key] = struct{}{}
	}

	if len(cleaned) == 0 {
		return nil, fmt.Errorf("ALLOWED_ORIGINS must define at least one origin when APP_ENV=%s", env)
	}

	return cleaned, nil
}

type originEntry struct {
	value string
	key   string
}

func enumerateOrigins(origins []string) []originEntry {
	entries := make([]originEntry, 0, len(origins))
	for _, raw := range origins {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			continue
		}
		entries = append(entries, originEntry{
			value: trimmed,
			key:   strings.ToLower(trimmed),
		})
	}
	return entries
}

func getEnvOrFile(key, defaultPath string) (string, error) {
	if value := os.Getenv(key); value != "" {
		return value, nil
	}

	fileKey := key + "_FILE"
	if path := os.Getenv(fileKey); path != "" {
		return readSecret(path, fileKey)
	}

	if defaultPath != "" {
		return readSecret(defaultPath, key)
	}

	return "", nil
}

func readSecret(path, name string) (string, error) {
	contents, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", nil
		}
		return "", fmt.Errorf("config: reading %s (%s): %w", name, path, err)
	}

	value := strings.TrimSpace(string(contents))
	if value == "" {
		return "", fmt.Errorf("config: %s (%s) is empty", name, path)
	}
	return value, nil
}
