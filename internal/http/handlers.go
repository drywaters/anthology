package http

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"log/slog"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"anthology/internal/importer"
	"anthology/internal/items"
)

// ItemHandler exposes item CRUD endpoints.
type ItemHandler struct {
	service  *items.Service
	importer *importer.CSVImporter
	logger   *slog.Logger
}

// NewItemHandler creates a handler.
func NewItemHandler(service *items.Service, importer *importer.CSVImporter, logger *slog.Logger) *ItemHandler {
	return &ItemHandler{service: service, importer: importer, logger: logger}
}

// List returns all items.
func (h *ItemHandler) List(w http.ResponseWriter, r *http.Request) {
	opts, err := parseListOptions(r.URL.Query())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	items, err := h.service.List(r.Context(), opts)
	if err != nil {
		h.logger.Error("list items", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list items")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func parseListOptions(values url.Values) (items.ListOptions, error) {
	opts := items.ListOptions{}

	if rawType := strings.TrimSpace(values.Get("type")); rawType != "" {
		typeValue := items.ItemType(rawType)
		switch typeValue {
		case items.ItemTypeBook, items.ItemTypeGame, items.ItemTypeMovie, items.ItemTypeMusic:
			opts.ItemType = &typeValue
		default:
			return items.ListOptions{}, fmt.Errorf("invalid type filter")
		}
	}

	if rawStatus := strings.TrimSpace(values.Get("status")); rawStatus != "" {
		status := items.BookStatus(rawStatus)
		switch status {
		case items.BookStatusRead, items.BookStatusReading, items.BookStatusWantToRead:
			opts.ReadingStatus = &status
		default:
			return items.ListOptions{}, fmt.Errorf("invalid status filter")
		}
	}

	if rawLetter := strings.TrimSpace(values.Get("letter")); rawLetter != "" {
		letter := strings.ToUpper(rawLetter)
		if letter == "#" || (len(letter) == 1 && letter[0] >= 'A' && letter[0] <= 'Z') {
			opts.Initial = &letter
		} else {
			return items.ListOptions{}, fmt.Errorf("invalid letter filter")
		}
	}

	return opts, nil
}

// Create stores a new item.
func (h *ItemHandler) Create(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Title         string     `json:"title"`
		Creator       string     `json:"creator"`
		ItemType      string     `json:"itemType"`
		ReleaseYear   *int       `json:"releaseYear"`
		PageCount     *int       `json:"pageCount"`
		CurrentPage   *int       `json:"currentPage"`
		ISBN13        string     `json:"isbn13"`
		ISBN10        string     `json:"isbn10"`
		Description   string     `json:"description"`
		CoverImage    string     `json:"coverImage"`
		ReadingStatus string     `json:"readingStatus"`
		ReadAt        *time.Time `json:"readAt"`
		Notes         string     `json:"notes"`
	}

	if err := decodeJSONBody(w, r, &payload); err != nil {
		writeJSONError(w, err)
		return
	}

	item, err := h.service.Create(r.Context(), items.CreateItemInput{
		Title:         payload.Title,
		Creator:       payload.Creator,
		ItemType:      items.ItemType(payload.ItemType),
		ReleaseYear:   payload.ReleaseYear,
		PageCount:     payload.PageCount,
		CurrentPage:   payload.CurrentPage,
		ISBN13:        payload.ISBN13,
		ISBN10:        payload.ISBN10,
		Description:   payload.Description,
		CoverImage:    payload.CoverImage,
		ReadingStatus: items.BookStatus(payload.ReadingStatus),
		ReadAt:        payload.ReadAt,
		Notes:         payload.Notes,
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
	if err := decodeJSONBody(w, r, &raw); err != nil {
		writeJSONError(w, err)
		return
	}

	var payload struct {
		Title         *string    `json:"title"`
		Creator       *string    `json:"creator"`
		ItemType      *string    `json:"itemType"`
		ReleaseYear   *int       `json:"releaseYear"`
		PageCount     *int       `json:"pageCount"`
		CurrentPage   *int       `json:"currentPage"`
		ISBN13        *string    `json:"isbn13"`
		ISBN10        *string    `json:"isbn10"`
		Description   *string    `json:"description"`
		CoverImage    *string    `json:"coverImage"`
		ReadingStatus *string    `json:"readingStatus"`
		ReadAt        *time.Time `json:"readAt"`
		Notes         *string    `json:"notes"`
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
	if _, ok := raw["pageCount"]; ok {
		value := payload.PageCount
		input.PageCount = &value
	}
	if _, ok := raw["currentPage"]; ok {
		value := payload.CurrentPage
		input.CurrentPage = &value
	}
	if _, ok := raw["notes"]; ok {
		input.Notes = payload.Notes
	}
	if _, ok := raw["isbn13"]; ok {
		input.ISBN13 = payload.ISBN13
	}
	if _, ok := raw["isbn10"]; ok {
		input.ISBN10 = payload.ISBN10
	}
	if _, ok := raw["description"]; ok {
		input.Description = payload.Description
	}
	if _, ok := raw["coverImage"]; ok {
		input.CoverImage = payload.CoverImage
	}

	if _, ok := raw["readingStatus"]; ok {
		if payload.ReadingStatus != nil {
			statusValue := items.BookStatus(*payload.ReadingStatus)
			input.ReadingStatus = &statusValue
		} else {
			input.ReadingStatus = new(items.BookStatus)
		}
	}

	if _, ok := raw["readAt"]; ok {
		value := payload.ReadAt
		input.ReadAt = &value
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

const maxCSVUploadBytes int64 = 5 << 20

// ImportCSV ingests a CSV file of catalog items.
func (h *ItemHandler) ImportCSV(w http.ResponseWriter, r *http.Request) {
	if h.importer == nil {
		writeError(w, http.StatusNotImplemented, "CSV import is not available")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxCSVUploadBytes)
	if err := r.ParseMultipartForm(maxCSVUploadBytes); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("CSV upload is too large (max %d bytes)", maxErr.Limit))
			return
		}
		writeError(w, http.StatusBadRequest, "invalid CSV upload")
		return
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "CSV file is required")
		return
	}
	defer file.Close()

	summary, err := h.importer.Import(r.Context(), file)
	if err != nil {
		if errors.Is(err, importer.ErrInvalidCSV) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		h.logger.Error("csv import failed", "error", err)
		writeError(w, http.StatusInternalServerError, "bulk import failed")
		return
	}

	writeJSON(w, http.StatusOK, summary)
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

const maxJSONBodyBytes int64 = 1 << 20 // 1 MiB

var errPayloadTooLarge = errors.New("payload too large")

func decodeJSONBody(w http.ResponseWriter, r *http.Request, dst any) error {
	limited := http.MaxBytesReader(w, r.Body, maxJSONBodyBytes)
	defer func() {
		_ = limited.Close()
	}()

	decoder := json.NewDecoder(limited)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return fmt.Errorf("%w (max %d bytes)", errPayloadTooLarge, maxErr.Limit)
		}
		return err
	}
	return nil
}

func writeJSONError(w http.ResponseWriter, err error) {
	if errors.Is(err, errPayloadTooLarge) {
		writeError(w, http.StatusRequestEntityTooLarge, err.Error())
		return
	}
	writeError(w, http.StatusBadRequest, err.Error())
}

func decodeInto(raw map[string]json.RawMessage, payload any) error {
	data, err := json.Marshal(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, payload)
}
