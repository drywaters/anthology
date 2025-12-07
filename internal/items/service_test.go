package items

import (
	"bytes"
	"context"
	"encoding/base64"
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
	if item.CurrentPage != nil {
		t.Fatalf("expected current page to be nil for new item")
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
	if item.ReadingStatus != BookStatusUnknown {
		t.Fatalf("expected default reading status to be empty, got %q", item.ReadingStatus)
	}
	if item.ReadAt != nil {
		t.Fatalf("expected readAt to be nil for non-read status")
	}
}

func TestServiceCreateValidatesCurrentPage(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)
	ctx := context.Background()
	pageCount := 200
	current := 250

	_, err := svc.Create(ctx, CreateItemInput{
		Title:         "Progress",
		ItemType:      ItemTypeBook,
		PageCount:     &pageCount,
		ReadingStatus: BookStatusReading,
		CurrentPage:   &current,
	})
	if err == nil {
		t.Fatalf("expected error when current page exceeds total")
	}

	current = -1
	_, err = svc.Create(ctx, CreateItemInput{
		Title:         "Negative",
		ItemType:      ItemTypeBook,
		ReadingStatus: BookStatusReading,
		CurrentPage:   &current,
	})
	if err == nil {
		t.Fatalf("expected error when current page negative")
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

	finishedDate := time.Date(2024, 1, 10, 0, 0, 0, 0, time.UTC)
	finished, _ := svc.Create(ctx, CreateItemInput{Title: "Finished Book", ItemType: ItemTypeBook, ReadingStatus: BookStatusRead, ReadAt: &finishedDate})
	_, _ = svc.Create(ctx, CreateItemInput{Title: "In Progress", ItemType: ItemTypeBook, ReadingStatus: BookStatusReading})

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

	status := BookStatusRead
	items, err = svc.List(ctx, ListOptions{ReadingStatus: &status})
	if err != nil {
		t.Fatalf("list with status filter failed: %v", err)
	}
	if len(items) != 1 || items[0].ID != finished.ID {
		t.Fatalf("expected only finished book, got %#v", items)
	}
}

func TestServiceListSupportsSearchAndLimit(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)

	ctx := context.Background()

	_, _ = svc.Create(ctx, CreateItemInput{Title: "The Pragmatic Programmer", ItemType: ItemTypeBook})
	_, _ = svc.Create(ctx, CreateItemInput{Title: "Children of Dune", ItemType: ItemTypeBook})
	time.Sleep(10 * time.Millisecond)
	latest, _ := svc.Create(ctx, CreateItemInput{Title: "Dune", ItemType: ItemTypeBook})

	query := "dune"
	limit := 1
	items, err := svc.List(ctx, ListOptions{Query: &query, Limit: &limit})
	if err != nil {
		t.Fatalf("list with search failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if items[0].ID != latest.ID {
		t.Fatalf("expected newest matching item, got %q", items[0].Title)
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

	bigPayload := makeDataURICoverBytes(maxCoverImageBytes + 1)
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

func TestServiceRejectsNonImageDataURI(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)

	// Attempt to use a non-image MIME type (e.g., text/html for XSS)
	htmlPayload := "data:text/html;base64," + base64.StdEncoding.EncodeToString([]byte("<script>alert(1)</script>"))
	_, err := svc.Create(context.Background(), CreateItemInput{Title: "XSS Attempt", ItemType: ItemTypeBook, CoverImage: htmlPayload})
	if err == nil {
		t.Fatalf("expected non-image data URI to be rejected")
	}
	if !strings.Contains(err.Error(), "valid image type") {
		t.Fatalf("expected error about image type, got: %v", err)
	}

	// Attempt with application/javascript
	jsPayload := "data:application/javascript;base64," + base64.StdEncoding.EncodeToString([]byte("alert(1)"))
	_, err = svc.Create(context.Background(), CreateItemInput{Title: "JS Attempt", ItemType: ItemTypeBook, CoverImage: jsPayload})
	if err == nil {
		t.Fatalf("expected non-image data URI to be rejected")
	}
}

func TestServiceValidatesBookStatusTransitions(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)

	pageCount := 400
	book, err := svc.Create(context.Background(), CreateItemInput{Title: "Status", ItemType: ItemTypeBook, PageCount: &pageCount})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	_, err = svc.Update(context.Background(), book.ID, UpdateItemInput{ReadingStatus: ptrBookStatus(BookStatusRead)})
	if err == nil {
		t.Fatalf("expected read status to require readAt")
	}

	readAt := time.Date(2023, 3, 5, 0, 0, 0, 0, time.UTC)
	updated, err := svc.Update(context.Background(), book.ID, UpdateItemInput{ReadingStatus: ptrBookStatus(BookStatusRead), ReadAt: ptrTimePtr(readAt)})
	if err != nil {
		t.Fatalf("expected valid status update, got %v", err)
	}
	if updated.ReadingStatus != BookStatusRead {
		t.Fatalf("expected status to update to read")
	}
	if updated.ReadAt == nil || !updated.ReadAt.Equal(readAt) {
		t.Fatalf("expected readAt to persist")
	}
	if updated.CurrentPage != nil {
		t.Fatalf("expected current page to clear for read status")
	}

	readingUpdate, err := svc.Update(context.Background(), book.ID, UpdateItemInput{
		ReadingStatus: ptrBookStatus(BookStatusReading),
		CurrentPage:   ptrIntPtr(120),
	})
	if err != nil {
		t.Fatalf("expected reading status update to succeed: %v", err)
	}
	if readingUpdate.CurrentPage == nil || *readingUpdate.CurrentPage != 120 {
		t.Fatalf("expected current page to persist")
	}

	_, err = svc.Update(context.Background(), book.ID, UpdateItemInput{CurrentPage: ptrIntPtr(999)})
	if err == nil {
		t.Fatalf("expected error when current page exceeds total")
	}

	cleared, err := svc.Update(context.Background(), book.ID, UpdateItemInput{ReadingStatus: ptrBookStatus(BookStatusUnknown)})
	if err != nil {
		t.Fatalf("expected clearing reading status to succeed: %v", err)
	}
	if cleared.ReadingStatus != BookStatusUnknown {
		t.Fatalf("expected reading status to clear, got %q", cleared.ReadingStatus)
	}
	if cleared.ReadAt != nil {
		t.Fatalf("expected readAt to clear when status removed")
	}
	if cleared.CurrentPage != nil {
		t.Fatalf("expected current page to clear when status removed")
	}

	_, err = svc.Update(context.Background(), book.ID, UpdateItemInput{ReadingStatus: ptrBookStatus(BookStatusReading), CurrentPage: ptrIntPtr(-5)})
	if err == nil {
		t.Fatalf("expected negative current page to fail")
	}
}

func ptrInt(value int) *int {
	v := value
	return &v
}

func ptrIntPtr(value int) **int {
	inner := ptrInt(value)
	return &inner
}

func ptrBookStatus(status BookStatus) *BookStatus {
	return &status
}

func ptrTime(t time.Time) *time.Time {
	return &t
}

func ptrTimePtr(t time.Time) **time.Time {
	value := ptrTime(t)
	return &value
}

func TestServiceAllowsDataURIsLongerThanURLLimitWhenUnderByteCap(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)

	payload := makeDataURICoverBytes(4000)
	if len(payload) <= maxCoverImageURLLength {
		t.Fatalf("expected payload length to exceed url limit")
	}

	item, err := svc.Create(context.Background(), CreateItemInput{
		Title:      "Large data URI",
		ItemType:   ItemTypeBook,
		CoverImage: payload,
	})
	if err != nil {
		t.Fatalf("expected data URI under byte cap to be accepted, got error: %v", err)
	}
	if item.CoverImage != payload {
		t.Fatalf("expected cover image to be stored, got %q", item.CoverImage)
	}

	updatePayload := makeDataURICoverBytes(4200)
	updated, err := svc.Update(context.Background(), item.ID, UpdateItemInput{CoverImage: &updatePayload})
	if err != nil {
		t.Fatalf("expected update to accept long data URI, got error: %v", err)
	}
	if updated.CoverImage != updatePayload {
		t.Fatalf("expected cover image to be updated, got %q", updated.CoverImage)
	}
}

func makeDataURICoverBytes(byteCount int) string {
	data := bytes.Repeat([]byte{0x42}, byteCount)
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(data)
}

func TestServiceFindDuplicatesByTitle(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)
	ctx := context.Background()

	existing, _ := svc.Create(ctx, CreateItemInput{Title: "The Great Gatsby", ItemType: ItemTypeBook, ISBN13: "9780743273565"})

	tests := []struct {
		name        string
		searchTitle string
		wantMatch   bool
	}{
		{"exact match", "The Great Gatsby", true},
		{"case insensitive", "the great gatsby", true},
		{"case insensitive uppercase", "THE GREAT GATSBY", true},
		{"mixed case", "ThE GrEaT GaTsBY", true},
		{"with leading whitespace", "  The Great Gatsby", true},
		{"with trailing whitespace", "The Great Gatsby  ", true},
		{"with both whitespace", "  The Great Gatsby  ", true},
		{"partial match", "Great Gatsby", false},
		{"different title", "The Old Man and the Sea", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matches, err := svc.FindDuplicates(ctx, DuplicateCheckInput{Title: tt.searchTitle})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.wantMatch {
				if len(matches) != 1 {
					t.Fatalf("expected 1 match, got %d", len(matches))
				}
				if matches[0].ID != existing.ID {
					t.Fatalf("expected matching ID")
				}
			} else {
				if len(matches) != 0 {
					t.Fatalf("expected no matches, got %d", len(matches))
				}
			}
		})
	}
}

func TestServiceFindDuplicatesByISBN(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)
	ctx := context.Background()

	existing, _ := svc.Create(ctx, CreateItemInput{
		Title:    "Clean Code",
		ItemType: ItemTypeBook,
		ISBN13:   "978-0132350884",
		ISBN10:   "0132350882",
	})

	tests := []struct {
		name      string
		isbn13    string
		isbn10    string
		wantMatch bool
	}{
		{"exact isbn13", "978-0132350884", "", true},
		{"isbn13 without hyphens", "9780132350884", "", true},
		{"isbn13 with spaces", "978 0132350884", "", true},
		{"exact isbn10", "", "0132350882", true},
		{"isbn10 with hyphen", "", "0-132350882", true},
		{"different isbn13", "9780321125217", "", false},
		{"different isbn10", "", "0321125215", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matches, err := svc.FindDuplicates(ctx, DuplicateCheckInput{ISBN13: tt.isbn13, ISBN10: tt.isbn10})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.wantMatch {
				if len(matches) != 1 {
					t.Fatalf("expected 1 match, got %d", len(matches))
				}
				if matches[0].ID != existing.ID {
					t.Fatalf("expected matching ID")
				}
			} else {
				if len(matches) != 0 {
					t.Fatalf("expected no matches, got %d", len(matches))
				}
			}
		})
	}
}

func TestServiceFindDuplicatesReturnsMaxFiveMatches(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)
	ctx := context.Background()

	// Create 7 items with the same title
	for i := 0; i < 7; i++ {
		_, _ = svc.Create(ctx, CreateItemInput{Title: "Duplicate Title", ItemType: ItemTypeBook})
	}

	matches, err := svc.FindDuplicates(ctx, DuplicateCheckInput{Title: "Duplicate Title"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(matches) != 5 {
		t.Fatalf("expected max 5 matches, got %d", len(matches))
	}
}

func TestServiceFindDuplicatesReturnsCorrectFields(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)
	ctx := context.Background()

	existing, _ := svc.Create(ctx, CreateItemInput{
		Title:      "Test Book",
		ItemType:   ItemTypeBook,
		ISBN13:     "9780123456789",
		CoverImage: "https://example.com/cover.jpg",
	})

	matches, err := svc.FindDuplicates(ctx, DuplicateCheckInput{Title: "Test Book"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(matches) != 1 {
		t.Fatalf("expected 1 match, got %d", len(matches))
	}

	match := matches[0]
	if match.ID != existing.ID {
		t.Fatalf("expected ID to match")
	}
	if match.Title != "Test Book" {
		t.Fatalf("expected title to match")
	}
	if match.PrimaryIdentifier != "9780123456789" {
		t.Fatalf("expected primary identifier to be ISBN-13")
	}
	if match.IdentifierType != "ISBN-13" {
		t.Fatalf("expected identifier type to be ISBN-13")
	}
	if match.CoverURL != "https://example.com/cover.jpg" {
		t.Fatalf("expected cover URL to match")
	}
}

func TestServiceFindDuplicatesEmptyInput(t *testing.T) {
	repo := NewInMemoryRepository(nil)
	svc := NewService(repo)
	ctx := context.Background()

	_, _ = svc.Create(ctx, CreateItemInput{Title: "Some Book", ItemType: ItemTypeBook})

	matches, err := svc.FindDuplicates(ctx, DuplicateCheckInput{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(matches) != 0 {
		t.Fatalf("expected no matches for empty input, got %d", len(matches))
	}
}

func TestNormalizeTitle(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"The Great Gatsby", "the great gatsby"},
		{"  The Great Gatsby  ", "the great gatsby"},
		{"THE GREAT GATSBY", "the great gatsby"},
		{"", ""},
		{"   ", ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := NormalizeTitle(tt.input)
			if got != tt.want {
				t.Fatalf("NormalizeTitle(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestNormalizeIdentifier(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"9780132350884", "9780132350884"},
		{"978-0132350884", "9780132350884"},
		{"978 0132350884", "9780132350884"},
		{"978-0-13235-088-4", "9780132350884"},
		{"", ""},
		{"   ", ""},
		{"abc", ""},
		{"0-13235-0882", "0132350882"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := NormalizeIdentifier(tt.input)
			if got != tt.want {
				t.Fatalf("NormalizeIdentifier(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
