package http

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"log/slog"
)

func TestSessionHandlerRateLimitStripsPortFromRemoteAddr(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewSessionHandler("secret", "development", logger)

	for i := 0; i < maxLoginAttempts; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/session", strings.NewReader(`{"token":"wrong"}`))
		req.RemoteAddr = fmt.Sprintf("203.0.113.5:%d", 4000+i)
		rec := httptest.NewRecorder()

		handler.Login(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d expected status 401, got %d", i+1, rec.Code)
		}
	}

	finalReq := httptest.NewRequest(http.MethodPost, "/api/session", strings.NewReader(`{"token":"wrong"}`))
	finalReq.RemoteAddr = "203.0.113.5:9999"
	finalRec := httptest.NewRecorder()

	handler.Login(finalRec, finalReq)

	if finalRec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected status 429 after exceeding attempts, got %d", finalRec.Code)
	}
}

func TestSessionHandlerRateLimitStripsPortFromForwardedFor(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewSessionHandler("secret", "development", logger)

	for i := 0; i < maxLoginAttempts; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/session", strings.NewReader(`{"token":"wrong"}`))
		req.RemoteAddr = fmt.Sprintf("10.0.0.%d:1234", i+1)
		req.Header.Set("X-Forwarded-For", fmt.Sprintf("198.51.100.7:%d, 10.0.0.1", 3000+i))
		rec := httptest.NewRecorder()

		handler.Login(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d expected status 401, got %d", i+1, rec.Code)
		}
	}

	finalReq := httptest.NewRequest(http.MethodPost, "/api/session", strings.NewReader(`{"token":"wrong"}`))
	finalReq.RemoteAddr = "10.0.0.99:9999"
	finalReq.Header.Set("X-Forwarded-For", "198.51.100.7:9998, 10.0.0.1")
	finalRec := httptest.NewRecorder()

	handler.Login(finalRec, finalReq)

	if finalRec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected status 429 after exceeding attempts, got %d", finalRec.Code)
	}
}
