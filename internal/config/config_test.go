package config

import (
	"strings"
	"testing"
)

func TestLoadRequiresDatabaseURL(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_EMAILS", "test@example.com")
	t.Setenv("DATABASE_URL", "")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when DATABASE_URL is missing")
	}
	if !strings.Contains(err.Error(), "DATABASE_URL is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadRequiresOAuthClientID(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_EMAILS", "test@example.com")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when OAuth client ID is missing")
	}
	if !strings.Contains(err.Error(), "AUTH_GOOGLE_CLIENT_ID is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadRequiresOAuthClientSecret(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "")
	t.Setenv("AUTH_GOOGLE_ALLOWED_EMAILS", "test@example.com")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when OAuth client secret is missing")
	}
	if !strings.Contains(err.Error(), "AUTH_GOOGLE_CLIENT_SECRET is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadRequiresAllowlist(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_DOMAINS", "")
	t.Setenv("AUTH_GOOGLE_ALLOWED_EMAILS", "")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when allowlist is missing")
	}
	if !strings.Contains(err.Error(), "AUTH_GOOGLE_ALLOWED_DOMAINS or AUTH_GOOGLE_ALLOWED_EMAILS is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadAcceptsValidConfig(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_DOMAINS", "example.com")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}
	if cfg.GoogleClientID != "client-id" {
		t.Fatalf("expected Google client ID to be preserved, got %q", cfg.GoogleClientID)
	}
	if cfg.DatabaseURL != "postgres://localhost/test" {
		t.Fatalf("expected database URL to be preserved, got %q", cfg.DatabaseURL)
	}
}

func TestLoadRejectsWildcardOriginsOutsideDevelopment(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_DOMAINS", "example.com")
	t.Setenv("ALLOWED_ORIGINS", "https://example.com,*")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

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
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_DOMAINS", "example.com")
	t.Setenv("ALLOWED_ORIGINS", "   ")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when ALLOWED_ORIGINS is empty")
	}
	if !strings.Contains(err.Error(), "must define at least one origin") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadDefaultsToProduction(t *testing.T) {
	t.Setenv("APP_ENV", "")
	t.Setenv("PORT", "8080")
	t.Setenv("GOOGLE_BOOKS_API_KEY", "test-key")
	t.Setenv("AUTH_GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("AUTH_GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("AUTH_GOOGLE_ALLOWED_DOMAINS", "example.com")
	t.Setenv("ALLOWED_ORIGINS", "https://example.com")
	t.Setenv("DATABASE_URL", "postgres://localhost/test")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}
	if cfg.Environment != "production" {
		t.Fatalf("expected APP_ENV to default to production, got %q", cfg.Environment)
	}
}
