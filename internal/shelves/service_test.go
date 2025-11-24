package shelves

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"anthology/internal/items"
)

func TestUpdateLayoutReturnsOnlyDisplacedItems(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	repo := NewInMemoryRepository()
	now := time.Now().UTC()

	shelfID := uuid.New()
	rowID := uuid.New()
	colLeftID := uuid.New()
	colRightID := uuid.New()
	slotLeftID := uuid.New()
	slotRightID := uuid.New()

	shelf := Shelf{
		ID:        shelfID,
		Name:      "Shelf",
		PhotoURL:  "https://example.com/shelf.jpg",
		CreatedAt: now,
		UpdatedAt: now,
	}
	row := ShelfRow{
		ID:         rowID,
		ShelfID:    shelfID,
		RowIndex:   0,
		YStartNorm: 0,
		YEndNorm:   1,
	}
	columns := []ShelfColumn{
		{ID: colLeftID, ShelfRowID: rowID, ColIndex: 0, XStartNorm: 0, XEndNorm: 0.5},
		{ID: colRightID, ShelfRowID: rowID, ColIndex: 1, XStartNorm: 0.5, XEndNorm: 1},
	}
	slots := []ShelfSlot{
		{
			ID:            slotLeftID,
			ShelfID:       shelfID,
			ShelfRowID:    rowID,
			ShelfColumnID: colLeftID,
			RowIndex:      0,
			ColIndex:      0,
			XStartNorm:    0,
			XEndNorm:      0.5,
			YStartNorm:    0,
			YEndNorm:      1,
		},
		{
			ID:            slotRightID,
			ShelfID:       shelfID,
			ShelfRowID:    rowID,
			ShelfColumnID: colRightID,
			RowIndex:      0,
			ColIndex:      1,
			XStartNorm:    0.5,
			XEndNorm:      1,
			YStartNorm:    0,
			YEndNorm:      1,
		},
	}

	if _, err := repo.CreateShelf(ctx, shelf, []ShelfRow{row}, columns, slots); err != nil {
		t.Fatalf("create shelf: %v", err)
	}

	displacedItem := items.Item{
		ID:        uuid.New(),
		Title:     "Placed Book",
		ItemType:  items.ItemTypeBook,
		CreatedAt: now,
		UpdatedAt: now,
	}
	preexistingUnplaced := items.Item{
		ID:        uuid.New(),
		Title:     "Already Unplaced",
		ItemType:  items.ItemTypeBook,
		CreatedAt: now,
		UpdatedAt: now,
	}

	itemsRepo := items.NewInMemoryRepository([]items.Item{displacedItem, preexistingUnplaced})
	svc := NewService(repo, itemsRepo)

	if _, err := repo.AssignItemToSlot(ctx, shelfID, slotRightID, displacedItem.ID); err != nil {
		t.Fatalf("assign displaced item: %v", err)
	}
	if _, err := repo.UpsertUnplaced(ctx, shelfID, preexistingUnplaced.ID); err != nil {
		t.Fatalf("seed unplaced item: %v", err)
	}

	input := UpdateLayoutInput{
		Slots: []LayoutSlotInput{
			{
				SlotID:     &slotLeftID,
				RowIndex:   0,
				ColIndex:   0,
				XStartNorm: 0,
				XEndNorm:   0.5,
				YStartNorm: 0,
				YEndNorm:   1,
			},
		},
	}

	updated, displaced, err := svc.UpdateLayout(ctx, shelfID, input)
	if err != nil {
		t.Fatalf("update layout: %v", err)
	}

	if len(displaced) != 1 {
		t.Fatalf("expected 1 displaced item, got %d", len(displaced))
	}
	if displaced[0].Item.ID != displacedItem.ID {
		t.Fatalf("expected displaced item %s, got %s", displacedItem.ID, displaced[0].Item.ID)
	}

	if len(updated.Unplaced) != 2 {
		t.Fatalf("expected two unplaced items, got %d", len(updated.Unplaced))
	}
	var foundDisplaced, foundExisting bool
	for _, placement := range updated.Unplaced {
		switch placement.Item.ID {
		case displacedItem.ID:
			foundDisplaced = true
		case preexistingUnplaced.ID:
			foundExisting = true
		}
	}
	if !foundDisplaced || !foundExisting {
		t.Fatalf("expected displaced and existing unplaced items to remain in unplaced pool")
	}
}
