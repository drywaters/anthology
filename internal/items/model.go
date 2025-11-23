package items

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

// ErrNotFound is returned when an item cannot be located.
var ErrNotFound = errors.New("item not found")

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
	BookStatusUnknown    BookStatus = ""
	BookStatusRead       BookStatus = "read"
	BookStatusReading    BookStatus = "reading"
	BookStatusWantToRead BookStatus = "want_to_read"
)

// Item represents a catalog entry in Anthology.
type Item struct {
	ID            uuid.UUID  `db:"id" json:"id"`
	Title         string     `db:"title" json:"title"`
	Creator       string     `db:"creator" json:"creator"`
	ItemType      ItemType   `db:"item_type" json:"itemType"`
	ReleaseYear   *int       `db:"release_year" json:"releaseYear,omitempty"`
	PageCount     *int       `db:"page_count" json:"pageCount,omitempty"`
	ISBN13        string     `db:"isbn_13" json:"isbn13"`
	ISBN10        string     `db:"isbn_10" json:"isbn10"`
	Description   string     `db:"description" json:"description"`
	CoverImage    string     `db:"cover_image" json:"coverImage"`
	ReadingStatus BookStatus `db:"reading_status" json:"readingStatus"`
	ReadAt        *time.Time `db:"read_at" json:"readAt,omitempty"`
	Notes         string     `db:"notes" json:"notes"`
	CreatedAt     time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateItemInput captures the data needed to create a new Item.
type CreateItemInput struct {
	Title         string
	Creator       string
	ItemType      ItemType
	ReleaseYear   *int
	PageCount     *int
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
}

// Repository defines persistence operations for Items.
type Repository interface {
	Create(ctx context.Context, item Item) (Item, error)
	Get(ctx context.Context, id uuid.UUID) (Item, error)
	List(ctx context.Context, opts ListOptions) ([]Item, error)
	Update(ctx context.Context, item Item) (Item, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
