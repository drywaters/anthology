package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"testing"
	"time"
)

func TestLookupBookByQueryReturnsMetadata(t *testing.T) {
	t.Parallel()
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/volumes" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		values := r.URL.Query()
		if got := values.Get("q"); got != "example keywords" {
			t.Fatalf("expected q=example keywords, got %s", got)
		}
		if got := values.Get("maxResults"); got != "5" {
			t.Fatalf("expected maxResults=5, got %s", got)
		}
		if got := values.Get("key"); got != "test-key" {
			t.Fatalf("expected key query param to be set, got %s", got)
		}

		resp := googleBooksResponse{
			Items: []googleVolume{
				{
					ID: "abc",
					VolumeInfo: googleVolumeInfo{
						Title:         "Example Title",
						Authors:       []string{"Author One", "Author Two"},
						Description:   "Full description",
						PublishedDate: "2001-09-17",
						PageCount:     352,
						IndustryIdentifiers: []googleIndustryIdentifier{
							{Type: "ISBN_13", Identifier: "9781234567897"},
							{Type: "ISBN_10", Identifier: "1234567890"},
						},
						ImageLinks: googleImageLinks{
							Thumbnail: "http://books.google.com/thumbnail.jpg",
						},
					},
				},
			},
		}

		_ = json.NewEncoder(w).Encode(resp)
	})

	server := newHTTPServer(t, handler)
	defer server.Close()

	svc := NewService(server.Client(), WithGoogleBooksBaseURL(server.URL), WithGoogleBooksAPIKey("test-key"))

	results, err := svc.Lookup(context.Background(), "example keywords", CategoryBook)
	if err != nil {
		t.Fatalf("lookup failed: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	entry := results[0]
	if entry.Title != "Example Title" {
		t.Fatalf("expected title to be populated, got %q", entry.Title)
	}
	if entry.Creator != "Author One, Author Two" {
		t.Fatalf("expected creator to match authors, got %q", entry.Creator)
	}
	if entry.PageCount == nil || *entry.PageCount != 352 {
		t.Fatalf("expected page count to be set, got %+v", entry.PageCount)
	}
	if entry.ReleaseYear == nil || *entry.ReleaseYear != 2001 {
		t.Fatalf("expected release year 2001, got %+v", entry.ReleaseYear)
	}
	if entry.ISBN13 != "9781234567897" || entry.ISBN10 != "1234567890" {
		t.Fatalf("expected both ISBNs to be set, got %q, %q", entry.ISBN13, entry.ISBN10)
	}
	if entry.CoverImage != "https://books.google.com/thumbnail.jpg" {
		t.Fatalf("expected cover image to be normalized, got %q", entry.CoverImage)
	}
}

func TestLookupBookByISBNFillsMissingIdentifiers(t *testing.T) {
	t.Parallel()
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		values := r.URL.Query()
		if got := values.Get("q"); got != "isbn:1234567890" {
			t.Fatalf("expected ISBN query, got %s", got)
		}
		if got := values.Get("maxResults"); got != "1" {
			t.Fatalf("expected maxResults=1, got %s", got)
		}

		resp := googleBooksResponse{
			Items: []googleVolume{
				{
					ID: "isbn-volume",
					VolumeInfo: googleVolumeInfo{
						Title:         "ISBN Lookup",
						Authors:       []string{"Solo Author"},
						Subtitle:      "Subtitle",
						PublishedDate: "1998",
						PageCount:     200,
						IndustryIdentifiers: []googleIndustryIdentifier{
							{Type: "ISBN_13", Identifier: "9781111111111"},
						},
						ImageLinks: googleImageLinks{
							SmallThumbnail: "https://books.google.com/small-thumb.jpg",
						},
					},
				},
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	})

	server := newHTTPServer(t, handler)
	defer server.Close()

	svc := NewService(server.Client(), WithGoogleBooksBaseURL(server.URL), WithGoogleBooksAPIKey("test-key"))
	results, err := svc.Lookup(context.Background(), "1234567890", CategoryBook)
	if err != nil {
		t.Fatalf("lookup failed: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	entry := results[0]
	if entry.ISBN10 != "1234567890" {
		t.Fatalf("expected ISBN10 to fall back to query value, got %q", entry.ISBN10)
	}
	if entry.ISBN13 != "9781111111111" {
		t.Fatalf("expected ISBN13 from response, got %q", entry.ISBN13)
	}
	if entry.Description != "Subtitle" {
		t.Fatalf("expected subtitle fallback for description, got %q", entry.Description)
	}
	if entry.CoverImage != "https://books.google.com/small-thumb.jpg" {
		t.Fatalf("expected cover image to match link, got %q", entry.CoverImage)
	}
}

func TestLookupBookByQueryReturnsNotFoundWhenEmpty(t *testing.T) {
	t.Parallel()
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(googleBooksResponse{})
	})

	server := newHTTPServer(t, handler)
	defer server.Close()

	svc := NewService(server.Client(), WithGoogleBooksBaseURL(server.URL), WithGoogleBooksAPIKey("test-key"))
	_, err := svc.Lookup(context.Background(), "unknown", CategoryBook)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestLookupRejectsShortQueries(t *testing.T) {
	svc := NewService(nil, WithGoogleBooksAPIKey("test"))
	if _, err := svc.Lookup(context.Background(), "no", CategoryBook); !errors.Is(err, ErrInvalidQuery) {
		t.Fatalf("expected ErrInvalidQuery, got %v", err)
	}
}

type testServer struct {
	URL    string
	client *http.Client
	stop   func()
}

func (s *testServer) Close() {
	if s.stop != nil {
		s.stop()
	}
}

func (s *testServer) Client() *http.Client {
	return s.client
}

func newHTTPServer(t *testing.T, handler http.Handler) *testServer {
	t.Helper()
	ln, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen tcp4: %v", err)
	}

	srv := &http.Server{Handler: handler}
	go func() {
		_ = srv.Serve(ln)
	}()

	stop := func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	}

	return &testServer{
		URL:    "http://" + ln.Addr().String(),
		client: &http.Client{},
		stop:   stop,
	}
}
