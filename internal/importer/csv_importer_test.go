package importer

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/google/uuid"

	"anthology/internal/catalog"
	"anthology/internal/items"
)

type stubStore struct {
	items     []items.Item
	createErr error
	listed    bool
}

func (s *stubStore) Create(ctx context.Context, input items.CreateItemInput) (items.Item, error) {
	if s.createErr != nil {
		return items.Item{}, s.createErr
	}
	item := items.Item{ID: uuid.New(), Title: input.Title, Creator: input.Creator, ItemType: input.ItemType}
	s.items = append(s.items, item)
	return item, nil
}

func (s *stubStore) List(ctx context.Context, opts items.ListOptions) ([]items.Item, error) {
	s.listed = true
	copies := make([]items.Item, len(s.items))
	copy(copies, s.items)
	return copies, nil
}

type stubCatalog struct {
	metadata []catalog.Metadata
	err      error
}

func (s *stubCatalog) Lookup(ctx context.Context, query string, category catalog.Category) ([]catalog.Metadata, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.metadata, nil
}

func TestCSVImporter_ImportCreatesItemsAndSkipsDuplicates(t *testing.T) {
	store := &stubStore{items: []items.Item{{Title: "Existing Title"}}}
	importer := NewCSVImporter(store, &stubCatalog{})
	csv := "title,creator,itemType,releaseYear,pageCount,isbn13,isbn10,description,coverImage,notes\n" +
		"New Book,Author,book,2020,320,9780000000001,0000000001,Desc,,Note\n" +
		"Existing Title,Someone,book,,,,,,,,\n"
	summary, err := importer.Import(context.Background(), bytes.NewBufferString(csv))
	if err != nil {
		t.Fatalf("import failed: %v", err)
	}
	if summary.Imported != 1 {
		t.Fatalf("expected 1 import, got %d", summary.Imported)
	}
	if len(summary.SkippedDuplicates) != 1 {
		t.Fatalf("expected 1 skipped record, got %d", len(summary.SkippedDuplicates))
	}
}

func TestCSVImporter_PopulatesBookFromLookup(t *testing.T) {
	store := &stubStore{}
	catalog := &stubCatalog{metadata: []catalog.Metadata{{
		Title:    "Lookup Title",
		Creator:  "Lookup Author",
		ItemType: items.ItemTypeBook,
		ISBN13:   "9780000000000",
	}}}
	importer := NewCSVImporter(store, catalog)
	csv := "title,creator,itemType,releaseYear,pageCount,isbn13,isbn10,description,coverImage,notes\n" +
		",,book,, ,9780000000000,,,,,\n"
	summary, err := importer.Import(context.Background(), bytes.NewBufferString(csv))
	if err != nil {
		t.Fatalf("import failed: %v", err)
	}
	if summary.Imported != 1 {
		t.Fatalf("expected 1 import, got %d", summary.Imported)
	}
}

func TestCSVImporter_ReturnsRowErrors(t *testing.T) {
	store := &stubStore{}
	importer := NewCSVImporter(store, &stubCatalog{})
	csv := "title,creator,itemType,releaseYear,pageCount,isbn13,isbn10,description,coverImage,notes\n" +
		"Bad Year,Author,book,year,100,,,,,\n"
	summary, err := importer.Import(context.Background(), bytes.NewBufferString(csv))
	if err != nil {
		t.Fatalf("import failed: %v", err)
	}
	if len(summary.Failed) != 1 {
		t.Fatalf("expected 1 failed record, got %d", len(summary.Failed))
	}
}

func TestCSVImporter_MissingColumns(t *testing.T) {
	store := &stubStore{}
	importer := NewCSVImporter(store, &stubCatalog{})
	csv := "title,itemType\nTest,book\n"
	_, err := importer.Import(context.Background(), strings.NewReader(csv))
	if err == nil {
		t.Fatal("expected error for missing columns")
	}
	if !strings.Contains(err.Error(), "missing required columns") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCSVImporter_RejectsOversizedUploadBeforeWriting(t *testing.T) {
	store := &stubStore{}
	importer := NewCSVImporter(store, &stubCatalog{})

	var builder strings.Builder
	builder.WriteString("title,creator,itemType,releaseYear,pageCount,isbn13,isbn10,description,coverImage,notes\n")
	for idx := 0; idx < MaxImportRows+1; idx++ {
		fmt.Fprintf(&builder, "Title %d,Creator %d,book,2024,100,,,,,\n", idx, idx)
	}

	_, err := importer.Import(context.Background(), strings.NewReader(builder.String()))
	if err == nil {
		t.Fatal("expected error for oversized CSV")
	}
	if len(store.items) != 0 {
		t.Fatalf("expected no items to be created, got %d", len(store.items))
	}
}
