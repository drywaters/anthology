package http

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"log/slog"

	"anthology/internal/catalog"
)

type mockCatalogService struct {
	metadata     catalog.Metadata
	err          error
	lastCtx      context.Context
	lastQuery    string
	lastCategory catalog.Category
}

func (m *mockCatalogService) Lookup(ctx context.Context, query string, category catalog.Category) (catalog.Metadata, error) {
	m.lastCtx = ctx
	m.lastQuery = query
	m.lastCategory = category
	return m.metadata, m.err
}

func newTestLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, &slog.HandlerOptions{Level: slog.LevelError}))
}

func TestCatalogHandlerLookupSuccess(t *testing.T) {
	mockService := &mockCatalogService{
		metadata: catalog.Metadata{Title: "Title", Creator: "Author", ItemType: "book"},
	}
	handler := NewCatalogHandler(mockService, newTestLogger())

	req := httptest.NewRequest(http.MethodGet, "/api/catalog/lookup?query=test&category=book", nil)
	rr := httptest.NewRecorder()

	handler.Lookup(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	if mockService.lastQuery != "test" || mockService.lastCategory != catalog.CategoryBook {
		t.Fatalf("service should receive query and category, got %s, %s", mockService.lastQuery, mockService.lastCategory)
	}
}

func TestCatalogHandlerLookupMissingQuery(t *testing.T) {
	handler := NewCatalogHandler(&mockCatalogService{}, newTestLogger())

	req := httptest.NewRequest(http.MethodGet, "/api/catalog/lookup?category=book", nil)
	rr := httptest.NewRecorder()

	handler.Lookup(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestCatalogHandlerLookupMissingCategory(t *testing.T) {
	handler := NewCatalogHandler(&mockCatalogService{}, newTestLogger())

	req := httptest.NewRequest(http.MethodGet, "/api/catalog/lookup?query=test", nil)
	rr := httptest.NewRecorder()

	handler.Lookup(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestCatalogHandlerLookupNotFound(t *testing.T) {
	handler := NewCatalogHandler(&mockCatalogService{err: catalog.ErrNotFound}, newTestLogger())

	req := httptest.NewRequest(http.MethodGet, "/api/catalog/lookup?query=test&category=book", nil)
	rr := httptest.NewRecorder()

	handler.Lookup(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", rr.Code)
	}
}

func TestCatalogHandlerLookupUnsupported(t *testing.T) {
	handler := NewCatalogHandler(&mockCatalogService{err: catalog.ErrUnsupportedCategory}, newTestLogger())

	req := httptest.NewRequest(http.MethodGet, "/api/catalog/lookup?query=test&category=board-game", nil)
	rr := httptest.NewRecorder()

	handler.Lookup(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestCatalogHandlerLookupServerError(t *testing.T) {
	handler := NewCatalogHandler(&mockCatalogService{err: errors.New("boom")}, newTestLogger())

	req := httptest.NewRequest(http.MethodGet, "/api/catalog/lookup?query=test&category=book", nil)
	rr := httptest.NewRecorder()

	handler.Lookup(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("expected status 502, got %d", rr.Code)
	}
}
