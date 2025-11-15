package catalog

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestServiceLookupBookByISBN(t *testing.T) {
	var receivedPath string
	var receivedQuery string
	var searchHits int

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedPath = r.URL.Path
		receivedQuery = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		if strings.HasPrefix(r.URL.Path, "/api/books") {
			_, _ = w.Write([]byte(`{"ISBN:9780140328721":{"title":"Test Title","subtitle":"An extra note","publish_date":"May 2012","number_of_pages":464,"authors":[{"name":"Author One"}],"identifiers":{"isbn_13":["9780385534796"],"isbn_10":["0385534795"]},"description":{"value":"Rich description."},"notes":"Remember to re-read."}}`))
			return
		}
		searchHits++
		_, _ = w.Write([]byte(`{"docs":[]}`))
	}))
	defer server.Close()

	client := server.Client()
	svc := NewService(client, WithOpenLibraryURL(server.URL))

	metadata, err := svc.Lookup(context.Background(), "9780140328721", CategoryBook)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if receivedPath != "/api/books" {
		t.Fatalf("expected request to /api/books, got %s", receivedPath)
	}

	values, err := url.ParseQuery(receivedQuery)
	if err != nil {
		t.Fatalf("failed to parse query: %v", err)
	}
	if values.Get("bibkeys") != "ISBN:9780140328721" {
		t.Fatalf("expected ISBN bibkey to be sent, got %s", values.Get("bibkeys"))
	}

	if searchHits != 0 {
		t.Fatalf("expected book lookup to avoid search fallback, got %d search hits", searchHits)
	}

	if metadata.Title != "Test Title" {
		t.Errorf("expected title to be populated, got %q", metadata.Title)
	}
	if metadata.Creator != "Author One" {
		t.Errorf("expected creator to be populated, got %q", metadata.Creator)
	}
	if metadata.ItemType != "book" {
		t.Errorf("expected item type to be book, got %q", metadata.ItemType)
	}
	if metadata.ReleaseYear == nil || *metadata.ReleaseYear != 2012 {
		t.Fatalf("expected release year 2012, got %v", metadata.ReleaseYear)
	}
	if metadata.PageCount == nil || *metadata.PageCount != 464 {
		t.Fatalf("expected page count 464, got %v", metadata.PageCount)
	}
	if metadata.ISBN13 != "9780385534796" {
		t.Fatalf("expected isbn13 to be populated, got %q", metadata.ISBN13)
	}
	if metadata.ISBN10 != "0385534795" {
		t.Fatalf("expected isbn10 to be populated, got %q", metadata.ISBN10)
	}
	if metadata.Description != "Rich description." {
		t.Fatalf("expected description from book data, got %q", metadata.Description)
	}
	if metadata.Notes != "Remember to re-read." {
		t.Fatalf("expected notes from book data, got %q", metadata.Notes)
	}
}

func TestServiceLookupBookByISBNFallsBackToSearch(t *testing.T) {
	var searchCalled bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if strings.HasPrefix(r.URL.Path, "/api/books") {
			_, _ = w.Write([]byte(`{}`))
			return
		}
		searchCalled = true
		_, _ = w.Write([]byte(`{"docs":[{"title":"Fallback","author_name":["Someone"],"publish_year":[2003],"isbn":["9780000000002","0000000002"]}]}`))
	}))
	defer server.Close()

	client := server.Client()
	svc := NewService(client, WithOpenLibraryURL(server.URL))

	metadata, err := svc.Lookup(context.Background(), "9780000000002", CategoryBook)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if !searchCalled {
		t.Fatalf("expected fallback search to be invoked")
	}

	if metadata.Title != "Fallback" {
		t.Fatalf("expected fallback metadata, got %q", metadata.Title)
	}
}

func TestServiceLookupBookByKeyword(t *testing.T) {
	var receivedQuery string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedQuery = r.URL.Query().Get("q")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"docs":[{"title":"Keyword Title","author_name":["Author"],"publish_year":[2003]}]}`))
	}))
	defer server.Close()

	client := server.Client()
	svc := NewService(client, WithOpenLibraryURL(server.URL))

	metadata, err := svc.Lookup(context.Background(), "Some Query", CategoryBook)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if receivedQuery != "Some Query" {
		t.Fatalf("expected search query to be forwarded, got %q", receivedQuery)
	}

	if metadata.ReleaseYear == nil || *metadata.ReleaseYear != 2003 {
		t.Fatalf("expected release year from publish_year, got %v", metadata.ReleaseYear)
	}
}

func TestServiceLookupNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"docs":[]}`))
	}))
	defer server.Close()

	client := server.Client()
	svc := NewService(client, WithOpenLibraryURL(server.URL))

	_, err := svc.Lookup(context.Background(), "missing", CategoryBook)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestServiceLookupInvalidQuery(t *testing.T) {
	svc := NewService(nil)
	if _, err := svc.Lookup(context.Background(), "  ", CategoryBook); !errors.Is(err, ErrInvalidQuery) {
		t.Fatalf("expected ErrInvalidQuery, got %v", err)
	}
}

func TestServiceLookupUnsupportedCategory(t *testing.T) {
	svc := NewService(nil)
	if _, err := svc.Lookup(context.Background(), "query", CategoryGame); !errors.Is(err, ErrUnsupportedCategory) {
		t.Fatalf("expected ErrUnsupportedCategory, got %v", err)
	}
}

func TestTextValueMapValue(t *testing.T) {
	text := textValue(map[string]any{"value": "  Nested opening.  "})
	if text != "Nested opening." {
		t.Fatalf("expected to derive description from map value, got %q", text)
	}
}

func TestTextValueNestedValue(t *testing.T) {
	text := textValue(map[string]any{"value": map[string]string{"value": "Layered start."}})
	if text != "Layered start." {
		t.Fatalf("expected recursive extraction from nested map, got %q", text)
	}
}
