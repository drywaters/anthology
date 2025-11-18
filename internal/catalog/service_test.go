package catalog

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLookupBookBySearchEnrichesWithBookData(t *testing.T) {
	searchPayload := openLibrarySearchResponse{
		Docs: []openLibrarySearchDoc{
			{
				Title:            "Example Title",
				AuthorName:       []string{"Author"},
				FirstPublishYear: intPtr(1980),
				PublishYear:      []int{1980},
				NumberOfPages:    intPtr(320),
				ISBN:             []string{"1234567890123", "1234567890"},
				FirstSentence:    "A first sentence",
				Subtitle:         "A Story",
				Key:              "/works/OL123W",
			},
		},
	}

	bookData := openLibraryBookDataResponse{
		"ISBN:1234567890123": {
			Title:         "Example Title",
			Subtitle:      "A Story",
			NumberOfPages: intPtr(400),
			PublishDate:   "October 1980",
			Authors:       []openLibraryAuthor{{Name: "Author"}},
			Identifiers: map[string][]string{
				"isbn_13": {"1234567890123"},
				"isbn_10": {"1234567890"},
			},
			Description: "A real description",
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search.json":
			_ = json.NewEncoder(w).Encode(searchPayload)
		case "/api/books":
			_ = json.NewEncoder(w).Encode(bookData)
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer server.Close()

	svc := NewService(server.Client(), WithOpenLibraryURL(server.URL))

	metadata, err := svc.Lookup(context.Background(), "example", CategoryBook)
	if err != nil {
		t.Fatalf("lookup failed: %v", err)
	}

	if len(metadata) != 1 {
		t.Fatalf("expected a single result, got %d", len(metadata))
	}

	entry := metadata[0]
	if entry.Description != "A real description" {
		t.Fatalf("expected description from book data, got %q", entry.Description)
	}

	if entry.PageCount == nil || *entry.PageCount != 400 {
		t.Fatalf("expected page count from book data, got %+v", entry.PageCount)
	}

	if entry.ISBN13 != "1234567890123" || entry.ISBN10 != "1234567890" {
		t.Fatalf("expected both ISBNs from book data, got %q and %q", entry.ISBN13, entry.ISBN10)
	}

	if entry.ReleaseYear == nil || *entry.ReleaseYear != 1980 {
		t.Fatalf("expected release year to be set, got %+v", entry.ReleaseYear)
	}

	if entry.Notes != "" {
		t.Fatalf("expected notes to remain empty, got %q", entry.Notes)
	}
}

func TestLookupBookBySearchFallsBackToWorkDescription(t *testing.T) {
	searchPayload := openLibrarySearchResponse{
		Docs: []openLibrarySearchDoc{
			{
				Title:            "Fallback Title",
				AuthorName:       []string{"Another Author"},
				FirstPublishYear: intPtr(1999),
				PublishYear:      []int{1999, 2000},
				NumberOfPages:    intPtr(250),
				ISBN:             []string{"9876543210123", "0987654321"},
				Subtitle:         "",
				Key:              "/works/OL999W",
			},
		},
	}

	bookData := openLibraryBookDataResponse{}

	workPayload := openLibraryWorkResponse{Description: map[string]string{"value": "Work description"}}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search.json":
			_ = json.NewEncoder(w).Encode(searchPayload)
		case "/api/books":
			_ = json.NewEncoder(w).Encode(bookData)
		case "/works/OL999W.json":
			_ = json.NewEncoder(w).Encode(workPayload)
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer server.Close()

	svc := NewService(server.Client(), WithOpenLibraryURL(server.URL))

	metadata, err := svc.Lookup(context.Background(), "fallback", CategoryBook)
	if err != nil {
		t.Fatalf("lookup failed: %v", err)
	}

	if len(metadata) != 1 {
		t.Fatalf("expected a single result, got %d", len(metadata))
	}

	entry := metadata[0]
	if entry.Description != "Work description" {
		t.Fatalf("expected description from work API, got %q", entry.Description)
	}

	if entry.PageCount == nil || *entry.PageCount != 250 {
		t.Fatalf("expected page count from search doc, got %+v", entry.PageCount)
	}

	if entry.ISBN13 != "9876543210123" || entry.ISBN10 != "0987654321" {
		t.Fatalf("expected ISBNs from search doc, got %q and %q", entry.ISBN13, entry.ISBN10)
	}

	if entry.ReleaseYear == nil || *entry.ReleaseYear != 1999 {
		t.Fatalf("expected release year from search doc, got %+v", entry.ReleaseYear)
	}
}

func TestLookupBookBySearchReturnsMultipleResults(t *testing.T) {
	searchPayload := openLibrarySearchResponse{
		Docs: []openLibrarySearchDoc{
			{
				Title:      "First",
				AuthorName: []string{"Author One"},
				ISBN:       []string{"1234567890123"},
				Key:        "/works/OL1W",
			},
			{
				Title:      "Second",
				AuthorName: []string{"Author Two"},
				ISBN:       []string{"2234567890123"},
				Key:        "/works/OL2W",
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/search.json":
			_ = json.NewEncoder(w).Encode(searchPayload)
		case "/api/books":
			_ = json.NewEncoder(w).Encode(openLibraryBookDataResponse{})
		case "/works/OL1W.json", "/works/OL2W.json":
			_ = json.NewEncoder(w).Encode(openLibraryWorkResponse{})
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer server.Close()

	svc := NewService(server.Client(), WithOpenLibraryURL(server.URL))

	metadata, err := svc.Lookup(context.Background(), "keyword", CategoryBook)
	if err != nil {
		t.Fatalf("lookup failed: %v", err)
	}

	if len(metadata) != 2 {
		t.Fatalf("expected two results, got %d", len(metadata))
	}

	if metadata[0].Title != "First" || metadata[1].Title != "Second" {
		t.Fatalf("unexpected titles in results: %+v", metadata)
	}
}

func intPtr(value int) *int {
	v := value
	return &v
}
