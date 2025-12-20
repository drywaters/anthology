package config

import (
	"strings"
	"testing"
)

func TestLoadAllowsEmptyOAuthInDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("DATA_STORE", "memory")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "")
	t.Setenv("DATABASE_URL", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	if cfg.GoogleClientID != "" {
		t.Fatalf("expected no Google client ID in development, got %q", cfg.GoogleClientID)
	}
}

func TestLoadRequiresOAuthOutsideDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATA_STORE", "memory")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("ALLOWED_ORIGINS", "https://example.com")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when OAuth config missing outside development")
	}
	if !strings.Contains(err.Error(), "AUTH_GOOGLE_CLIENT_ID is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadAcceptsOAuthOutsideDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATA_STORE", "memory")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_DOMAINS", "example.com")
	t.Setenv("ALLOWED_ORIGINS", "https://example.com")
	t.Setenv("DATABASE_URL", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}
	if cfg.GoogleClientID != "client-id" {
		t.Fatalf("expected Google client ID to be preserved, got %q", cfg.GoogleClientID)
	}
	if !cfg.OAuthEnabled() {
		t.Fatal("expected OAuthEnabled() to return true")
	}
}

func TestLoadRejectsWildcardOriginsOutsideDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATA_STORE", "memory")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_DOMAINS", "example.com")
	t.Setenv("ALLOWED_ORIGINS", "https://example.com,*")
	t.Setenv("DATABASE_URL", "")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when ALLOWED_ORIGINS contains wildcard")
	}
	if !strings.Contains(err.Error(), "cannot contain wildcard") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadRequiresAllowedOriginsOutsideDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATA_STORE", "memory")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_DOMAINS", "example.com")
	t.Setenv("ALLOWED_ORIGINS", "   ")
	t.Setenv("DATABASE_URL", "")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when ALLOWED_ORIGINS is empty")
	}
	if !strings.Contains(err.Error(), "must define at least one origin") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadRequiresAllowlistOutsideDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("DATA_STORE", "memory")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_DOMAINS", "")
	t.Setenv("AUTH_GOOGLE_ALLOWED_EMAILS", "")
	t.Setenv("ALLOWED_ORIGINS", "https://example.com")
	t.Setenv("DATABASE_URL", "")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when allowlist missing outside development")
	}
	if !strings.Contains(err.Error(), "AUTH_GOOGLE_ALLOWED_DOMAINS or AUTH_GOOGLE_ALLOWED_EMAILS is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadDefaultsToProductionWhenOAuthConfigured(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("DATA_STORE", "memory")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_DOMAINS", "example.com")
	t.Setenv("ALLOWED_ORIGINS", "https://example.com")
	t.Setenv("DATABASE_URL", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}
	if cfg.Environment != "production" {
		t.Fatalf("expected APP_ENV to default to production, got %q", cfg.Environment)
	}
}
