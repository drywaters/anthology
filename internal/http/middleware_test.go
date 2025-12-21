package http

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"anthology/internal/auth"

	"github.com/google/uuid"
)

func TestAuthMiddlewareRejectsMissingCookie(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	authService := auth.NewService(&authRepoStub{}, time.Hour)
	next := newAuthMiddleware(authService, logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/items", nil)
	rec := httptest.NewRecorder()

	next.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}

func TestAuthMiddlewareInjectsUser(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	expectedUser := &auth.User{ID: uuid.New(), Email: "user@example.com"}
	repo := &authRepoStub{
		findSessionByHash: func(ctx context.Context, tokenHash string) (*auth.Session, *auth.User, error) {
			return &auth.Session{ID: uuid.New(), ExpiresAt: time.Now().Add(time.Minute)}, expectedUser, nil
		},
	}
	authService := auth.NewService(repo, time.Hour)

	next := newAuthMiddleware(authService, logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		if user == nil || user.Email != expectedUser.Email {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/items", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "token"})
	rec := httptest.NewRecorder()

	next.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
}

func TestAuthMiddlewareRejectsInvalidSession(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	repo := &authRepoStub{
		findSessionByHash: func(ctx context.Context, tokenHash string) (*auth.Session, *auth.User, error) {
			return nil, nil, nil
		},
	}
	authService := auth.NewService(repo, time.Hour)
	next := newAuthMiddleware(authService, logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/items", nil)
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "token"})
	rec := httptest.NewRecorder()

	next.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}
}
