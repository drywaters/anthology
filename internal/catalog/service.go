package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode"

	"anthology/internal/items"
)

// Category represents supported lookup categories.
type Category string

const (
	// CategoryBook resolves metadata for books via Open Library.
	CategoryBook Category = "book"
	// CategoryGame is reserved for future expansion.
	CategoryGame Category = "game"
	// CategoryMovie is reserved for future expansion.
	CategoryMovie Category = "movie"
	// CategoryMusic is reserved for future expansion.
	CategoryMusic Category = "music"
)

var (
	// ErrInvalidQuery is returned when the lookup query is empty or too short.
	ErrInvalidQuery = errors.New("query must be at least 3 characters")
	// ErrUnsupportedCategory is returned when the category is not implemented.
	ErrUnsupportedCategory = errors.New("unsupported lookup category")
	// ErrNotFound is returned when no metadata could be located for the query.
	ErrNotFound = errors.New("no metadata found for the supplied query")
)

// Metadata captures the subset of item fields populated by lookups.
type Metadata struct {
	Title       string         `json:"title"`
	Creator     string         `json:"creator"`
	ItemType    items.ItemType `json:"itemType"`
	ReleaseYear *int           `json:"releaseYear,omitempty"`
	Notes       string         `json:"notes"`
}

// Service performs metadata lookups against third-party catalog APIs.
type Service struct {
	client         *http.Client
	openLibraryURL string
}

const defaultOpenLibraryURL = "https://openlibrary.org"

// Option configures the Service during construction.
type Option func(*Service)

// WithOpenLibraryURL overrides the base URL for Open Library requests.
func WithOpenLibraryURL(baseURL string) Option {
	return func(s *Service) {
		s.openLibraryURL = strings.TrimRight(baseURL, "/")
	}
}

// NewService constructs a Service.
func NewService(client *http.Client, opts ...Option) *Service {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}

	svc := &Service{
		client:         client,
		openLibraryURL: defaultOpenLibraryURL,
	}

	for _, opt := range opts {
		opt(svc)
	}

	return svc
}

// Lookup attempts to fetch metadata for the supplied query and category.
func (s *Service) Lookup(ctx context.Context, query string, category Category) (Metadata, error) {
	cleaned := strings.TrimSpace(query)
	if len(cleaned) < 3 {
		return Metadata{}, ErrInvalidQuery
	}

	switch category {
	case CategoryBook:
		return s.lookupBook(ctx, cleaned)
	case CategoryGame, CategoryMovie, CategoryMusic:
		return Metadata{}, ErrUnsupportedCategory
	default:
		return Metadata{}, ErrUnsupportedCategory
	}
}

type openLibrarySearchResponse struct {
	Docs []struct {
		Title            string   `json:"title"`
		AuthorName       []string `json:"author_name"`
		FirstPublishYear *int     `json:"first_publish_year"`
		PublishYear      []int    `json:"publish_year"`
	} `json:"docs"`
}

func (s *Service) lookupBook(ctx context.Context, query string) (Metadata, error) {
	endpoint, err := url.Parse(s.openLibraryURL + "/search.json")
	if err != nil {
		return Metadata{}, fmt.Errorf("build open library url: %w", err)
	}

	values := url.Values{}
	if isbn := normalizeISBN(query); isbn != "" {
		values.Set("isbn", isbn)
	} else {
		values.Set("q", query)
	}
	values.Set("limit", "1")
	endpoint.RawQuery = values.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return Metadata{}, fmt.Errorf("create open library request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return Metadata{}, fmt.Errorf("call open library: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Metadata{}, fmt.Errorf("open library returned status %d", resp.StatusCode)
	}

	var payload openLibrarySearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return Metadata{}, fmt.Errorf("decode open library response: %w", err)
	}

	if len(payload.Docs) == 0 {
		return Metadata{}, ErrNotFound
	}

	doc := payload.Docs[0]
	title := strings.TrimSpace(doc.Title)
	creator := strings.TrimSpace(strings.Join(doc.AuthorName, ", "))

	if title == "" && creator == "" {
		return Metadata{}, ErrNotFound
	}

	metadata := Metadata{
		Title:    title,
		Creator:  creator,
		ItemType: items.ItemTypeBook,
		Notes:    "",
	}

	if doc.FirstPublishYear != nil {
		metadata.ReleaseYear = doc.FirstPublishYear
	} else if len(doc.PublishYear) > 0 {
		year := doc.PublishYear[0]
		metadata.ReleaseYear = &year
	}

	return metadata, nil
}

func normalizeISBN(value string) string {
	cleaned := make([]rune, 0, len(value))
	for _, r := range value {
		if unicode.IsDigit(r) {
			cleaned = append(cleaned, r)
			continue
		}
		if r == 'X' || r == 'x' {
			cleaned = append(cleaned, 'X')
			continue
		}
	}

	switch len(cleaned) {
	case 10:
		for i := 0; i < 9; i++ {
			if !unicode.IsDigit(cleaned[i]) {
				return ""
			}
		}
		last := cleaned[9]
		if !(unicode.IsDigit(last) || last == 'X') {
			return ""
		}
	case 13:
		for _, r := range cleaned {
			if !unicode.IsDigit(r) {
				return ""
			}
		}
	default:
		return ""
	}

	return string(cleaned)
}
