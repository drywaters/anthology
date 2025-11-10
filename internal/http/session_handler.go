package http

import (
	"crypto/subtle"
	"net/http"
	"strings"
	"time"
)

const (
	sessionCookieName = "anthology_session"
	sessionCookieTTL  = 12 * time.Hour
)

// SessionHandler manages browser-authenticated sessions using HttpOnly cookies.
type SessionHandler struct {
	expectedToken string
	cookieValue   string
	secureCookie  bool
}

// NewSessionHandler returns a handler wired with the configured API token.
func NewSessionHandler(expectedToken, env string) *SessionHandler {
	token := strings.TrimSpace(expectedToken)
	return &SessionHandler{
		expectedToken: token,
		cookieValue:   sessionCookieValue(token),
		secureCookie:  !strings.EqualFold(env, "development"),
	}
}

// Login validates the supplied token and issues an HttpOnly cookie.
func (h *SessionHandler) Login(w http.ResponseWriter, r *http.Request) {
	if h.expectedToken == "" {
		writeError(w, http.StatusBadRequest, "API token authentication is disabled")
		return
	}

	var payload struct {
		Token string `json:"token"`
	}

	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}

	token := strings.TrimSpace(payload.Token)
	if token == "" || subtle.ConstantTimeCompare([]byte(token), []byte(h.expectedToken)) != 1 {
		writeError(w, http.StatusUnauthorized, "invalid token")
		return
	}

	http.SetCookie(w, h.sessionCookie(sessionCookieTTL))
	w.WriteHeader(http.StatusNoContent)
}

// Logout removes the session cookie, if present.
func (h *SessionHandler) Logout(w http.ResponseWriter, _ *http.Request) {
	clearCookie := h.sessionCookie(0)
	clearCookie.Value = ""
	clearCookie.MaxAge = -1
	clearCookie.Expires = time.Unix(0, 0)

	http.SetCookie(w, clearCookie)
	w.WriteHeader(http.StatusNoContent)
}

// Status reports whether the request already holds a valid session.
func (h *SessionHandler) Status(w http.ResponseWriter, r *http.Request) {
	if h.expectedToken == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if hasValidSessionCookie(r, h.cookieValue) {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	unauthorized(w)
}

func (h *SessionHandler) sessionCookie(ttl time.Duration) *http.Cookie {
	return &http.Cookie{
		Name:     sessionCookieName,
		Value:    h.cookieValue,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   h.secureCookie,
		MaxAge:   int(ttl.Seconds()),
		Expires:  time.Now().Add(ttl),
	}
}
