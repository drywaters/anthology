package http

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"log/slog"

	"anthology/internal/items"
)

func TestSeriesHandlerUpdateRejectsEmptyNewName(t *testing.T) {
	repo := &exportRepoStub{}
	service := items.NewService(repo)
	handler := NewSeriesHandler(service, slog.New(slog.NewTextHandler(io.Discard, nil)))

	req := httptest.NewRequest(http.MethodPut, "/api/series?name=Old", strings.NewReader(`{"newName":"   "}`))
	req = reqWithUser(req)
	rec := httptest.NewRecorder()

	handler.Update(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}

	var response map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response["error"] != "new series name is required" {
		t.Fatalf("expected validation error, got %v", response["error"])
	}
}

func TestSeriesHandlerUpdateRejectsOversizedBody(t *testing.T) {
	repo := &exportRepoStub{}
	service := items.NewService(repo)
	handler := NewSeriesHandler(service, slog.New(slog.NewTextHandler(io.Discard, nil)))

	hugeName := strings.Repeat("a", int(maxJSONBodyBytes))
	body := `{"newName":"` + hugeName + `"}`

	req := httptest.NewRequest(http.MethodPut, "/api/series?name=Old", strings.NewReader(body))
	req = reqWithUser(req)
	rec := httptest.NewRecorder()

	handler.Update(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected status 413, got %d", rec.Code)
	}
}
