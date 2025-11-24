package items

import (
	"context"
	"slices"
	"strings"
	"sync"

	"github.com/google/uuid"
)

// InMemoryRepository stores items in an in-process map, ideal for local development or tests.
type InMemoryRepository struct {
	mu    sync.RWMutex
	data  map[uuid.UUID]Item
	order []uuid.UUID
}

// NewInMemoryRepository constructs a repository seeded with optional initial items.
func NewInMemoryRepository(initial []Item) *InMemoryRepository {
	data := make(map[uuid.UUID]Item)
	order := make([]uuid.UUID, 0, len(initial))
	for _, item := range initial {
		data[item.ID] = item
		order = append(order, item.ID)
	}
	return &InMemoryRepository{data: data, order: order}
}

// Create stores a new item.
func (r *InMemoryRepository) Create(_ context.Context, item Item) (Item, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.data[item.ID] = item
	r.order = append(r.order, item.ID)
	return item, nil
}

// Get returns an item by ID.
func (r *InMemoryRepository) Get(_ context.Context, id uuid.UUID) (Item, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	item, ok := r.data[id]
	if !ok {
		return Item{}, ErrNotFound
	}
	return item, nil
}

// List returns stored items matching the supplied options.
func (r *InMemoryRepository) List(_ context.Context, opts ListOptions) ([]Item, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	items := make([]Item, 0, len(r.order))
	queryFilter := ""
	if opts.Query != nil {
		queryFilter = strings.ToLower(strings.TrimSpace(*opts.Query))
	}

	for _, id := range r.order {
		if item, ok := r.data[id]; ok {
			if opts.ItemType != nil && item.ItemType != *opts.ItemType {
				continue
			}

			if opts.ReadingStatus != nil && item.ReadingStatus != *opts.ReadingStatus {
				continue
			}

			if opts.Initial != nil {
				initial := strings.ToUpper(strings.TrimSpace(*opts.Initial))
				titleInitial := ""
				trimmed := strings.TrimSpace(item.Title)
				if len(trimmed) > 0 {
					titleInitial = strings.ToUpper(string(trimmed[0]))
				}

				if initial == "#" {
					if titleInitial >= "A" && titleInitial <= "Z" {
						continue
					}
				} else {
					if titleInitial != initial {
						continue
					}
				}
			}

			if queryFilter != "" {
				title := strings.ToLower(strings.TrimSpace(item.Title))
				if !strings.Contains(title, queryFilter) {
					continue
				}
			}

			items = append(items, item)
		}
	}

	if opts.Limit != nil && *opts.Limit > 0 && len(items) > *opts.Limit {
		sorted := append([]Item(nil), items...)
		slices.SortFunc(sorted, compareItemsByCreatedDesc)
		items = sorted[:*opts.Limit]
	}

	return items, nil
}

// Update replaces an existing item.
func (r *InMemoryRepository) Update(_ context.Context, item Item) (Item, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.data[item.ID]; !ok {
		return Item{}, ErrNotFound
	}
	r.data[item.ID] = item
	return item, nil
}

// Delete removes an item by ID.
func (r *InMemoryRepository) Delete(_ context.Context, id uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.data[id]; !ok {
		return ErrNotFound
	}
	delete(r.data, id)
	for i, existing := range r.order {
		if existing == id {
			r.order = append(r.order[:i], r.order[i+1:]...)
			break
		}
	}
	return nil
}
