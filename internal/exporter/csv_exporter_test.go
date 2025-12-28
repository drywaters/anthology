package exporter

import (
	"bytes"
	"encoding/csv"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"anthology/internal/items"
)

func TestCSVExporter_ExportEmpty(t *testing.T) {
	exporter := NewCSVExporter()
	var buf bytes.Buffer

	err := exporter.Export(&buf, []items.Item{})
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}

	reader := csv.NewReader(&buf)
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("failed to parse CSV: %v", err)
	}

	// Should have only header row
	if len(records) != 1 {
		t.Fatalf("expected 1 row (header), got %d", len(records))
	}

	// Verify header has all expected columns
	if len(records[0]) != len(csvColumns) {
		t.Fatalf("expected %d columns, got %d", len(csvColumns), len(records[0]))
	}
}

func TestCSVExporter_ExportBook(t *testing.T) {
	exporter := NewCSVExporter()
	var buf bytes.Buffer

	releaseYear := 2020
	pageCount := 320
	rating := 5
	price := 24.99
	readAt := time.Date(2023, 6, 15, 0, 0, 0, 0, time.UTC)
	createdAt := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 6, 15, 0, 0, 0, 0, time.UTC)

	testItems := []items.Item{
		{
			ID:             uuid.New(),
			Title:          "Test Book",
			Creator:        "Test Author",
			ItemType:       items.ItemTypeBook,
			ReleaseYear:    &releaseYear,
			PageCount:      &pageCount,
			ISBN13:         "9780000000001",
			ISBN10:         "0000000001",
			Description:    "A test book description",
			CoverImage:     "https://example.com/cover.jpg",
			Format:         items.FormatHardcover,
			Genre:          items.GenreFiction,
			Rating:         &rating,
			RetailPriceUsd: &price,
			GoogleVolumeId: "vol123",
			ReadingStatus:  items.BookStatusRead,
			ReadAt:         &readAt,
			Notes:          "Great book!",
			CreatedAt:      createdAt,
			UpdatedAt:      updatedAt,
		},
	}

	err := exporter.Export(&buf, testItems)
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}

	reader := csv.NewReader(&buf)
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("failed to parse CSV: %v", err)
	}

	if len(records) != 2 {
		t.Fatalf("expected 2 rows (header + 1 item), got %d", len(records))
	}

	row := records[1]
	if row[0] != SchemaVersion {
		t.Errorf("expected schema version %s, got %s", SchemaVersion, row[0])
	}
	if row[1] != "Test Book" {
		t.Errorf("expected title 'Test Book', got %s", row[1])
	}
	if row[2] != "Test Author" {
		t.Errorf("expected creator 'Test Author', got %s", row[2])
	}
	if row[3] != "book" {
		t.Errorf("expected itemType 'book', got %s", row[3])
	}
	if row[4] != "2020" {
		t.Errorf("expected releaseYear '2020', got %s", row[4])
	}
	if row[7] != "9780000000001" {
		t.Errorf("expected isbn13 '9780000000001', got %s", row[7])
	}
}

func TestCSVExporter_ExportGame(t *testing.T) {
	exporter := NewCSVExporter()
	var buf bytes.Buffer

	releaseYear := 2019
	createdAt := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)

	testItems := []items.Item{
		{
			ID:          uuid.New(),
			Title:       "Test Game",
			Creator:     "Game Studio",
			ItemType:    items.ItemTypeGame,
			ReleaseYear: &releaseYear,
			Platform:    "Nintendo Switch",
			AgeGroup:    "Everyone",
			PlayerCount: "1-4",
			Notes:       "Fun game",
			CreatedAt:   createdAt,
			UpdatedAt:   updatedAt,
		},
	}

	err := exporter.Export(&buf, testItems)
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}

	reader := csv.NewReader(&buf)
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("failed to parse CSV: %v", err)
	}

	if len(records) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(records))
	}

	row := records[1]
	if row[3] != "game" {
		t.Errorf("expected itemType 'game', got %s", row[3])
	}
	if row[16] != "Nintendo Switch" {
		t.Errorf("expected platform 'Nintendo Switch', got %s", row[16])
	}
}

func TestCSVExporter_ExportWithShelfPlacement(t *testing.T) {
	exporter := NewCSVExporter()
	var buf bytes.Buffer

	shelfID := uuid.New()
	slotID := uuid.New()
	createdAt := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)

	testItems := []items.Item{
		{
			ID:        uuid.New(),
			Title:     "Shelved Book",
			Creator:   "Author",
			ItemType:  items.ItemTypeBook,
			CreatedAt: createdAt,
			UpdatedAt: updatedAt,
			ShelfPlacement: &items.ShelfPlacement{
				ShelfID:   shelfID,
				ShelfName: "Living Room",
				SlotID:    slotID,
				RowIndex:  1,
				ColIndex:  2,
			},
		},
	}

	err := exporter.Export(&buf, testItems)
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}

	reader := csv.NewReader(&buf)
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("failed to parse CSV: %v", err)
	}

	row := records[1]
	if row[22] != "Living Room" {
		t.Errorf("expected shelfName 'Living Room', got %s", row[22])
	}
	if row[23] != "1" {
		t.Errorf("expected shelfRowIndex '1', got %s", row[23])
	}
	if row[24] != "2" {
		t.Errorf("expected shelfColIndex '2', got %s", row[24])
	}
}

func TestCSVExporter_ExportMultipleItems(t *testing.T) {
	exporter := NewCSVExporter()
	var buf bytes.Buffer

	createdAt := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)

	testItems := []items.Item{
		{ID: uuid.New(), Title: "Book 1", Creator: "Author 1", ItemType: items.ItemTypeBook, CreatedAt: createdAt, UpdatedAt: updatedAt},
		{ID: uuid.New(), Title: "Game 1", Creator: "Studio 1", ItemType: items.ItemTypeGame, CreatedAt: createdAt, UpdatedAt: updatedAt},
		{ID: uuid.New(), Title: "Movie 1", Creator: "Director 1", ItemType: items.ItemTypeMovie, CreatedAt: createdAt, UpdatedAt: updatedAt},
		{ID: uuid.New(), Title: "Music 1", Creator: "Artist 1", ItemType: items.ItemTypeMusic, CreatedAt: createdAt, UpdatedAt: updatedAt},
	}

	err := exporter.Export(&buf, testItems)
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}

	reader := csv.NewReader(&buf)
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("failed to parse CSV: %v", err)
	}

	if len(records) != 5 {
		t.Fatalf("expected 5 rows (header + 4 items), got %d", len(records))
	}
}

func TestCSVExporter_HeaderMatchesColumnOrder(t *testing.T) {
	exporter := NewCSVExporter()
	var buf bytes.Buffer

	err := exporter.Export(&buf, []items.Item{})
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}

	reader := csv.NewReader(&buf)
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("failed to parse CSV: %v", err)
	}

	header := records[0]
	for i, col := range csvColumns {
		if header[i] != col {
			t.Errorf("header column %d: expected %s, got %s", i, col, header[i])
		}
	}
}

func TestCSVExporter_SpecialCharactersInFields(t *testing.T) {
	exporter := NewCSVExporter()
	var buf bytes.Buffer

	createdAt := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)

	testItems := []items.Item{
		{
			ID:          uuid.New(),
			Title:       "Book with, comma",
			Creator:     "Author \"Quoted\"",
			ItemType:    items.ItemTypeBook,
			Description: "Line 1\nLine 2",
			Notes:       "Note with \"quotes\" and, commas",
			CreatedAt:   createdAt,
			UpdatedAt:   updatedAt,
		},
	}

	err := exporter.Export(&buf, testItems)
	if err != nil {
		t.Fatalf("export failed: %v", err)
	}

	reader := csv.NewReader(&buf)
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("failed to parse CSV: %v", err)
	}

	row := records[1]
	if row[1] != "Book with, comma" {
		t.Errorf("title not properly escaped: got %s", row[1])
	}
	if row[2] != "Author \"Quoted\"" {
		t.Errorf("creator not properly escaped: got %s", row[2])
	}
	if !strings.Contains(row[9], "\n") {
		t.Errorf("description newline not preserved: got %s", row[9])
	}
}
