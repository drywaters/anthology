package items

import (
	"context"
	"encoding/base64"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
)

const maxCoverImageBytes = 500 * 1024

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

	coverImage, err := sanitizeCoverImage(input.CoverImage)
	if err != nil {
		return Item{}, err
	}

	now := time.Now().UTC()
	item := Item{
		ID:          uuid.New(),
		Title:       strings.TrimSpace(input.Title),
		Creator:     strings.TrimSpace(input.Creator),
		ItemType:    input.ItemType,
		ReleaseYear: normalizeYear(input.ReleaseYear),
		PageCount:   normalizePositiveInt(input.PageCount),
		ISBN13:      strings.TrimSpace(input.ISBN13),
		ISBN10:      strings.TrimSpace(input.ISBN10),
		Description: strings.TrimSpace(input.Description),
		CoverImage:  coverImage,
		Notes:       strings.TrimSpace(input.Notes),
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	return s.repo.Create(ctx, item)
}

// List returns catalogued items ordered by creation date descending.
func (s *Service) List(ctx context.Context, opts ListOptions) ([]Item, error) {
	items, err := s.repo.List(ctx, opts)
	if err != nil {
		return nil, err
	}

	slices.SortFunc(items, func(a, b Item) int {
		if a.CreatedAt.Equal(b.CreatedAt) {
			return strings.Compare(a.Title, b.Title)
		}
		if a.CreatedAt.After(b.CreatedAt) {
			return -1
		}
		return 1
	})

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
			return Item{}, fmt.Errorf("title is required")
		}
		existing.Title = title
	}

	if input.ItemType != nil {
		if *input.ItemType == "" {
			return Item{}, fmt.Errorf("itemType is required")
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

	existing.UpdatedAt = time.Now().UTC()
	return s.repo.Update(ctx, existing)
}

// Delete removes an item by ID.
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

func validateItemInput(title string, itemType ItemType) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return fmt.Errorf("title is required")
	}
	if itemType == "" {
		return fmt.Errorf("itemType is required")
	}
	return nil
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

func sanitizeCoverImage(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}

	if len(trimmed) > 4096 {
		return "", fmt.Errorf("coverImage must be shorter than 4096 characters")
	}

	if strings.HasPrefix(trimmed, "data:") {
		parts := strings.SplitN(trimmed, ",", 2)
		if len(parts) != 2 {
			return "", fmt.Errorf("coverImage data URI is invalid")
		}

		if _, err := base64.StdEncoding.DecodeString(parts[1]); err != nil {
			return "", fmt.Errorf("coverImage must contain valid base64 image data")
		}

		estimatedBytes := len(parts[1]) * 3 / 4
		if estimatedBytes > maxCoverImageBytes {
			return "", fmt.Errorf("coverImage must be smaller than %dKB", maxCoverImageBytes/1024)
		}
	}

	return trimmed, nil
}
