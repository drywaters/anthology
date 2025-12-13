package http

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"log/slog"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"anthology/internal/catalog"
	"anthology/internal/items"
	"anthology/internal/shelves"
)

type stubCatalogService struct {
	lookupFunc func(ctx context.Context, query string, category catalog.Category) ([]catalog.Metadata, error)
}

func (s *stubCatalogService) Lookup(ctx context.Context, query string, category catalog.Category) ([]catalog.Metadata, error) {
	if s.lookupFunc != nil {
		return s.lookupFunc(ctx, query, category)
	}
	return nil, nil
}

func TestShelfHandler_ScanAndAssign_Returns404WhenNotFound(t *testing.T) {
	// Setup
	itemRepo := items.NewInMemoryRepository(nil)
	shelfRepo := shelves.NewInMemoryRepository()

	ctx := context.Background()
	shelfID := uuid.New()
	slotID := uuid.New()

	now := time.Now().UTC()
	shelf := shelves.Shelf{
		ID: shelfID,
		Name: "Test Shelf",
		PhotoURL: "https://example.com/p.jpg",
		CreatedAt: now,
		UpdatedAt: now,
	}
	row := shelves.ShelfRow{ID: uuid.New(), ShelfID: shelfID, RowIndex: 0}
	col := shelves.ShelfColumn{ID: uuid.New(), ShelfRowID: row.ID, ColIndex: 0}
	slot := shelves.ShelfSlot{
		ID: slotID,
		ShelfID: shelfID,
		ShelfRowID: row.ID,
		ShelfColumnID: col.ID,
		RowIndex: 0,
		ColIndex: 0,
	}

	if _, err := shelfRepo.CreateShelf(ctx, shelf, []shelves.ShelfRow{row}, []shelves.ShelfColumn{col}, []shelves.ShelfSlot{slot}); err != nil {
		t.Fatalf("failed to setup shelf: %v", err)
	}

	catalogSvc := &stubCatalogService{
		lookupFunc: func(ctx context.Context, query string, category catalog.Category) ([]catalog.Metadata, error) {
			return nil, catalog.ErrNotFound
		},
	}

	itemSvc := items.NewService(itemRepo)
	shelfSvc := shelves.NewService(shelfRepo, itemRepo, catalogSvc, itemSvc)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewShelfHandler(shelfSvc, logger)

	r := chi.NewRouter()
	r.Post("/shelves/{id}/slots/{slotId}/scan", handler.ScanAndAssign)

	// Execute
	body := strings.NewReader(`{"isbn": "9780000000000"}`)
	req := httptest.NewRequest("POST", "/shelves/"+shelfID.String()+"/slots/"+slotID.String()+"/scan", body)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	// Assert - verify new correct behavior
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	expected := "No results found"
	if !strings.Contains(rec.Body.String(), expected) {
		t.Errorf("expected '%s', got %s", expected, rec.Body.String())
	}
}
