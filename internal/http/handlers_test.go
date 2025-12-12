package http

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"log/slog"

	"github.com/google/uuid"

	"anthology/internal/importer"
	"anthology/internal/items"
)

func TestDecodeJSONBody_AllowsPayloadWithinLimit(t *testing.T) {
	body := strings.NewReader(`{"name":"anthology"}`)
	req := httptest.NewRequest("POST", "/api/items", body)
	rec := httptest.NewRecorder()

	var dst map[string]string
	if err := decodeJSONBody(rec, req, &dst); err != nil {
		t.Fatalf("decodeJSONBody returned error: %v", err)
	}
	if dst["name"] != "anthology" {
		t.Fatalf("expected key to be decoded, got %v", dst)
	}
}

func TestDecodeJSONBody_RejectsPayloadExceedingLimit(t *testing.T) {
	var b strings.Builder
	b.Grow(int(maxJSONBodyBytes) + 32)
	b.WriteString(`{"data":"`)
	for i := int64(0); i < maxJSONBodyBytes; i++ {
		b.WriteByte('a')
	}
	b.WriteString(`"}`)

	req := httptest.NewRequest("POST", "/api/items", strings.NewReader(b.String()))
	rec := httptest.NewRecorder()

	var dst map[string]string
	err := decodeJSONBody(rec, req, &dst)
	if err == nil {
		t.Fatal("expected error for oversized payload")
	}
	if !strings.Contains(err.Error(), "payload too large") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestItemHandlerImportCSVSuccess(t *testing.T) {
	store := &csvStoreStub{}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	importerSvc := importer.NewCSVImporter(store, nil)
	handler := NewItemHandler(nil, nil, importerSvc, logger)
	req := newMultipartCSVRequest(t, strings.Join([]string{
		"title,creator,itemType,releaseYear,pageCount,isbn13,isbn10,description,coverImage,notes",
		"Title A,Creator,book,2020,300,9780000000001,0000000001,Desc,,Notes",
		"Title B,Director,movie,,,,,,,",
	}, "\n"))
	rec := httptest.NewRecorder()

	handler.ImportCSV(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var summary importer.Summary
	if err := json.Unmarshal(rec.Body.Bytes(), &summary); err != nil {
		t.Fatalf("response should decode: %v", err)
	}

	if summary.Imported != 2 || summary.TotalRows != 2 {
		t.Fatalf("expected summary to be returned, got %+v", summary)
	}

	if len(store.items) != 2 {
		t.Fatalf("expected importer to persist rows, got %d", len(store.items))
	}
}

func TestItemHandlerImportCSVValidationError(t *testing.T) {
	store := &csvStoreStub{}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	importerSvc := importer.NewCSVImporter(store, nil)
	handler := NewItemHandler(nil, nil, importerSvc, logger)
	req := newMultipartCSVRequest(t, "title,itemType\nbad,csv\n")
	rec := httptest.NewRecorder()

	handler.ImportCSV(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}
}

func TestItemHandlerImportCSVUnavailable(t *testing.T) {
	handler := NewItemHandler(nil, nil, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
	req := newMultipartCSVRequest(t, "title\nA\n")
	rec := httptest.NewRecorder()

	handler.ImportCSV(rec, req)

	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("expected status 501, got %d", rec.Code)
	}
}

func newMultipartCSVRequest(t *testing.T, csv string) *http.Request {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "import.csv")
	if err != nil {
		t.Fatalf("failed to create multipart form: %v", err)
	}
	if _, err := io.Copy(part, strings.NewReader(csv)); err != nil {
		t.Fatalf("failed to write csv: %v", err)
	}
	writer.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/items/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

type csvStoreStub struct {
	items []items.Item
}

func (s *csvStoreStub) Create(ctx context.Context, input items.CreateItemInput) (items.Item, error) {
	item := items.Item{ID: uuid.New(), Title: input.Title, Creator: input.Creator, ItemType: input.ItemType}
	s.items = append(s.items, item)
	return item, nil
}

func (s *csvStoreStub) List(ctx context.Context, opts items.ListOptions) ([]items.Item, error) {
	itemsCopy := make([]items.Item, len(s.items))
	copy(itemsCopy, s.items)
	return itemsCopy, nil
}
