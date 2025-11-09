package config

import (
	"strings"
	"testing"
)

func TestLoadAllowsEmptyTokenInDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("DATA_STORE", "memory")
	t.Setenv("PORT", "8080")
	t.Setenv("API_TOKEN", "")
	t.Setenv("API_TOKEN_FILE", "")
	t.Setenv("DATABASE_URL", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	if cfg.APIToken != "" {
		t.Fatalf("expected no API token in development, got %q", cfg.APIToken)
	}
}

func TestLoadRequiresTokenOutsideDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATA_STORE", "memory")
	t.Setenv("PORT", "8080")
	t.Setenv("API_TOKEN", "")
	t.Setenv("API_TOKEN_FILE", "")
	t.Setenv("DATABASE_URL", "")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when API token missing outside development")
	}
	if !strings.Contains(err.Error(), "API_TOKEN is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadAcceptsTokenOutsideDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATA_STORE", "memory")
	t.Setenv("PORT", "8080")
	t.Setenv("API_TOKEN", "super-secret")
	t.Setenv("DATABASE_URL", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}
	if cfg.APIToken != "super-secret" {
		t.Fatalf("expected API token to be preserved, got %q", cfg.APIToken)
	}
}
