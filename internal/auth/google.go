package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// GoogleAuthenticator handles Google OAuth 2.0 / OIDC authentication.
type GoogleAuthenticator struct {
	config         *oauth2.Config
	verifier       *oidc.IDTokenVerifier
	allowedDomains map[string]struct{}
	allowedEmails  map[string]struct{}
}

// NewGoogleAuthenticator creates a new GoogleAuthenticator.
func NewGoogleAuthenticator(ctx context.Context, clientID, clientSecret, redirectURL string, allowedDomains, allowedEmails []string) (*GoogleAuthenticator, error) {
	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		return nil, fmt.Errorf("oidc provider: %w", err)
	}

	config := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Endpoint:     google.Endpoint,
		Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: clientID})

	domainSet := make(map[string]struct{}, len(allowedDomains))
	for _, d := range allowedDomains {
		d = strings.ToLower(strings.TrimSpace(d))
		if d != "" {
			domainSet[d] = struct{}{}
		}
	}

	emailSet := make(map[string]struct{}, len(allowedEmails))
	for _, e := range allowedEmails {
		e = strings.ToLower(strings.TrimSpace(e))
		if e != "" {
			emailSet[e] = struct{}{}
		}
	}

	return &GoogleAuthenticator{
		config:         config,
		verifier:       verifier,
		allowedDomains: domainSet,
		allowedEmails:  emailSet,
	}, nil
}

// AuthURL generates the Google OAuth consent URL with the given state.
func (g *GoogleAuthenticator) AuthURL(state string) string {
	return g.config.AuthCodeURL(
		state,
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("prompt", "select_account"),
	)
}

// Exchange exchanges the authorization code for tokens and returns the user claims.
func (g *GoogleAuthenticator) Exchange(ctx context.Context, code string) (*GoogleClaims, error) {
	token, err := g.config.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("token exchange: %w", err)
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		return nil, fmt.Errorf("no id_token in response")
	}

	idToken, err := g.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("verify id_token: %w", err)
	}

	var claims GoogleClaims
	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("parse claims: %w", err)
	}

	return &claims, nil
}

// IsEmailAllowed checks if the given email is allowed based on domain/email allowlists.
func (g *GoogleAuthenticator) IsEmailAllowed(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))

	// Check explicit email allowlist
	if _, ok := g.allowedEmails[email]; ok {
		return true
	}

	// Check domain allowlist
	parts := strings.Split(email, "@")
	if len(parts) == 2 {
		domain := parts[1]
		if _, ok := g.allowedDomains[domain]; ok {
			return true
		}
	}

	// If both allowlists are empty, allow all (dev mode)
	return len(g.allowedDomains) == 0 && len(g.allowedEmails) == 0
}

// HasAllowlist returns true if any allowlist restrictions are configured.
func (g *GoogleAuthenticator) HasAllowlist() bool {
	return len(g.allowedDomains) > 0 || len(g.allowedEmails) > 0
}

// GenerateState generates a cryptographically secure random state string.
func GenerateState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}
