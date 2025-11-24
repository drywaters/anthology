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

// UpdateLayoutInput wraps the new slots for a shelf layout.
type UpdateLayoutInput struct {
	Slots []LayoutSlotInput `json:"slots"`
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
	if len(input.Slots) == 0 {
		return ShelfWithLayout{}, nil, fmt.Errorf("at least one slot is required")
	}

	existing, err := s.repo.GetShelf(ctx, shelfID)
	if err != nil {
		return ShelfWithLayout{}, nil, err
	}

	slotKey := func(rowIdx, colIdx int) string {
		return fmt.Sprintf("%d-%d", rowIdx, colIdx)
	}

	rowIDs := make(map[int]uuid.UUID)
	columnIDs := make(map[string]uuid.UUID)
	slotIDs := make(map[string]uuid.UUID)
	for _, row := range existing.Rows {
		rowIDs[row.RowIndex] = row.ID
		for _, col := range row.Columns {
			columnIDs[slotKey(row.RowIndex, col.ColIndex)] = col.ID
		}
	}
	for _, slot := range existing.Slots {
		slotIDs[slotKey(slot.RowIndex, slot.ColIndex)] = slot.ID
	}

	normalizedRows, normalizedColumns, normalizedSlots, err := normalizeSlots(input.Slots, shelfID, rowIDs, columnIDs, slotIDs)
	if err != nil {
		return ShelfWithLayout{}, nil, err
	}

	removedSlotIDs := removedSlots(existing.Slots, normalizedSlots)
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
	if err := s.repo.SaveLayout(ctx, shelfID, slices.Clone(normalizedRows), slices.Clone(normalizedColumns), normalizedSlots, removedSlotIDs); err != nil {
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

func normalizeSlots(
	slots []LayoutSlotInput,
	shelfID uuid.UUID,
	existingRowIDs map[int]uuid.UUID,
	existingColumnIDs map[string]uuid.UUID,
	existingSlotIDs map[string]uuid.UUID,
) ([]ShelfRow, []ShelfColumn, []ShelfSlot, error) {
	if len(slots) == 0 {
		return nil, nil, nil, fmt.Errorf("at least one slot is required")
	}

	key := func(rowIdx, colIdx int) string {
		return fmt.Sprintf("%d-%d", rowIdx, colIdx)
	}

	rowGroups := make(map[int][]LayoutSlotInput)
	seenKeys := make(map[string]struct{})

	for _, slot := range slots {
		if slot.RowIndex < 0 || slot.ColIndex < 0 {
			return nil, nil, nil, fmt.Errorf("row and column indexes must be non-negative")
		}
		if slot.XStartNorm < 0 || slot.XEndNorm > 1 || slot.XEndNorm <= slot.XStartNorm {
			return nil, nil, nil, fmt.Errorf("slot %d/%d has invalid x boundaries", slot.RowIndex, slot.ColIndex)
		}
		if slot.YStartNorm < 0 || slot.YEndNorm > 1 || slot.YEndNorm <= slot.YStartNorm {
			return nil, nil, nil, fmt.Errorf("slot %d/%d has invalid y boundaries", slot.RowIndex, slot.ColIndex)
		}
		slotKey := key(slot.RowIndex, slot.ColIndex)
		if _, exists := seenKeys[slotKey]; exists {
			return nil, nil, nil, fmt.Errorf("duplicate definition for row %d column %d", slot.RowIndex, slot.ColIndex)
		}
		seenKeys[slotKey] = struct{}{}
		rowGroups[slot.RowIndex] = append(rowGroups[slot.RowIndex], slot)
	}

	rowIndexes := make([]int, 0, len(rowGroups))
	for idx := range rowGroups {
		rowIndexes = append(rowIndexes, idx)
	}
	sort.Ints(rowIndexes)

	rows := make([]ShelfRow, 0, len(rowIndexes))
	columns := make([]ShelfColumn, 0, len(slots))
	normalizedSlots := make([]ShelfSlot, 0, len(slots))

	for _, rowIdx := range rowIndexes {
		rowSlots := rowGroups[rowIdx]
		sort.Slice(rowSlots, func(i, j int) bool { return rowSlots[i].ColIndex < rowSlots[j].ColIndex })

		rowYStart := rowSlots[0].YStartNorm
		rowYEnd := rowSlots[0].YEndNorm
		for _, slot := range rowSlots[1:] {
			if slot.YStartNorm < rowYStart {
				rowYStart = slot.YStartNorm
			}
			if slot.YEndNorm > rowYEnd {
				rowYEnd = slot.YEndNorm
			}
		}

		rowID, ok := existingRowIDs[rowIdx]
		if !ok {
			rowID = uuid.New()
		}
		rows = append(rows, ShelfRow{
			ID:         rowID,
			ShelfID:    shelfID,
			RowIndex:   rowIdx,
			YStartNorm: rowYStart,
			YEndNorm:   rowYEnd,
		})

		for _, slot := range rowSlots {
			colKey := key(rowIdx, slot.ColIndex)
			colID, ok := existingColumnIDs[colKey]
			if !ok {
				colID = uuid.New()
			}

			columns = append(columns, ShelfColumn{
				ID:         colID,
				ShelfRowID: rowID,
				ColIndex:   slot.ColIndex,
				XStartNorm: slot.XStartNorm,
				XEndNorm:   slot.XEndNorm,
			})

			slotID := uuid.New()
			if slot.SlotID != nil {
				slotID = *slot.SlotID
			} else if existingID, ok := existingSlotIDs[colKey]; ok {
				slotID = existingID
			}

			normalizedSlots = append(normalizedSlots, ShelfSlot{
				ID:            slotID,
				ShelfID:       shelfID,
				ShelfRowID:    rowID,
				ShelfColumnID: colID,
				RowIndex:      rowIdx,
				ColIndex:      slot.ColIndex,
				XStartNorm:    slot.XStartNorm,
				XEndNorm:      slot.XEndNorm,
				YStartNorm:    slot.YStartNorm,
				YEndNorm:      slot.YEndNorm,
			})
		}
	}

	return rows, columns, normalizedSlots, nil
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
