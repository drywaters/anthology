package http

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"log/slog"

	"anthology/internal/catalog"
)

// CatalogLookup describes the catalog service dependency used by the handler.
type CatalogLookup interface {
	Lookup(ctx context.Context, query string, category catalog.Category) ([]catalog.Metadata, error)
}

// CatalogHandler exposes catalog lookup endpoints.
type CatalogHandler struct {
	service CatalogLookup
	logger  *slog.Logger
}

// NewCatalogHandler constructs a handler for catalog lookups.
func NewCatalogHandler(service CatalogLookup, logger *slog.Logger) *CatalogHandler {
	return &CatalogHandler{service: service, logger: logger}
}

// Lookup resolves metadata from supported third-party services.
func (h *CatalogHandler) Lookup(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("query"))
	category := strings.TrimSpace(r.URL.Query().Get("category"))

	if query == "" {
		writeError(w, http.StatusBadRequest, "query is required")
		return
	}

	if category == "" {
		writeError(w, http.StatusBadRequest, "category is required")
		return
	}

	metadata, err := h.service.Lookup(r.Context(), query, catalog.Category(category))
	if err != nil {
		switch {
		case errors.Is(err, catalog.ErrInvalidQuery):
			writeError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, catalog.ErrUnsupportedCategory):
			writeError(w, http.StatusBadRequest, "metadata lookups for this category are not available yet")
		case errors.Is(err, catalog.ErrNotFound):
			writeError(w, http.StatusNotFound, "We couldn’t find any metadata for that query.")
		default:
			h.logger.Error("catalog lookup failed", "error", err, "query", query, "category", category)
			writeError(w, http.StatusBadGateway, "metadata lookup failed. Try again later.")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": metadata,
	})
}
