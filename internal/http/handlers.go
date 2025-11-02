package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"log/slog"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"anthology/internal/items"
)

// ItemHandler exposes item CRUD endpoints.
type ItemHandler struct {
	service *items.Service
	logger  *slog.Logger
}

// NewItemHandler creates a handler.
func NewItemHandler(service *items.Service, logger *slog.Logger) *ItemHandler {
	return &ItemHandler{service: service, logger: logger}
}

// List returns all items.
func (h *ItemHandler) List(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context())
	if err != nil {
		h.logger.Error("list items", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list items")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// Create stores a new item.
func (h *ItemHandler) Create(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Title       string `json:"title"`
		Creator     string `json:"creator"`
		ItemType    string `json:"itemType"`
		ReleaseYear *int   `json:"releaseYear"`
		Notes       string `json:"notes"`
	}

	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	item, err := h.service.Create(r.Context(), items.CreateItemInput{
		Title:       payload.Title,
		Creator:     payload.Creator,
		ItemType:    items.ItemType(payload.ItemType),
		ReleaseYear: payload.ReleaseYear,
		Notes:       payload.Notes,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, item)
}

// Get returns a single item.
func (h *ItemHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, r, "id")
	if !ok {
		return
	}

	item, err := h.service.Get(r.Context(), id)
	if err != nil {
		handleServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, item)
}

// Update modifies an item.
func (h *ItemHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, r, "id")
	if !ok {
		return
	}

	raw := map[string]json.RawMessage{}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&raw); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}

	var payload struct {
		Title       *string `json:"title"`
		Creator     *string `json:"creator"`
		ItemType    *string `json:"itemType"`
		ReleaseYear *int    `json:"releaseYear"`
		Notes       *string `json:"notes"`
	}

	if err := decodeInto(raw, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	input := items.UpdateItemInput{}
	if _, ok := raw["title"]; ok {
		input.Title = payload.Title
	}
	if _, ok := raw["creator"]; ok {
		input.Creator = payload.Creator
	}
	if _, ok := raw["itemType"]; ok {
		if payload.ItemType != nil {
			typeValue := items.ItemType(*payload.ItemType)
			input.ItemType = &typeValue
		} else {
			input.ItemType = new(items.ItemType)
		}
	}
	if _, ok := raw["releaseYear"]; ok {
		value := payload.ReleaseYear
		input.ReleaseYear = &value
	}
	if _, ok := raw["notes"]; ok {
		input.Notes = payload.Notes
	}

	item, err := h.service.Update(r.Context(), id, input)
	if err != nil {
		handleServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, item)
}

// Delete removes an item.
func (h *ItemHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, r, "id")
	if !ok {
		return
	}

	if err := h.service.Delete(r.Context(), id); err != nil {
		handleServiceError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func parseUUIDParam(w http.ResponseWriter, r *http.Request, key string) (uuid.UUID, bool) {
	value := chi.URLParam(r, key)
	id, err := uuid.Parse(value)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return uuid.Nil, false
	}
	return id, true
}

func handleServiceError(w http.ResponseWriter, err error) {
	if errors.Is(err, items.ErrNotFound) {
		writeError(w, http.StatusNotFound, "item not found")
		return
	}
	writeError(w, http.StatusInternalServerError, "unexpected error")
}

func decodeJSON(r *http.Request, dst any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return err
	}
	return nil
}

func decodeInto(raw map[string]json.RawMessage, payload any) error {
	data, err := json.Marshal(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, payload)
}
