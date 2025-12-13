package items

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"time"

	"anthology/internal/catalog"

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

	// Normalize book-specific extended fields
	format, genre, rating, retailPriceUsd, googleVolumeId := normalizeExtendedBookFields(
		input.ItemType,
		input.Format,
		input.Genre,
		input.Rating,
		input.RetailPriceUsd,
		input.GoogleVolumeId,
	)

	// Clear game-specific fields for non-game items
	platform, ageGroup, playerCount := normalizeGameFields(
		input.ItemType,
		input.Platform,
		input.AgeGroup,
		input.PlayerCount,
	)

	now := time.Now().UTC()
	item := Item{
		ID:             uuid.New(),
		Title:          strings.TrimSpace(input.Title),
		Creator:        strings.TrimSpace(input.Creator),
		ItemType:       input.ItemType,
		ReleaseYear:    normalizeYear(input.ReleaseYear),
		PageCount:      pageCount,
		CurrentPage:    normalizedCurrentPage,
		ISBN13:         strings.TrimSpace(input.ISBN13),
		ISBN10:         strings.TrimSpace(input.ISBN10),
		Description:    strings.TrimSpace(input.Description),
		CoverImage:     coverImage,
		Format:         format,
		Genre:          genre,
		Rating:         rating,
		RetailPriceUsd: retailPriceUsd,
		GoogleVolumeId: googleVolumeId,
		Platform:       platform,
		AgeGroup:       ageGroup,
		PlayerCount:    playerCount,
		ReadingStatus:  readingStatus,
		ReadAt:         readAt,
		Notes:          strings.TrimSpace(input.Notes),
		CreatedAt:      now,
		UpdatedAt:      now,
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

	if input.Platform != nil {
		existing.Platform = strings.TrimSpace(*input.Platform)
	}

	if input.AgeGroup != nil {
		existing.AgeGroup = strings.TrimSpace(*input.AgeGroup)
	}

	if input.PlayerCount != nil {
		existing.PlayerCount = strings.TrimSpace(*input.PlayerCount)
	}

	if input.Format != nil {
		existing.Format = normalizeFormat(*input.Format)
	}

	if input.Genre != nil {
		existing.Genre = normalizeGenre(*input.Genre)
	}

	if input.Rating != nil {
		existing.Rating = normalizeRating(*input.Rating)
	}

	if input.RetailPriceUsd != nil {
		existing.RetailPriceUsd = normalizePrice(*input.RetailPriceUsd)
	}

	if input.GoogleVolumeId != nil {
		existing.GoogleVolumeId = strings.TrimSpace(*input.GoogleVolumeId)
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

// ResyncMetadata refreshes an item's metadata from Google Books.
// Uses googleVolumeId if available, otherwise falls back to ISBN lookup.
// Only updates fields that Google provides (genre, retailPriceUsd, googleVolumeId).
// Does NOT overwrite user-entered fields like format and rating.
func (s *Service) ResyncMetadata(ctx context.Context, id uuid.UUID, catalogSvc *catalog.Service) (Item, error) {
	existing, err := s.repo.Get(ctx, id)
	if err != nil {
		return Item{}, err
	}

	if existing.ItemType != ItemTypeBook {
		return Item{}, validationErr("re-sync is only available for books")
	}

	var metadata catalog.Metadata
	var lookupErr error

	// Prefer volume ID for precise lookup
	if existing.GoogleVolumeId != "" {
		metadata, lookupErr = catalogSvc.LookupByVolumeID(ctx, existing.GoogleVolumeId)
		if lookupErr != nil && !errors.Is(lookupErr, catalog.ErrNotFound) {
			return Item{}, fmt.Errorf("lookup by volume ID: %w", lookupErr)
		}
	}

	// Fall back to ISBN if volume ID lookup failed or wasn't available
	if metadata.Title == "" {
		query := existing.ISBN13
		if query == "" {
			query = existing.ISBN10
		}
		if query == "" {
			return Item{}, validationErr("no googleVolumeId or ISBN available for re-sync")
		}

		results, err := catalogSvc.Lookup(ctx, query, catalog.CategoryBook)
		if err != nil {
			if errors.Is(err, catalog.ErrNotFound) {
				return Item{}, validationErr("no metadata found for this item")
			}
			return Item{}, fmt.Errorf("lookup by ISBN: %w", err)
		}
		if len(results) == 0 {
			return Item{}, validationErr("no metadata found for this item")
		}
		metadata = results[0]
	}

	// Apply refreshed metadata - only update Google-provided fields
	if metadata.GoogleVolumeId != "" {
		existing.GoogleVolumeId = metadata.GoogleVolumeId
	}
	if metadata.Genre != "" {
		existing.Genre = normalizeGenre(Genre(metadata.Genre))
	}
	if metadata.RetailPriceUsd != nil {
		existing.RetailPriceUsd = metadata.RetailPriceUsd
	}

	// Also refresh standard fields if they were empty and Google provides them
	if existing.CoverImage == "" && metadata.CoverImage != "" {
		existing.CoverImage = metadata.CoverImage
	}
	if existing.Description == "" && metadata.Description != "" {
		existing.Description = metadata.Description
	}

	existing.UpdatedAt = time.Now().UTC()
	return s.repo.Update(ctx, existing)
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
	if status == "" {
		status = BookStatusNone
	}

	if itemType != ItemTypeBook {
		return BookStatusNone, nil, nil, nil
	}

	switch status {
	case BookStatusNone:
		return BookStatusNone, nil, nil, nil
	case BookStatusWantToRead:
		return BookStatusWantToRead, nil, nil, nil
	case BookStatusRead:
		if readAt == nil || readAt.IsZero() {
			return BookStatusNone, nil, nil, validationErr("readAt is required when readingStatus is read")
		}

		normalized := readAt.UTC()
		return status, &normalized, nil, nil
	case BookStatusReading:
		normalizedPage, err := normalizeReadingProgress(currentPage, pageCount)
		if err != nil {
			return BookStatusNone, nil, nil, err
		}
		return status, nil, normalizedPage, nil
	default:
		return BookStatusNone, nil, nil, validationErr("readingStatus must be one of none, read, reading, or want_to_read")
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

// normalizeExtendedBookFields normalizes book-specific extended metadata fields.
// For non-book items, all fields are cleared/zeroed.
func normalizeExtendedBookFields(itemType ItemType, format Format, genre Genre, rating *int, price *float64, volumeId string) (Format, Genre, *int, *float64, string) {
	if itemType != ItemTypeBook {
		return "", "", nil, nil, ""
	}
	return normalizeFormat(format), normalizeGenre(genre), normalizeRating(rating), normalizePrice(price), strings.TrimSpace(volumeId)
}

// normalizeGameFields normalizes game-specific fields.
// For non-game items, all fields are cleared.
func normalizeGameFields(itemType ItemType, platform, ageGroup, playerCount string) (string, string, string) {
	if itemType != ItemTypeGame {
		return "", "", ""
	}
	return strings.TrimSpace(platform), strings.TrimSpace(ageGroup), strings.TrimSpace(playerCount)
}

// normalizeFormat validates and normalizes the format enum.
func normalizeFormat(format Format) Format {
	switch format {
	case FormatHardcover, FormatPaperback, FormatSoftcover, FormatEbook, FormatMagazine:
		return format
	default:
		return FormatUnknown
	}
}

// normalizeGenre validates and normalizes the genre enum.
func normalizeGenre(genre Genre) Genre {
	switch genre {
	case GenreFiction, GenreNonFiction, GenreScienceTech, GenreHistory,
		GenreBiography, GenreChildrens, GenreArtsEntertainment, GenreReferenceOther:
		return genre
	default:
		return ""
	}
}

// normalizeRating ensures rating is within valid range (1-10).
func normalizeRating(rating *int) *int {
	if rating == nil {
		return nil
	}
	if *rating < 1 || *rating > 10 {
		return nil
	}
	v := *rating
	return &v
}

// normalizePrice ensures price is non-negative.
func normalizePrice(price *float64) *float64 {
	if price == nil {
		return nil
	}
	if *price < 0 {
		return nil
	}
	v := *price
	return &v
}
