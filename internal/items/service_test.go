package items

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestServiceCreateValidatesInput(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)

	_, err := svc.Create(context.Background(), CreateItemInput{})
	if err == nil {
		t.Fatalf("expected validation error when title missing")
	}
}

func TestServiceCreatePersistsItem(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)
	year := 2023
	pages := 352

	item, err := svc.Create(context.Background(), CreateItemInput{
		Title:       "The Pragmatic Programmer",
		Creator:     "Andrew Hunt",
		ItemType:    ItemTypeBook,
		ReleaseYear: &year,
		PageCount:   &pages,
		ISBN13:      "9780135957059",
		ISBN10:      "0135957052",
		Description: "Practical advice for software craftspeople.",
		CoverImage:  "data:image/png;base64,aGVsbG8=",
		Notes:       "Initial dataset mirrors a curated media catalogue.",
	})
	if err != nil {
		t.Fatalf("expected item to be created: %v", err)
	}

	if item.ID == uuid.Nil {
		t.Fatalf("expected id to be set")
	}
	if item.CreatedAt.IsZero() || item.UpdatedAt.IsZero() {
		t.Fatalf("expected timestamps to be set")
	}
	if item.ReleaseYear == nil || *item.ReleaseYear != year {
		t.Fatalf("expected release year to persist")
	}
	if item.PageCount == nil || *item.PageCount != pages {
		t.Fatalf("expected page count to persist")
	}
	if item.ISBN13 != "9780135957059" {
		t.Fatalf("expected isbn13 to persist")
	}
	if item.ISBN10 != "0135957052" {
		t.Fatalf("expected isbn10 to persist")
	}
	if item.Description != "Practical advice for software craftspeople." {
		t.Fatalf("expected description to persist")
	}
	if item.CoverImage == "" {
		t.Fatalf("expected cover image to persist")
	}
}

func TestServiceUpdate(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)

	created, err := svc.Create(context.Background(), CreateItemInput{Title: "Initial", ItemType: ItemTypeGame})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	title := "Updated"
	notes := "Now includes expansion content"
	itemType := ItemTypeGame
	newDescription := "Updated overview"
	isbn13 := "9781984801265"
	isbn10 := "1984801263"
	pageCountValue := 640
	pageCountPtr := &pageCountValue

	updated, err := svc.Update(context.Background(), created.ID, UpdateItemInput{
		Title:       &title,
		Notes:       &notes,
		ItemType:    &itemType,
		Description: &newDescription,
		ISBN13:      &isbn13,
		ISBN10:      &isbn10,
		PageCount:   &pageCountPtr,
	})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}

	if updated.Title != title {
		t.Fatalf("expected title %q, got %q", title, updated.Title)
	}
	if updated.Notes != notes {
		t.Fatalf("expected notes to be updated")
	}
	if updated.Description != newDescription {
		t.Fatalf("expected description update")
	}
	if updated.ISBN13 != isbn13 || updated.ISBN10 != isbn10 {
		t.Fatalf("expected isbn values to update")
	}
	if updated.PageCount == nil || *updated.PageCount != pageCountValue {
		t.Fatalf("expected page count update")
	}
	if !updated.UpdatedAt.After(created.UpdatedAt) {
		t.Fatalf("expected updated timestamp to increase")
	}
}

func TestServiceListOrdersByCreatedAt(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)

	ctx := context.Background()

	_, _ = svc.Create(ctx, CreateItemInput{Title: "First", ItemType: ItemTypeBook})
	time.Sleep(10 * time.Millisecond)
	second, _ := svc.Create(ctx, CreateItemInput{Title: "Second", ItemType: ItemTypeBook})

	items, err := svc.List(ctx, ListOptions{})
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}

	if len(items) != 2 {
		t.Fatalf("expected two items")
	}
	if items[0].ID != second.ID {
		t.Fatalf("expected newest item first")
	}
}

func TestServiceListAppliesFilters(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)

	ctx := context.Background()

	_, _ = svc.Create(ctx, CreateItemInput{Title: "Alpha", ItemType: ItemTypeBook})
	_, _ = svc.Create(ctx, CreateItemInput{Title: "Zulu", ItemType: ItemTypeGame})
	_, _ = svc.Create(ctx, CreateItemInput{Title: "99 Luftballons", ItemType: ItemTypeMusic})

	letter := "A"
	items, err := svc.List(ctx, ListOptions{Initial: &letter})
	if err != nil {
		t.Fatalf("list with initial failed: %v", err)
	}
	if len(items) != 1 || items[0].Title != "Alpha" {
		t.Fatalf("expected only alpha result, got %#v", items)
	}

	itemType := ItemTypeMusic
	hash := "#"
	items, err = svc.List(ctx, ListOptions{ItemType: &itemType, Initial: &hash})
	if err != nil {
		t.Fatalf("list with combined filters failed: %v", err)
	}
	if len(items) != 1 || items[0].Title != "99 Luftballons" {
		t.Fatalf("expected non-alphabetic music result")
	}
}

func TestServiceCreateTrimsInputAndNormalizesYear(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)

	negativeYear := -1990
	negativePages := -10
	isbn13 := " 9780441172719 "
	isbn10 := " 0441172717"
	description := "  Classic sci-fi  "
	item, err := svc.Create(context.Background(), CreateItemInput{
		Title:       "  Dune  ",
		Creator:     "  Frank Herbert ",
		ItemType:    ItemTypeBook,
		ReleaseYear: &negativeYear,
		PageCount:   &negativePages,
		ISBN13:      isbn13,
		ISBN10:      isbn10,
		Description: description,
		Notes:       "  Classic sci-fi  ",
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	if item.Title != "Dune" {
		t.Fatalf("expected trimmed title, got %q", item.Title)
	}
	if item.Creator != "Frank Herbert" {
		t.Fatalf("expected trimmed creator, got %q", item.Creator)
	}
	if item.ReleaseYear != nil {
		t.Fatalf("expected negative year to be normalized to nil, got %v", item.ReleaseYear)
	}
	if item.Notes != "Classic sci-fi" {
		t.Fatalf("expected trimmed notes, got %q", item.Notes)
	}
	if item.PageCount != nil {
		t.Fatalf("expected invalid page count to normalize to nil")
	}
	if item.ISBN13 != "9780441172719" {
		t.Fatalf("expected isbn13 to be trimmed")
	}
	if item.ISBN10 != "0441172717" {
		t.Fatalf("expected isbn10 to be trimmed")
	}
	if item.Description != "Classic sci-fi" {
		t.Fatalf("expected description to be trimmed, got %q", item.Description)
	}
}

func TestServiceUpdateRejectsBlankTitleOrItemType(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)

	item, err := svc.Create(context.Background(), CreateItemInput{Title: "Initial", ItemType: ItemTypeBook})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	ctx := context.Background()

	blank := "   "
	_, err = svc.Update(ctx, item.ID, UpdateItemInput{Title: &blank})
	if err == nil || !strings.Contains(err.Error(), "title is required") {
		t.Fatalf("expected title validation error, got %v", err)
	}

	emptyType := ItemType("")
	_, err = svc.Update(ctx, item.ID, UpdateItemInput{ItemType: &emptyType})
	if err == nil || !strings.Contains(err.Error(), "itemType is required") {
		t.Fatalf("expected itemType validation error, got %v", err)
	}
}

func TestServiceRejectsOversizedCoverImage(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)

	bigPayload := "data:image/jpeg;base64," + strings.Repeat("a", maxCoverImageBytes)
	_, err := svc.Create(context.Background(), CreateItemInput{Title: "Big Cover", ItemType: ItemTypeBook, CoverImage: bigPayload})
	if err == nil {
		t.Fatalf("expected oversized cover image to be rejected")
	}

	updatePayload := bigPayload
	item, _ := svc.Create(context.Background(), CreateItemInput{Title: "Small cover", ItemType: ItemTypeBook, CoverImage: "data:image/png;base64,aA=="})
	_, err = svc.Update(context.Background(), item.ID, UpdateItemInput{CoverImage: &updatePayload})
	if err == nil {
		t.Fatalf("expected oversized cover image to be rejected on update")
	}
}
