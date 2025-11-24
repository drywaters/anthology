package http

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"anthology/internal/items"
	"anthology/internal/shelves"
)

// ShelfHandler exposes HTTP endpoints for shelf management.
type ShelfHandler struct {
	svc    *shelves.Service
	logger *slog.Logger
}

// NewShelfHandler constructs a ShelfHandler.
func NewShelfHandler(svc *shelves.Service, logger *slog.Logger) *ShelfHandler {
	return &ShelfHandler{svc: svc, logger: logger}
}

// List returns shelf summaries.
func (h *ShelfHandler) List(w http.ResponseWriter, r *http.Request) {
	shelvesList, err := h.svc.ListShelves(r.Context())
	if err != nil {
		h.logger.Error("list shelves", "error", err)
		writeError(w, http.StatusInternalServerError, "Unable to list shelves")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"shelves": shelvesList})
}

// Create registers a new shelf with a default layout.
func (h *ShelfHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input shelves.CreateShelfInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid payload")
		return
	}

	created, err := h.svc.CreateShelf(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

// Get returns a shelf and its layout.
func (h *ShelfHandler) Get(w http.ResponseWriter, r *http.Request) {
	shelfID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid shelf id")
		return
	}

	shelf, err := h.svc.GetShelf(r.Context(), shelfID)
	if err != nil {
		status := http.StatusInternalServerError
		if err == shelves.ErrNotFound {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, shelf)
}

// UpdateLayout applies a new layout and returns displaced items.
func (h *ShelfHandler) UpdateLayout(w http.ResponseWriter, r *http.Request) {
	shelfID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid shelf id")
		return
	}

	var input shelves.UpdateLayoutInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid payload")
		return
	}

	updated, displaced, err := h.svc.UpdateLayout(r.Context(), shelfID, input)
	if err != nil {
		status := http.StatusBadRequest
		if err == shelves.ErrNotFound {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"shelf":     updated,
		"displaced": displaced,
	})
}

// AssignItem assigns an item to a slot on the shelf.
func (h *ShelfHandler) AssignItem(w http.ResponseWriter, r *http.Request) {
	shelfID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid shelf id")
		return
	}
	slotID, err := uuid.Parse(chi.URLParam(r, "slotId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid slot id")
		return
	}

	var payload struct {
		ItemID string `json:"itemId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.ItemID == "" {
		writeError(w, http.StatusBadRequest, "itemId is required")
		return
	}
	itemID, err := uuid.Parse(payload.ItemID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid item id")
		return
	}

	shelf, err := h.svc.AssignItem(r.Context(), shelfID, slotID, itemID)
	if err != nil {
		status := http.StatusBadRequest
		switch {
		case errors.Is(err, items.ErrNotFound):
			status = http.StatusNotFound
		case errors.Is(err, shelves.ErrNotFound), errors.Is(err, shelves.ErrSlotNotFound):
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, shelf)
}

// RemoveItem removes an item placement from a slot.
func (h *ShelfHandler) RemoveItem(w http.ResponseWriter, r *http.Request) {
	shelfID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid shelf id")
		return
	}
	slotID, err := uuid.Parse(chi.URLParam(r, "slotId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid slot id")
		return
	}
	itemID, err := uuid.Parse(chi.URLParam(r, "itemId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid item id")
		return
	}

	shelf, err := h.svc.RemoveItem(r.Context(), shelfID, slotID, itemID)
	if err != nil {
		status := http.StatusBadRequest
		if err == shelves.ErrNotFound || err == shelves.ErrSlotNotFound {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, shelf)
}
