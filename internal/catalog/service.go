package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
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
	PageCount   *int           `json:"pageCount,omitempty"`
	ISBN13      string         `json:"isbn13"`
	ISBN10      string         `json:"isbn10"`
	Description string         `json:"description"`
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

type openLibrarySearchDoc struct {
	Title            string   `json:"title"`
	AuthorName       []string `json:"author_name"`
	FirstPublishYear *int     `json:"first_publish_year"`
	PublishYear      []int    `json:"publish_year"`
	NumberOfPages    *int     `json:"number_of_pages_median"`
	ISBN             []string `json:"isbn"`
	FirstSentence    any      `json:"first_sentence"`
	Subtitle         string   `json:"subtitle"`
	Key              string   `json:"key"`
}

type openLibrarySearchResponse struct {
	Docs []openLibrarySearchDoc `json:"docs"`
}

var openLibrarySearchFields = strings.Join([]string{
	"title",
	"author_name",
	"first_publish_year",
	"publish_year",
	"number_of_pages_median",
	"isbn",
	"first_sentence",
	"subtitle",
	"key",
}, ",")

type openLibraryBookDataResponse map[string]openLibraryBookDataEntry

type openLibraryBookDataEntry struct {
	Title         string              `json:"title"`
	Subtitle      string              `json:"subtitle"`
	NumberOfPages *int                `json:"number_of_pages"`
	PublishDate   string              `json:"publish_date"`
	Authors       []openLibraryAuthor `json:"authors"`
	Identifiers   map[string][]string `json:"identifiers"`
	Description   any                 `json:"description"`
	Notes         any                 `json:"notes"`
}

type openLibraryAuthor struct {
	Name string `json:"name"`
}

func (s *Service) lookupBook(ctx context.Context, query string) (Metadata, error) {
	if isbn := normalizeISBN(query); isbn != "" {
		metadata, err := s.lookupBookByISBN(ctx, isbn)
		if err == nil {
			return metadata, nil
		}
		if !errors.Is(err, ErrNotFound) {
			return Metadata{}, err
		}
		return s.lookupBookBySearch(ctx, isbn)
	}

	return s.lookupBookBySearch(ctx, query)
}

func (s *Service) lookupBookByISBN(ctx context.Context, isbn string) (Metadata, error) {
	endpoint, err := url.Parse(s.openLibraryURL + "/api/books")
	if err != nil {
		return Metadata{}, fmt.Errorf("build open library book url: %w", err)
	}

	values := url.Values{}
	values.Set("bibkeys", "ISBN:"+isbn)
	values.Set("format", "json")
	values.Set("jscmd", "data")
	endpoint.RawQuery = values.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return Metadata{}, fmt.Errorf("create open library book request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return Metadata{}, fmt.Errorf("call open library book api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Metadata{}, fmt.Errorf("open library returned status %d", resp.StatusCode)
	}

	var payload openLibraryBookDataResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return Metadata{}, fmt.Errorf("decode open library book response: %w", err)
	}

	entry, ok := payload["ISBN:"+isbn]
	if !ok {
		return Metadata{}, ErrNotFound
	}

	title := strings.TrimSpace(entry.Title)
	creator := strings.TrimSpace(joinAuthorNames(entry.Authors))
	if title == "" && creator == "" {
		return Metadata{}, ErrNotFound
	}

	isbn13, isbn10 := selectISBNs(append(entry.Identifiers["isbn_13"], entry.Identifiers["isbn_10"]...))
	if isbn13 == "" && len(isbn) == 13 {
		isbn13 = isbn
	}
	if isbn10 == "" {
		if alt := firstIdentifier(entry.Identifiers["isbn_10"]); alt != "" {
			isbn10 = alt
		} else if len(isbn) == 10 {
			isbn10 = isbn
		}
	}

	description := textValue(entry.Description)
	if description == "" {
		description = strings.TrimSpace(entry.Subtitle)
	}

	notes := textValue(entry.Notes)

	metadata := Metadata{
		Title:       title,
		Creator:     creator,
		ItemType:    items.ItemTypeBook,
		PageCount:   entry.NumberOfPages,
		ISBN13:      isbn13,
		ISBN10:      isbn10,
		Description: description,
		Notes:       notes,
	}

	if year := parsePublishYear(entry.PublishDate); year != nil {
		metadata.ReleaseYear = year
	}

	return metadata, nil
}

func (s *Service) lookupBookBySearch(ctx context.Context, query string) (Metadata, error) {
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
	values.Set("fields", openLibrarySearchFields)
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

	isbn13, isbn10 := selectISBNs(doc.ISBN)
	description := deriveDescription(doc.FirstSentence, doc.Subtitle)

	releaseYear := releaseYearFromDoc(doc)

	if enriched, err := s.enrichMetadataFromISBN(ctx, isbn13, isbn10, releaseYear); err == nil {
		return enriched, nil
	} else if err != nil && !errors.Is(err, ErrNotFound) {
		return Metadata{}, err
	}

	metadata := Metadata{
		Title:       title,
		Creator:     creator,
		ItemType:    items.ItemTypeBook,
		PageCount:   doc.NumberOfPages,
		ISBN13:      isbn13,
		ISBN10:      isbn10,
		Description: description,
		Notes:       "",
	}

	if releaseYear != nil {
		metadata.ReleaseYear = releaseYear
	}

	return metadata, nil
}

func (s *Service) enrichMetadataFromISBN(ctx context.Context, isbn13, isbn10 string, releaseYear *int) (Metadata, error) {
	tryISBN := func(isbn string, fallback func(*Metadata)) (Metadata, error) {
		if isbn == "" {
			return Metadata{}, ErrNotFound
		}
		metadata, err := s.lookupBookByISBN(ctx, isbn)
		if err != nil {
			return Metadata{}, err
		}
		if releaseYear != nil && metadata.ReleaseYear == nil {
			metadata.ReleaseYear = releaseYear
		}
		if fallback != nil {
			fallback(&metadata)
		}
		return metadata, nil
	}

	metadata, err := tryISBN(isbn13, func(metadata *Metadata) {
		if metadata.ISBN10 == "" {
			metadata.ISBN10 = isbn10
		}
	})
	if err == nil {
		return metadata, nil
	}
	if err != nil && !errors.Is(err, ErrNotFound) {
		return Metadata{}, err
	}

	metadata, err = tryISBN(isbn10, func(metadata *Metadata) {
		if metadata.ISBN13 == "" {
			metadata.ISBN13 = isbn13
		}
	})
	if err == nil {
		return metadata, nil
	}
	return Metadata{}, err
}

func selectISBNs(values []string) (string, string) {
	var isbn13 string
	var isbn10 string
	for _, value := range values {
		clean := strings.TrimSpace(value)
		if len(clean) == 13 && isbn13 == "" {
			isbn13 = clean
			continue
		}
		if len(clean) == 10 && isbn10 == "" {
			isbn10 = clean
		}
	}
	return isbn13, isbn10
}

func deriveDescription(raw any, subtitle string) string {
	if text := textValue(raw); text != "" {
		return text
	}
	return strings.TrimSpace(subtitle)
}

func textValue(raw any) string {
	switch value := raw.(type) {
	case string:
		return strings.TrimSpace(value)
	case []any:
		for _, entry := range value {
			if text := textValue(entry); text != "" {
				return text
			}
		}
	case map[string]any:
		if text, ok := value["value"]; ok {
			return textValue(text)
		}
	case map[string]string:
		if text, ok := value["value"]; ok {
			trimmed := strings.TrimSpace(text)
			if trimmed != "" {
				return trimmed
			}
		}
	}
	return ""
}

func joinAuthorNames(authors []openLibraryAuthor) string {
	names := make([]string, 0, len(authors))
	for _, author := range authors {
		trimmed := strings.TrimSpace(author.Name)
		if trimmed != "" {
			names = append(names, trimmed)
		}
	}
	return strings.Join(names, ", ")
}

var publishYearPattern = regexp.MustCompile(`(1[0-9]{3}|20[0-9]{2})`)

func parsePublishYear(raw string) *int {
	match := publishYearPattern.FindString(raw)
	if match == "" {
		return nil
	}
	year := 0
	_, err := fmt.Sscanf(match, "%d", &year)
	if err != nil {
		return nil
	}
	return &year
}

func firstIdentifier(values []string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
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

func releaseYearFromDoc(doc openLibrarySearchDoc) *int {
	if doc.FirstPublishYear != nil {
		return doc.FirstPublishYear
	}
	if len(doc.PublishYear) > 0 {
		year := doc.PublishYear[0]
		return &year
	}
	return nil
}
