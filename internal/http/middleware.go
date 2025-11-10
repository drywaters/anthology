package http

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func newSlogMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(recorder, r)
			duration := time.Since(start)
			logger.Info("http request", "method", r.Method, "path", r.URL.Path, "status", recorder.status, "duration", duration.String())
		})
	}
}

func newTokenAuthMiddleware(expectedToken string) func(http.Handler) http.Handler {
	expectedToken = strings.TrimSpace(expectedToken)
	expectedCookieValue := sessionCookieValue(expectedToken)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if expectedToken == "" {
				next.ServeHTTP(w, r)
				return
			}

			const prefix = "Bearer "
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, prefix) {
				token := strings.TrimSpace(authHeader[len(prefix):])
				if token != "" && subtle.ConstantTimeCompare([]byte(token), []byte(expectedToken)) == 1 {
					next.ServeHTTP(w, r)
					return
				}
			}

			if hasValidSessionCookie(r, expectedCookieValue) {
				next.ServeHTTP(w, r)
				return
			}

			unauthorized(w)
		})
	}
}

func unauthorized(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", "Bearer")
	writeError(w, http.StatusUnauthorized, "authentication required")
}

func sessionCookieValue(token string) string {
	token = strings.TrimSpace(token)
	if token == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func hasValidSessionCookie(r *http.Request, expected string) bool {
	if expected == "" {
		return false
	}

	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return false
	}

	return subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(expected)) == 1
}
