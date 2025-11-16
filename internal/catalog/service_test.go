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
			Notes:       "Some notes",
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

	if metadata.Description != "A real description" {
		t.Fatalf("expected description from book data, got %q", metadata.Description)
	}

	if metadata.PageCount == nil || *metadata.PageCount != 400 {
		t.Fatalf("expected page count from book data, got %+v", metadata.PageCount)
	}

	if metadata.ISBN13 != "1234567890123" || metadata.ISBN10 != "1234567890" {
		t.Fatalf("expected both ISBNs from book data, got %q and %q", metadata.ISBN13, metadata.ISBN10)
	}

	if metadata.ReleaseYear == nil || *metadata.ReleaseYear != 1980 {
		t.Fatalf("expected release year to be set, got %+v", metadata.ReleaseYear)
	}
}

func TestLookupBookBySearchFallsBackToSearchDoc(t *testing.T) {
	searchPayload := openLibrarySearchResponse{
		Docs: []openLibrarySearchDoc{
			{
				Title:            "Fallback Title",
				AuthorName:       []string{"Another Author"},
				FirstPublishYear: intPtr(1999),
				PublishYear:      []int{1999, 2000},
				NumberOfPages:    intPtr(250),
				ISBN:             []string{"9876543210123", "0987654321"},
				FirstSentence: map[string]any{
					"value": "A fallback description",
				},
				Subtitle: "Fallback",
			},
		},
	}

	bookData := openLibraryBookDataResponse{}

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

	metadata, err := svc.Lookup(context.Background(), "fallback", CategoryBook)
	if err != nil {
		t.Fatalf("lookup failed: %v", err)
	}

	if metadata.Description != "A fallback description" {
		t.Fatalf("expected description from search doc, got %q", metadata.Description)
	}

	if metadata.PageCount == nil || *metadata.PageCount != 250 {
		t.Fatalf("expected page count from search doc, got %+v", metadata.PageCount)
	}

	if metadata.ISBN13 != "9876543210123" || metadata.ISBN10 != "0987654321" {
		t.Fatalf("expected ISBNs from search doc, got %q and %q", metadata.ISBN13, metadata.ISBN10)
	}

	if metadata.ReleaseYear == nil || *metadata.ReleaseYear != 1999 {
		t.Fatalf("expected release year from search doc, got %+v", metadata.ReleaseYear)
	}
}

func intPtr(value int) *int {
	v := value
	return &v
}
