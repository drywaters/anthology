package items

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
)

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

	now := time.Now().UTC()
	item := Item{
		ID:          uuid.New(),
		Title:       strings.TrimSpace(input.Title),
		Creator:     strings.TrimSpace(input.Creator),
		ItemType:    input.ItemType,
		ReleaseYear: normalizeYear(input.ReleaseYear),
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

	if input.Notes != nil {
		existing.Notes = strings.TrimSpace(*input.Notes)
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
