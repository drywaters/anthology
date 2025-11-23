package shelves

import (
	"context"
	"fmt"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"anthology/internal/items"
)

// Service coordinates layout validation and persistence.
type Service struct {
	repo      Repository
	itemsRepo items.Repository
}

// NewService wires a shelf service.
func NewService(repo Repository, itemsRepo items.Repository) *Service {
	return &Service{repo: repo, itemsRepo: itemsRepo}
}

// CreateShelfInput captures the fields required to create a shelf.
type CreateShelfInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	PhotoURL    string `json:"photoUrl"`
}

// UpdateLayoutInput wraps the new rows for a shelf layout.
type UpdateLayoutInput struct {
	Rows []LayoutRowInput `json:"rows"`
}

// CreateShelf creates a shelf with an initial single-slot layout.
func (s *Service) CreateShelf(ctx context.Context, input CreateShelfInput) (ShelfWithLayout, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return ShelfWithLayout{}, fmt.Errorf("name is required")
	}
	photoURL := strings.TrimSpace(input.PhotoURL)
	if photoURL == "" {
		return ShelfWithLayout{}, fmt.Errorf("photoUrl is required")
	}

	now := time.Now().UTC()
	shelf := Shelf{
		ID:          uuid.New(),
		Name:        name,
		Description: strings.TrimSpace(input.Description),
		PhotoURL:    photoURL,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	rowID := uuid.New()
	colID := uuid.New()
	slotID := uuid.New()

	row := ShelfRow{ID: rowID, ShelfID: shelf.ID, RowIndex: 0, YStartNorm: 0, YEndNorm: 1}
	column := ShelfColumn{ID: colID, ShelfRowID: rowID, ColIndex: 0, XStartNorm: 0, XEndNorm: 1}
	slot := ShelfSlot{
		ID:            slotID,
		ShelfID:       shelf.ID,
		ShelfRowID:    rowID,
		ShelfColumnID: colID,
		RowIndex:      0,
		ColIndex:      0,
		XStartNorm:    0,
		XEndNorm:      1,
		YStartNorm:    0,
		YEndNorm:      1,
	}

	created, err := s.repo.CreateShelf(ctx, shelf, []ShelfRow{row}, []ShelfColumn{column}, []ShelfSlot{slot})
	if err != nil {
		return ShelfWithLayout{}, err
	}

	return created, nil
}

// ListShelves returns shelf summaries.
func (s *Service) ListShelves(ctx context.Context) ([]ShelfSummary, error) {
	return s.repo.ListShelves(ctx)
}

// GetShelf returns a shelf with layout and placements hydrated with item details.
func (s *Service) GetShelf(ctx context.Context, shelfID uuid.UUID) (ShelfWithLayout, error) {
	layout, err := s.repo.GetShelf(ctx, shelfID)
	if err != nil {
		return ShelfWithLayout{}, err
	}

	return s.attachItems(ctx, layout)
}

// UpdateLayout replaces the layout while keeping stable slot IDs when possible.
func (s *Service) UpdateLayout(ctx context.Context, shelfID uuid.UUID, input UpdateLayoutInput) (ShelfWithLayout, []PlacementWithItem, error) {
	if len(input.Rows) == 0 {
		return ShelfWithLayout{}, nil, fmt.Errorf("at least one row is required")
	}

	existing, err := s.repo.GetShelf(ctx, shelfID)
	if err != nil {
		return ShelfWithLayout{}, nil, err
	}

	normalizedRows, normalizedColumns, err := normalizeRows(input.Rows, shelfID)
	if err != nil {
		return ShelfWithLayout{}, nil, err
	}

	slotMap := map[string]ShelfSlot{}
	for _, slot := range existing.Slots {
		key := fmt.Sprintf("%d-%d", slot.RowIndex, slot.ColIndex)
		slotMap[key] = slot
	}

	var slots []ShelfSlot
	for _, row := range normalizedRows {
		cols := normalizedColumns[row.ID]
		sort.Slice(cols, func(i, j int) bool { return cols[i].ColIndex < cols[j].ColIndex })
		for _, col := range cols {
			key := fmt.Sprintf("%d-%d", row.RowIndex, col.ColIndex)
			slotID := uuid.New()
			if existingSlot, ok := slotMap[key]; ok {
				slotID = existingSlot.ID
			}
			slots = append(slots, ShelfSlot{
				ID:            slotID,
				ShelfID:       shelfID,
				ShelfRowID:    row.ID,
				ShelfColumnID: col.ID,
				RowIndex:      row.RowIndex,
				ColIndex:      col.ColIndex,
				XStartNorm:    col.XStartNorm,
				XEndNorm:      col.XEndNorm,
				YStartNorm:    row.YStartNorm,
				YEndNorm:      row.YEndNorm,
			})
		}
	}

	removedSlotIDs := removedSlots(existing.Slots, slots)
	displacedItemIDs := make(map[uuid.UUID]struct{})
	if len(removedSlotIDs) > 0 {
		removedSet := make(map[uuid.UUID]struct{}, len(removedSlotIDs))
		for _, id := range removedSlotIDs {
			removedSet[id] = struct{}{}
		}
		for _, placement := range existing.Placements {
			if placement.Placement.ShelfSlotID == nil {
				continue
			}
			if _, removed := removedSet[*placement.Placement.ShelfSlotID]; removed {
				displacedItemIDs[placement.Placement.ItemID] = struct{}{}
			}
		}
	}
	if err := s.repo.SaveLayout(ctx, shelfID, slices.Clone(normalizedRows), flattenColumns(normalizedColumns), slots, removedSlotIDs); err != nil {
		return ShelfWithLayout{}, nil, err
	}

	updated, err := s.repo.GetShelf(ctx, shelfID)
	if err != nil {
		return ShelfWithLayout{}, nil, err
	}

	hydrated, err := s.attachItems(ctx, updated)
	if err != nil {
		return ShelfWithLayout{}, nil, err
	}

	var displaced []PlacementWithItem
	if len(displacedItemIDs) > 0 {
		for _, placement := range hydrated.Unplaced {
			if _, removed := displacedItemIDs[placement.Placement.ItemID]; removed {
				displaced = append(displaced, placement)
			}
		}
	}

	return hydrated, displaced, nil
}

// AssignItem assigns an item to a slot, clearing any previous placement on the shelf.
func (s *Service) AssignItem(ctx context.Context, shelfID, slotID, itemID uuid.UUID) (ShelfWithLayout, error) {
	if _, err := s.itemsRepo.Get(ctx, itemID); err != nil {
		return ShelfWithLayout{}, err
	}

	if _, err := s.repo.AssignItemToSlot(ctx, shelfID, slotID, itemID); err != nil {
		return ShelfWithLayout{}, err
	}

	updated, err := s.repo.GetShelf(ctx, shelfID)
	if err != nil {
		return ShelfWithLayout{}, err
	}

	return s.attachItems(ctx, updated)
}

// RemoveItem removes an item from a slot, leaving it unplaced on the shelf.
func (s *Service) RemoveItem(ctx context.Context, shelfID, slotID, itemID uuid.UUID) (ShelfWithLayout, error) {
	if err := s.repo.RemoveItemFromSlot(ctx, shelfID, slotID, itemID); err != nil {
		return ShelfWithLayout{}, err
	}

	updated, err := s.repo.GetShelf(ctx, shelfID)
	if err != nil {
		return ShelfWithLayout{}, err
	}

	return s.attachItems(ctx, updated)
}

func removedSlots(previous, next []ShelfSlot) []uuid.UUID {
	nextSet := make(map[uuid.UUID]struct{}, len(next))
	for _, slot := range next {
		nextSet[slot.ID] = struct{}{}
	}

	var removed []uuid.UUID
	for _, slot := range previous {
		if _, exists := nextSet[slot.ID]; !exists {
			removed = append(removed, slot.ID)
		}
	}
	return removed
}

func normalizeRows(rows []LayoutRowInput, shelfID uuid.UUID) ([]ShelfRow, map[uuid.UUID][]ShelfColumn, error) {
	normalized := make([]ShelfRow, len(rows))
	columns := make(map[uuid.UUID][]ShelfColumn)

	sort.Slice(rows, func(i, j int) bool { return rows[i].RowIndex < rows[j].RowIndex })

	var lastEnd float64
	for i, row := range rows {
		if row.YStartNorm < 0 || row.YEndNorm > 1 || row.YEndNorm <= row.YStartNorm {
			return nil, nil, fmt.Errorf("row %d has invalid boundaries", row.RowIndex)
		}
		if i > 0 && row.YStartNorm < lastEnd {
			return nil, nil, fmt.Errorf("rows overlap; check row %d", row.RowIndex)
		}
		lastEnd = row.YEndNorm

		rowID := uuid.New()
		if row.RowID != nil {
			rowID = *row.RowID
		}

		normalized[i] = ShelfRow{
			ID:         rowID,
			ShelfID:    shelfID,
			RowIndex:   row.RowIndex,
			YStartNorm: row.YStartNorm,
			YEndNorm:   row.YEndNorm,
		}

		cols, err := normalizeColumns(row.Columns, rowID)
		if err != nil {
			return nil, nil, err
		}
		columns[rowID] = cols
	}

	return normalized, columns, nil
}

func normalizeColumns(cols []LayoutColumnInput, rowID uuid.UUID) ([]ShelfColumn, error) {
	if len(cols) == 0 {
		return nil, fmt.Errorf("each row requires at least one column")
	}

	sort.Slice(cols, func(i, j int) bool { return cols[i].ColIndex < cols[j].ColIndex })

	var lastEnd float64
	normalized := make([]ShelfColumn, len(cols))
	for i, col := range cols {
		if col.XStartNorm < 0 || col.XEndNorm > 1 || col.XEndNorm <= col.XStartNorm {
			return nil, fmt.Errorf("column %d has invalid boundaries", col.ColIndex)
		}
		if i > 0 && col.XStartNorm < lastEnd {
			return nil, fmt.Errorf("columns overlap near index %d", col.ColIndex)
		}
		lastEnd = col.XEndNorm

		colID := uuid.New()
		if col.ColumnID != nil {
			colID = *col.ColumnID
		}

		normalized[i] = ShelfColumn{
			ID:         colID,
			ShelfRowID: rowID,
			ColIndex:   col.ColIndex,
			XStartNorm: col.XStartNorm,
			XEndNorm:   col.XEndNorm,
		}
	}

	return normalized, nil
}

func flattenColumns(columns map[uuid.UUID][]ShelfColumn) []ShelfColumn {
	var result []ShelfColumn
	for _, cols := range columns {
		result = append(result, cols...)
	}
	return result
}

func (s *Service) attachItems(ctx context.Context, layout ShelfWithLayout) (ShelfWithLayout, error) {
	itemsList, err := s.itemsRepo.List(ctx, items.ListOptions{})
	if err != nil {
		return ShelfWithLayout{}, err
	}
	itemMap := make(map[uuid.UUID]items.Item, len(itemsList))
	for _, item := range itemsList {
		itemMap[item.ID] = item
	}

	var placements []PlacementWithItem
	var unplaced []PlacementWithItem
	for _, placement := range layout.Placements {
		item, ok := itemMap[placement.Placement.ItemID]
		if !ok {
			continue
		}
		enriched := PlacementWithItem{Item: item, Placement: placement.Placement}
		if placement.Placement.ShelfSlotID == nil {
			unplaced = append(unplaced, enriched)
		} else {
			placements = append(placements, enriched)
		}
	}

	layout.Placements = placements
	layout.Unplaced = unplaced
	return layout, nil
}
