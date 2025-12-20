package http

import (
	"context"
	"crypto/subtle"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"anthology/internal/auth"
)

const (
	oauthStateCookieName = "anthology_oauth_state"
	oauthStateCookieTTL  = 10 * time.Minute
)

type googleAuthenticator interface {
	AuthURL(state string) string
	Exchange(ctx context.Context, code string) (*auth.GoogleClaims, error)
	IsEmailAllowed(email string) bool
}

// OAuthHandler handles OAuth authentication endpoints.
type OAuthHandler struct {
	google       googleAuthenticator
	authService  *auth.Service
	logger       *slog.Logger
	secureCookie bool
	frontendURL  string
}

// NewOAuthHandler creates a new OAuthHandler.
func NewOAuthHandler(google googleAuthenticator, authService *auth.Service, frontendURL, env string, logger *slog.Logger) *OAuthHandler {
	return &OAuthHandler{
		google:       google,
		authService:  authService,
		logger:       logger,
		secureCookie: !strings.EqualFold(env, "development"),
		frontendURL:  strings.TrimSuffix(frontendURL, "/"),
	}
}

// InitiateGoogle handles GET /api/auth/google
// Redirects the user to Google's OAuth consent screen.
func (h *OAuthHandler) InitiateGoogle(w http.ResponseWriter, r *http.Request) {
	state, err := auth.GenerateState()
	if err != nil {
		h.logger.Error("failed to generate state", "error", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	// Store state in cookie for CSRF protection
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookieName,
		Value:    state,
		Path:     "/api/auth",
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(oauthStateCookieTTL.Seconds()),
	})

	// Preserve redirectTo query param by appending to state
	redirectTo := r.URL.Query().Get("redirectTo")
	fullState := state
	if redirectTo != "" {
		fullState = state + "|" + redirectTo
	}

	authURL := h.google.AuthURL(fullState)
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// CallbackGoogle handles GET /api/auth/google/callback
// Exchanges the authorization code for tokens, creates/updates user, issues session.
func (h *OAuthHandler) CallbackGoogle(w http.ResponseWriter, r *http.Request) {
	// Verify state (CSRF protection)
	stateCookie, err := r.Cookie(oauthStateCookieName)
	if err != nil {
		h.logger.Warn("oauth callback: missing state cookie")
		h.redirectWithError(w, r, "invalid_request", "Session expired. Please try again.")
		return
	}

	stateParam := r.URL.Query().Get("state")
	expectedState := stateCookie.Value
	redirectTo := "/"

	// Parse state (may contain |redirectTo suffix)
	if idx := strings.Index(stateParam, "|"); idx != -1 {
		stateOnly := stateParam[:idx]
		redirectTo = stateParam[idx+1:]
		// Validate redirectTo is a relative path
		if !strings.HasPrefix(redirectTo, "/") || strings.HasPrefix(redirectTo, "//") {
			redirectTo = "/"
		}
		stateParam = stateOnly
	}

	if subtle.ConstantTimeCompare([]byte(stateParam), []byte(expectedState)) != 1 {
		h.logger.Warn("oauth callback: state mismatch")
		h.redirectWithError(w, r, "invalid_request", "Invalid state. Please try again.")
		return
	}

	// Clear state cookie
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookieName,
		Value:    "",
		Path:     "/api/auth",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.secureCookie,
	})

	// Check for OAuth error from Google
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		h.logger.Warn("oauth callback: provider error", "error", errParam)
		h.redirectWithError(w, r, errParam, r.URL.Query().Get("error_description"))
		return
	}

	// Exchange code for tokens
	code := r.URL.Query().Get("code")
	if code == "" {
		h.redirectWithError(w, r, "invalid_request", "Missing authorization code.")
		return
	}

	claims, err := h.google.Exchange(r.Context(), code)
	if err != nil {
		h.logger.Error("oauth callback: exchange failed", "error", err)
		h.redirectWithError(w, r, "exchange_error", "Failed to complete authentication.")
		return
	}

	// Verify email is verified
	if !claims.EmailVerified {
		h.logger.Warn("oauth callback: email not verified", "email", claims.Email)
		h.redirectWithError(w, r, "email_not_verified", "Please verify your Google email address.")
		return
	}

	// Check allowlist
	if !h.google.IsEmailAllowed(claims.Email) {
		h.logger.Warn("oauth callback: email not allowed", "email", claims.Email)
		h.redirectWithError(w, r, "access_denied", "Your account is not authorized to access this application.")
		return
	}

	// Create or update user
	user, err := h.authService.CreateOrUpdateUser(r.Context(), claims)
	if err != nil {
		h.logger.Error("oauth callback: user creation failed", "error", err)
		h.redirectWithError(w, r, "internal_error", "Failed to create user account.")
		return
	}

	// Create session
	token, err := h.authService.CreateSession(r.Context(), user.ID, r.UserAgent(), clientIPFromRequest(r))
	if err != nil {
		h.logger.Error("oauth callback: session creation failed", "error", err)
		h.redirectWithError(w, r, "internal_error", "Failed to create session.")
		return
	}

	// Set session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sessionCookieTTL.Seconds()),
	})

	h.logger.Info("oauth login successful", "user_id", user.ID, "email", user.Email)

	// Redirect to frontend
	http.Redirect(w, r, h.frontendURL+redirectTo, http.StatusTemporaryRedirect)
}

// redirectWithError redirects to the login page with error details.
func (h *OAuthHandler) redirectWithError(w http.ResponseWriter, r *http.Request, code, message string) {
	target := h.frontendURL + "/login?error=" + url.QueryEscape(code)
	if message != "" {
		target += "&message=" + url.QueryEscape(message)
	}
	http.Redirect(w, r, target, http.StatusTemporaryRedirect)
}
