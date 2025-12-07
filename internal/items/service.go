package items

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	maxCoverImageBytes     = 500 * 1024
	maxCoverImageURLLength = 4096
)

// allowedImageMIMETypes lists permitted MIME types for data URI images.
var allowedImageMIMETypes = map[string]bool{
	"image/jpeg":    true,
	"image/png":     true,
	"image/gif":     true,
	"image/webp":    true,
	"image/svg+xml": true,
}

// Service orchestrates validation and persistence for items.
type Service struct {
	repo Repository
}

// NewService wires a Service with the provided repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create validates and persists a new item.
func (s *Service) Create(ctx context.Context, input CreateItemInput) (Item, error) {
	if err := validateItemInput(input.Title, input.ItemType); err != nil {
		return Item{}, err
	}

	pageCount := normalizePositiveInt(input.PageCount)
	currentPage, err := normalizeCurrentPage(input.CurrentPage)
	if err != nil {
		return Item{}, err
	}

	readingStatus, readAt, normalizedCurrentPage, err := normalizeBookFields(input.ItemType, input.ReadingStatus, input.ReadAt, pageCount, currentPage)
	if err != nil {
		return Item{}, err
	}

	coverImage, err := sanitizeCoverImage(input.CoverImage)
	if err != nil {
		return Item{}, err
	}

	now := time.Now().UTC()
	item := Item{
		ID:            uuid.New(),
		Title:         strings.TrimSpace(input.Title),
		Creator:       strings.TrimSpace(input.Creator),
		ItemType:      input.ItemType,
		ReleaseYear:   normalizeYear(input.ReleaseYear),
		PageCount:     pageCount,
		CurrentPage:   normalizedCurrentPage,
		ISBN13:        strings.TrimSpace(input.ISBN13),
		ISBN10:        strings.TrimSpace(input.ISBN10),
		Description:   strings.TrimSpace(input.Description),
		CoverImage:    coverImage,
		ReadingStatus: readingStatus,
		ReadAt:        readAt,
		Notes:         strings.TrimSpace(input.Notes),
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	return s.repo.Create(ctx, item)
}

// List returns catalogued items ordered by creation date descending.
func (s *Service) List(ctx context.Context, opts ListOptions) ([]Item, error) {
	items, err := s.repo.List(ctx, opts)
	if err != nil {
		return nil, err
	}

	slices.SortFunc(items, compareItemsByCreatedDesc)

	if opts.Limit != nil && *opts.Limit >= 0 && len(items) > *opts.Limit {
		items = items[:*opts.Limit]
	}

	return items, nil
}

// Get retrieves an item by ID.
func (s *Service) Get(ctx context.Context, id uuid.UUID) (Item, error) {
	return s.repo.Get(ctx, id)
}

// Update applies modifications to an item.
func (s *Service) Update(ctx context.Context, id uuid.UUID, input UpdateItemInput) (Item, error) {
	existing, err := s.repo.Get(ctx, id)
	if err != nil {
		return Item{}, err
	}

	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" {
			return Item{}, validationErr("title is required")
		}
		existing.Title = title
	}

	if input.ItemType != nil {
		if *input.ItemType == "" {
			return Item{}, validationErr("itemType is required")
		}
		existing.ItemType = *input.ItemType
	}

	if input.Creator != nil {
		existing.Creator = strings.TrimSpace(*input.Creator)
	}

	if input.ReleaseYear != nil {
		existing.ReleaseYear = normalizeYear(*input.ReleaseYear)
	}

	if input.PageCount != nil {
		existing.PageCount = normalizePositiveInt(*input.PageCount)
	}

	if input.CurrentPage != nil {
		value, err := normalizeCurrentPage(*input.CurrentPage)
		if err != nil {
			return Item{}, err
		}
		existing.CurrentPage = value
	}

	if input.Notes != nil {
		existing.Notes = strings.TrimSpace(*input.Notes)
	}

	if input.ISBN13 != nil {
		existing.ISBN13 = strings.TrimSpace(*input.ISBN13)
	}

	if input.ISBN10 != nil {
		existing.ISBN10 = strings.TrimSpace(*input.ISBN10)
	}

	if input.Description != nil {
		existing.Description = strings.TrimSpace(*input.Description)
	}

	if input.CoverImage != nil {
		coverImage, err := sanitizeCoverImage(*input.CoverImage)
		if err != nil {
			return Item{}, err
		}
		existing.CoverImage = coverImage
	}

	readingStatus := existing.ReadingStatus
	if input.ReadingStatus != nil {
		readingStatus = *input.ReadingStatus
	}

	readAt := existing.ReadAt
	if input.ReadAt != nil {
		readAt = *input.ReadAt
	}

	normalizedStatus, normalizedReadAt, normalizedCurrentPage, err := normalizeBookFields(existing.ItemType, readingStatus, readAt, existing.PageCount, existing.CurrentPage)
	if err != nil {
		return Item{}, err
	}

	existing.ReadingStatus = normalizedStatus
	existing.ReadAt = normalizedReadAt
	existing.CurrentPage = normalizedCurrentPage
	existing.UpdatedAt = time.Now().UTC()
	return s.repo.Update(ctx, existing)
}

// Delete removes an item by ID.
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

// Histogram returns a count of items grouped by first letter of title.
func (s *Service) Histogram(ctx context.Context, opts HistogramOptions) (LetterHistogram, int, error) {
	histogram, err := s.repo.Histogram(ctx, opts)
	if err != nil {
		return nil, 0, err
	}

	total := 0
	for _, count := range histogram {
		total += count
	}

	return histogram, total, nil
}

// FindDuplicates searches for items matching the given title or identifiers.
// Title matching is case-insensitive with whitespace trimmed.
// Identifier matching strips non-digit characters for normalization.
func (s *Service) FindDuplicates(ctx context.Context, input DuplicateCheckInput) ([]DuplicateMatch, error) {
	return s.repo.FindDuplicates(ctx, input)
}

// NormalizeTitle prepares a title for duplicate comparison by lowercasing and trimming whitespace.
func NormalizeTitle(title string) string {
	return strings.ToLower(strings.TrimSpace(title))
}

// NormalizeIdentifier strips all non-digit characters from an identifier (ISBN, UPC, EAN).
func NormalizeIdentifier(value string) string {
	cleaned := strings.TrimSpace(value)
	if cleaned == "" {
		return ""
	}
	var builder strings.Builder
	for _, r := range cleaned {
		if r >= '0' && r <= '9' {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func validationErr(msg string) error {
	return &ValidationError{Message: msg}
}

func validateItemInput(title string, itemType ItemType) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return validationErr("title is required")
	}
	if itemType == "" {
		return validationErr("itemType is required")
	}
	return nil
}

func compareItemsByCreatedDesc(a, b Item) int {
	if a.CreatedAt.Equal(b.CreatedAt) {
		return strings.Compare(a.Title, b.Title)
	}
	if a.CreatedAt.After(b.CreatedAt) {
		return -1
	}
	return 1
}

func normalizeYear(year *int) *int {
	if year == nil {
		return nil
	}
	if *year < 0 {
		return nil
	}
	value := *year
	return &value
}

func normalizePositiveInt(value *int) *int {
	if value == nil {
		return nil
	}
	if *value <= 0 {
		return nil
	}
	v := *value
	return &v
}

func normalizeCurrentPage(value *int) (*int, error) {
	if value == nil {
		return nil, nil
	}
	v := *value
	if v < 0 {
		return nil, validationErr("currentPage must be zero or greater")
	}
	return &v, nil
}

func sanitizeCoverImage(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}

	if strings.HasPrefix(trimmed, "data:") {
		parts := strings.SplitN(trimmed, ",", 2)
		if len(parts) != 2 {
			return "", validationErr("coverImage data URI is invalid")
		}

		// Extract and validate MIME type from the data URI header (e.g., "data:image/png;base64")
		header := parts[0]
		mimeType := strings.TrimPrefix(header, "data:")
		mimeType = strings.TrimSuffix(mimeType, ";base64")
		mimeType = strings.ToLower(mimeType)
		if !allowedImageMIMETypes[mimeType] {
			return "", validationErr("coverImage must be a valid image type (JPEG, PNG, GIF, WebP, or SVG)")
		}

		if _, err := base64.StdEncoding.DecodeString(parts[1]); err != nil {
			return "", validationErr("coverImage must contain valid base64 image data")
		}

		estimatedBytes := len(parts[1]) * 3 / 4
		if estimatedBytes > maxCoverImageBytes {
			return "", validationErr(fmt.Sprintf("coverImage must be smaller than %dKB", maxCoverImageBytes/1024))
		}

		return trimmed, nil
	}

	if len(trimmed) > maxCoverImageURLLength {
		return "", validationErr(fmt.Sprintf("coverImage must be shorter than %d characters", maxCoverImageURLLength))
	}

	// Validate external URL: must be valid URL with https scheme
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", validationErr("coverImage must be a valid URL")
	}
	if parsed.Scheme != "https" {
		return "", validationErr("coverImage URL must use HTTPS")
	}
	if parsed.Host == "" {
		return "", validationErr("coverImage URL must have a valid host")
	}

	return trimmed, nil
}

func normalizeBookFields(itemType ItemType, status BookStatus, readAt *time.Time, pageCount *int, currentPage *int) (BookStatus, *time.Time, *int, error) {
	if itemType != ItemTypeBook {
		return BookStatusUnknown, nil, nil, nil
	}

	switch status {
	case BookStatusUnknown:
		return BookStatusUnknown, nil, nil, nil
	case BookStatusWantToRead:
		return BookStatusWantToRead, nil, nil, nil
	case BookStatusRead:
		if readAt == nil || readAt.IsZero() {
			return BookStatusUnknown, nil, nil, validationErr("readAt is required when readingStatus is read")
		}

		normalized := readAt.UTC()
		return status, &normalized, nil, nil
	case BookStatusReading:
		normalizedPage, err := normalizeReadingProgress(currentPage, pageCount)
		if err != nil {
			return BookStatusUnknown, nil, nil, err
		}
		return status, nil, normalizedPage, nil
	default:
		return BookStatusUnknown, nil, nil, validationErr("readingStatus must be empty or one of read, reading, or want_to_read")
	}
}

func normalizeReadingProgress(currentPage *int, pageCount *int) (*int, error) {
	if currentPage == nil {
		return nil, nil
	}
	if pageCount != nil && *currentPage > *pageCount {
		return nil, validationErr("currentPage cannot exceed pageCount")
	}
	return currentPage, nil
}
