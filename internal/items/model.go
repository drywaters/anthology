package items

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

// ErrNotFound is returned when an item cannot be located.
var ErrNotFound = errors.New("item not found")

// ErrValidation is returned when input validation fails.
var ErrValidation = errors.New("validation error")

// ValidationError wraps a validation message so callers can distinguish
// client errors from internal failures.
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

func (e *ValidationError) Unwrap() error {
	return ErrValidation
}

// ItemType enumerates the primary categories supported by the MVP.
type ItemType string

const (
	ItemTypeBook  ItemType = "book"
	ItemTypeGame  ItemType = "game"
	ItemTypeMovie ItemType = "movie"
	ItemTypeMusic ItemType = "music"
)

// BookStatus tracks a reader's engagement with a book.
type BookStatus string

const (
	// BookStatusNone represents an explicit "No status" selection.
	BookStatusNone       BookStatus = "none"
	BookStatusRead       BookStatus = "read"
	BookStatusReading    BookStatus = "reading"
	BookStatusWantToRead BookStatus = "want_to_read"
)

// Item represents a catalog entry in Anthology.
type Item struct {
	ID             uuid.UUID       `db:"id" json:"id"`
	Title          string          `db:"title" json:"title"`
	Creator        string          `db:"creator" json:"creator"`
	ItemType       ItemType        `db:"item_type" json:"itemType"`
	ReleaseYear    *int            `db:"release_year" json:"releaseYear,omitempty"`
	PageCount      *int            `db:"page_count" json:"pageCount,omitempty"`
	CurrentPage    *int            `db:"current_page" json:"currentPage,omitempty"`
	ISBN13         string          `db:"isbn_13" json:"isbn13"`
	ISBN10         string          `db:"isbn_10" json:"isbn10"`
	Description    string          `db:"description" json:"description"`
	CoverImage     string          `db:"cover_image" json:"coverImage"`
	ReadingStatus  BookStatus      `db:"reading_status" json:"readingStatus"`
	ReadAt         *time.Time      `db:"read_at" json:"readAt,omitempty"`
	Notes          string          `db:"notes" json:"notes"`
	CreatedAt      time.Time       `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time       `db:"updated_at" json:"updatedAt"`
	ShelfPlacement *ShelfPlacement `db:"-" json:"shelfPlacement,omitempty"`
}

// ShelfPlacement summarizes where an item lives on a shelf layout.
type ShelfPlacement struct {
	ShelfID   uuid.UUID `json:"shelfId"`
	ShelfName string    `json:"shelfName"`
	SlotID    uuid.UUID `json:"slotId"`
	RowIndex  int       `json:"rowIndex"`
	ColIndex  int       `json:"colIndex"`
}

// CreateItemInput captures the data needed to create a new Item.
type CreateItemInput struct {
	Title         string
	Creator       string
	ItemType      ItemType
	ReleaseYear   *int
	PageCount     *int
	CurrentPage   *int
	ISBN13        string
	ISBN10        string
	Description   string
	CoverImage    string
	ReadingStatus BookStatus
	ReadAt        *time.Time
	Notes         string
}

// UpdateItemInput captures the editable fields for an existing item.
type UpdateItemInput struct {
	Title         *string
	Creator       *string
	ItemType      *ItemType
	ReleaseYear   **int
	PageCount     **int
	CurrentPage   **int
	ISBN13        *string
	ISBN10        *string
	Description   *string
	CoverImage    *string
	ReadingStatus *BookStatus
	ReadAt        **time.Time
	Notes         *string
}

// ListOptions describes filters for listing items.
type ListOptions struct {
	ItemType      *ItemType
	ReadingStatus *BookStatus
	Initial       *string
	Query         *string
	Limit         *int
}

// HistogramOptions describes filters for histogram aggregation.
type HistogramOptions struct {
	ItemType      *ItemType
	ReadingStatus *BookStatus
}

// LetterHistogram maps first letters (A-Z, #) to item counts.
type LetterHistogram map[string]int

// DuplicateCheckInput captures the identifiers to check for duplicates.
type DuplicateCheckInput struct {
	Title  string
	ISBN13 string
	ISBN10 string
}

// DuplicateMatch represents a potential duplicate item found in the catalog.
type DuplicateMatch struct {
	ID                uuid.UUID `json:"id"`
	Title             string    `json:"title"`
	PrimaryIdentifier string    `json:"primaryIdentifier"`
	IdentifierType    string    `json:"identifierType"`
	CoverURL          string    `json:"coverUrl,omitempty"`
	Location          string    `json:"location,omitempty"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// Repository defines persistence operations for Items.
type Repository interface {
	Create(ctx context.Context, item Item) (Item, error)
	Get(ctx context.Context, id uuid.UUID) (Item, error)
	List(ctx context.Context, opts ListOptions) ([]Item, error)
	Update(ctx context.Context, item Item) (Item, error)
	Delete(ctx context.Context, id uuid.UUID) error
	Histogram(ctx context.Context, opts HistogramOptions) (LetterHistogram, error)
	FindDuplicates(ctx context.Context, input DuplicateCheckInput) ([]DuplicateMatch, error)
}
