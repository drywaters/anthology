package catalog

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServiceLookupBookByISBN(t *testing.T) {
	var receivedPath string
	var receivedISBN string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedPath = r.URL.Path
		receivedISBN = r.URL.Query().Get("isbn")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"docs":[{"title":"Test Title","author_name":["Author One"],"first_publish_year":1999,"number_of_pages_median":464,"isbn":["9780385534796","0385534795"],"first_sentence":["A chilling opening line."]}]}`))
	}))
	defer server.Close()

	client := server.Client()
	svc := NewService(client, WithOpenLibraryURL(server.URL))

	metadata, err := svc.Lookup(context.Background(), "9780140328721", CategoryBook)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if receivedPath != "/search.json" {
		t.Fatalf("expected request to /search.json, got %s", receivedPath)
	}

	if receivedISBN != "9780140328721" {
		t.Fatalf("expected isbn parameter to be forwarded, got %s", receivedISBN)
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
	if metadata.ReleaseYear == nil || *metadata.ReleaseYear != 1999 {
		t.Fatalf("expected release year 1999, got %v", metadata.ReleaseYear)
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
	if metadata.Description != "A chilling opening line." {
		t.Fatalf("expected description from first sentence, got %q", metadata.Description)
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
