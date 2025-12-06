package http

import (
	"crypto/subtle"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	sessionCookieName = "anthology_session"
	sessionCookieTTL  = 12 * time.Hour

	// Rate limiting defaults: 5 failed attempts per IP, then 15-minute lockout
	maxLoginAttempts   = 5
	loginLockoutWindow = 15 * time.Minute
)

// loginAttempt tracks failed login attempts for rate limiting.
type loginAttempt struct {
	count    int
	firstTry time.Time
}

// SessionHandler manages browser-authenticated sessions using HttpOnly cookies.
type SessionHandler struct {
	expectedToken string
	cookieValue   string
	secureCookie  bool
	logger        *slog.Logger

	mu       sync.Mutex
	attempts map[string]*loginAttempt
}

// NewSessionHandler returns a handler wired with the configured API token.
func NewSessionHandler(expectedToken, env string, logger *slog.Logger) *SessionHandler {
	token := strings.TrimSpace(expectedToken)
	return &SessionHandler{
		expectedToken: token,
		cookieValue:   sessionCookieValue(token),
		secureCookie:  !strings.EqualFold(env, "development"),
		logger:        logger,
		attempts:      make(map[string]*loginAttempt),
	}
}

// Login validates the supplied token and issues an HttpOnly cookie.
func (h *SessionHandler) Login(w http.ResponseWriter, r *http.Request) {
	if h.expectedToken == "" {
		writeError(w, http.StatusBadRequest, "API token authentication is disabled")
		return
	}

	clientIP := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		clientIP = strings.Split(forwarded, ",")[0]
	}
	clientIP = strings.TrimSpace(clientIP)

	if h.isRateLimited(clientIP) {
		h.logger.Warn("login rate limited", "ip", clientIP, "reason", "too_many_attempts")
		writeError(w, http.StatusTooManyRequests, "too many login attempts, try again later")
		return
	}

	var payload struct {
		Token string `json:"token"`
	}

	if err := decodeJSONBody(w, r, &payload); err != nil {
		writeJSONError(w, err)
		return
	}

	token := strings.TrimSpace(payload.Token)
	if token == "" || subtle.ConstantTimeCompare([]byte(token), []byte(h.expectedToken)) != 1 {
		h.recordFailedAttempt(clientIP)
		h.logger.Warn("login failed", "ip", clientIP, "reason", "invalid_token")
		writeError(w, http.StatusUnauthorized, "invalid token")
		return
	}

	h.clearAttempts(clientIP)
	h.logger.Info("login successful", "ip", clientIP)
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

func (h *SessionHandler) isRateLimited(ip string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	attempt, exists := h.attempts[ip]
	if !exists {
		return false
	}

	if time.Since(attempt.firstTry) > loginLockoutWindow {
		delete(h.attempts, ip)
		return false
	}

	return attempt.count >= maxLoginAttempts
}

func (h *SessionHandler) recordFailedAttempt(ip string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	attempt, exists := h.attempts[ip]
	if !exists || time.Since(attempt.firstTry) > loginLockoutWindow {
		h.attempts[ip] = &loginAttempt{count: 1, firstTry: time.Now()}
		return
	}

	attempt.count++
}

func (h *SessionHandler) clearAttempts(ip string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.attempts, ip)
}
