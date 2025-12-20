package auth

import (
	"net/url"
	"testing"

	"golang.org/x/oauth2"
)

func TestIsEmailAllowedByEmailAllowlist(t *testing.T) {
	authenticator := &GoogleAuthenticator{
		allowedEmails: map[string]struct{}{
			"test@example.com": {},
		},
		allowedDomains: map[string]struct{}{},
	}

	if !authenticator.IsEmailAllowed("Test@Example.com") {
		t.Fatal("expected email to be allowed")
	}
}

func TestIsEmailAllowedByDomainAllowlist(t *testing.T) {
	authenticator := &GoogleAuthenticator{
		allowedDomains: map[string]struct{}{
			"example.com": {},
		},
		allowedEmails: map[string]struct{}{},
	}

	if !authenticator.IsEmailAllowed("user@example.com") {
		t.Fatal("expected domain to be allowed")
	}
}

func TestIsEmailAllowedRejectsUnknown(t *testing.T) {
	authenticator := &GoogleAuthenticator{
		allowedDomains: map[string]struct{}{
			"example.com": {},
		},
		allowedEmails: map[string]struct{}{},
	}

	if authenticator.IsEmailAllowed("user@other.com") {
		t.Fatal("expected email to be rejected")
	}
}

func TestIsEmailAllowedAllowsAllWhenNoAllowlist(t *testing.T) {
	authenticator := &GoogleAuthenticator{
		allowedDomains: map[string]struct{}{},
		allowedEmails:  map[string]struct{}{},
	}

	if !authenticator.IsEmailAllowed("user@other.com") {
		t.Fatal("expected email to be allowed when no allowlist is configured")
	}
}

func TestHasAllowlist(t *testing.T) {
	authenticator := &GoogleAuthenticator{
		allowedDomains: map[string]struct{}{},
		allowedEmails:  map[string]struct{}{},
	}

	if authenticator.HasAllowlist() {
		t.Fatal("expected HasAllowlist to be false")
	}

	authenticator.allowedDomains["example.com"] = struct{}{}
	if !authenticator.HasAllowlist() {
		t.Fatal("expected HasAllowlist to be true")
	}
}

func TestGenerateState(t *testing.T) {
	state1, err := GenerateState()
	if err != nil {
		t.Fatalf("GenerateState returned error: %v", err)
	}
	state2, err := GenerateState()
	if err != nil {
		t.Fatalf("GenerateState returned error: %v", err)
	}
	if state1 == "" || state2 == "" {
		t.Fatal("expected non-empty state")
	}
	if state1 == state2 {
		t.Fatal("expected unique state values")
	}
}

func TestAuthURLIncludesPromptSelectAccount(t *testing.T) {
	authenticator := &GoogleAuthenticator{
		config: &oauth2.Config{
			ClientID:     "client-id",
			RedirectURL:  "http://localhost/callback",
			Endpoint:     oauth2.Endpoint{AuthURL: "https://auth.test/oauth"},
			Scopes:       []string{"openid"},
			ClientSecret: "secret",
		},
	}

	authURL := authenticator.AuthURL("state123")
	parsed, err := url.Parse(authURL)
	if err != nil {
		t.Fatalf("failed to parse auth URL: %v", err)
	}

	if prompt := parsed.Query().Get("prompt"); prompt != "select_account" {
		t.Fatalf("expected prompt=select_account, got %q", prompt)
	}
}
