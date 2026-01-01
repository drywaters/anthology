package http

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"anthology/internal/items"
)

// SeriesHandler exposes series-related endpoints.
type SeriesHandler struct {
	service *items.Service
	logger  *slog.Logger
}

// NewSeriesHandler creates a handler.
func NewSeriesHandler(service *items.Service, logger *slog.Logger) *SeriesHandler {
	return &SeriesHandler{service: service, logger: logger}
}

// List returns all series with summaries.
func (h *SeriesHandler) List(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	opts := parseSeriesListOptions(r)

	series, err := h.service.ListSeries(r.Context(), opts, user.ID)
	if err != nil {
		h.logger.Error("list series", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list series")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"series": series})
}

// Get returns details for a single series.
func (h *SeriesHandler) Get(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		writeError(w, http.StatusBadRequest, "series name is required")
		return
	}

	summary, err := h.service.GetSeriesByName(r.Context(), name, user.ID)
	if err != nil {
		if errors.Is(err, items.ErrNotFound) {
			writeError(w, http.StatusNotFound, "series not found")
			return
		}
		h.logger.Error("get series", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to get series")
		return
	}

	writeJSON(w, http.StatusOK, summary)
}

func parseSeriesListOptions(r *http.Request) items.SeriesListOptions {
	opts := items.SeriesListOptions{}

	if r.URL.Query().Get("include_items") == "true" {
		opts.IncludeItems = true
	}

	if rawStatus := strings.TrimSpace(r.URL.Query().Get("status")); rawStatus != "" {
		status := items.SeriesStatus(rawStatus)
		switch status {
		case items.SeriesStatusComplete, items.SeriesStatusIncomplete, items.SeriesStatusUnknown:
			opts.Status = &status
		}
	}

	return opts
}
