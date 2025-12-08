package items

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// PostgresRepository persists items to a Postgres database.
type PostgresRepository struct {
	db *sqlx.DB
}

// NewPostgresRepository constructs a repository backed by sqlx.
func NewPostgresRepository(db *sqlx.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

const baseSelect = `
SELECT
    i.id,
    i.title,
    i.creator,
    i.item_type,
    i.release_year,
    i.page_count,
    i.current_page,
    i.isbn_13,
    i.isbn_10,
    i.description,
    i.cover_image,
    i.platform,
    i.age_group,
    i.player_count,
    i.reading_status,
    i.read_at,
    i.notes,
    i.created_at,
    i.updated_at,
    placement.shelf_id AS placement_shelf_id,
    placement.shelf_slot_id AS placement_shelf_slot_id,
    placement.shelf_name AS placement_shelf_name,
    placement.row_index AS placement_row_index,
    placement.col_index AS placement_col_index
FROM items i
LEFT JOIN LATERAL (
    SELECT
        isl.shelf_id,
        isl.shelf_slot_id,
        ss.row_index,
        ss.col_index,
        s.name AS shelf_name
    FROM item_shelf_locations isl
    JOIN shelves s ON s.id = isl.shelf_id
    JOIN shelf_slots ss ON ss.id = isl.shelf_slot_id
    WHERE isl.item_id = i.id AND isl.shelf_slot_id IS NOT NULL
    ORDER BY isl.created_at DESC
    LIMIT 1
) AS placement ON true
`

type itemRow struct {
	Item
	PlacementShelfID     *uuid.UUID `db:"placement_shelf_id"`
	PlacementShelfSlotID *uuid.UUID `db:"placement_shelf_slot_id"`
	PlacementShelfName   *string    `db:"placement_shelf_name"`
	PlacementRowIndex    *int       `db:"placement_row_index"`
	PlacementColIndex    *int       `db:"placement_col_index"`
}

func (row itemRow) toItem() Item {
	item := row.Item
	if row.PlacementShelfID != nil &&
		row.PlacementShelfSlotID != nil &&
		row.PlacementShelfName != nil &&
		row.PlacementRowIndex != nil &&
		row.PlacementColIndex != nil {
		item.ShelfPlacement = &ShelfPlacement{
			ShelfID:   *row.PlacementShelfID,
			ShelfName: *row.PlacementShelfName,
			SlotID:    *row.PlacementShelfSlotID,
			RowIndex:  *row.PlacementRowIndex,
			ColIndex:  *row.PlacementColIndex,
		}
	}
	return item
}

// Create inserts a new row and returns the stored representation.
func (r *PostgresRepository) Create(ctx context.Context, item Item) (Item, error) {
	insert := `INSERT INTO items (id, title, creator, item_type, release_year, page_count, current_page, isbn_13, isbn_10, description, cover_image, platform, age_group, player_count, reading_status, read_at, notes, created_at, updated_at)
VALUES (:id, :title, :creator, :item_type, :release_year, :page_count, :current_page, :isbn_13, :isbn_10, :description, :cover_image, :platform, :age_group, :player_count, :reading_status, :read_at, :notes, :created_at, :updated_at)`

	if _, err := r.db.NamedExecContext(ctx, insert, item); err != nil {
		return Item{}, fmt.Errorf("insert item: %w", err)
	}

	return r.Get(ctx, item.ID)
}

// Get retrieves a row by primary key.
func (r *PostgresRepository) Get(ctx context.Context, id uuid.UUID) (Item, error) {
	var row itemRow
	if err := r.db.GetContext(ctx, &row, baseSelect+" WHERE i.id = $1", id); err != nil {
		if err == sql.ErrNoRows {
			return Item{}, ErrNotFound
		}
		return Item{}, fmt.Errorf("get item: %w", err)
	}
	return row.toItem(), nil
}

// List returns items ordered by creation timestamp descending, filtered by the provided options.
func (r *PostgresRepository) List(ctx context.Context, opts ListOptions) ([]Item, error) {
	query := baseSelect
	clauses := []string{}
	args := []any{}

	if opts.ItemType != nil {
		clauses = append(clauses, fmt.Sprintf("i.item_type = $%d", len(args)+1))
		args = append(args, *opts.ItemType)
	}

	// When filtering by status with no type filter (All), only apply to books (BE-2)
	if opts.ReadingStatus != nil {
		if opts.ItemType == nil {
			// All items with status filter:
			// - "none" status: show all items (books with none + all non-books)
			// - Other statuses: show only books with that status
			if *opts.ReadingStatus == BookStatusNone {
				clauses = append(clauses, fmt.Sprintf("(i.item_type != 'book' OR i.reading_status = $%d)", len(args)+1))
				args = append(args, BookStatusNone)
			} else {
				clauses = append(clauses, "i.item_type = 'book'")
				clauses = append(clauses, fmt.Sprintf("i.reading_status = $%d", len(args)+1))
				args = append(args, *opts.ReadingStatus)
			}
		} else {
			clauses = append(clauses, fmt.Sprintf("i.reading_status = $%d", len(args)+1))
			args = append(args, *opts.ReadingStatus)
		}
	}

	if opts.Initial != nil {
		initial := strings.ToUpper(strings.TrimSpace(*opts.Initial))
		if initial == "#" {
			clauses = append(clauses, "NOT (upper(substr(trim(i.title), 1, 1)) BETWEEN 'A' AND 'Z')")
		} else {
			clauses = append(clauses, fmt.Sprintf("upper(substr(trim(i.title), 1, 1)) = $%d", len(args)+1))
			args = append(args, initial)
		}
	}

	if opts.Query != nil {
		search := strings.TrimSpace(*opts.Query)
		if search != "" {
			clauses = append(clauses, fmt.Sprintf("i.title ILIKE $%d", len(args)+1))
			args = append(args, "%"+search+"%")
		}
	}

	if opts.ShelfStatus != nil {
		switch *opts.ShelfStatus {
		case ShelfStatusOn:
			clauses = append(clauses, "placement.shelf_id IS NOT NULL")
		case ShelfStatusOff:
			clauses = append(clauses, "placement.shelf_id IS NULL")
		}
	}

	if len(clauses) > 0 {
		query = query + " WHERE " + strings.Join(clauses, " AND ")
	}

	query = query + " ORDER BY i.created_at DESC, i.title ASC"

	if opts.Limit != nil && *opts.Limit > 0 {
		query = fmt.Sprintf("%s LIMIT %d", query, *opts.Limit)
	}

	rows := []itemRow{}
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, fmt.Errorf("list items: %w", err)
	}

	items := make([]Item, 0, len(rows))
	for _, row := range rows {
		items = append(items, row.toItem())
	}
	return items, nil
}

// Update modifies an existing row.
func (r *PostgresRepository) Update(ctx context.Context, item Item) (Item, error) {
	query := `UPDATE items
SET title = :title,
    creator = :creator,
    item_type = :item_type,
    release_year = :release_year,
    page_count = :page_count,
    current_page = :current_page,
    isbn_13 = :isbn_13,
    isbn_10 = :isbn_10,
    description = :description,
    cover_image = :cover_image,
    platform = :platform,
    age_group = :age_group,
    player_count = :player_count,
    reading_status = :reading_status,
    read_at = :read_at,
    notes = :notes,
    updated_at = :updated_at
WHERE id = :id`

	res, err := r.db.NamedExecContext(ctx, query, item)
	if err != nil {
		return Item{}, fmt.Errorf("update item: %w", err)
	}
	rows, err := res.RowsAffected()
	if err == nil && rows == 0 {
		return Item{}, ErrNotFound
	}

	return r.Get(ctx, item.ID)
}

// Delete removes an item.
func (r *PostgresRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, "DELETE FROM items WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("delete item: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("delete item rows: %w", err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// Histogram returns a count of items grouped by first letter of title.
func (r *PostgresRepository) Histogram(ctx context.Context, opts HistogramOptions) (LetterHistogram, error) {
	query := `
SELECT
    CASE
        WHEN upper(substr(trim(title), 1, 1)) BETWEEN 'A' AND 'Z'
        THEN upper(substr(trim(title), 1, 1))
        ELSE '#'
    END AS letter,
    COUNT(*) AS count
FROM items`

	clauses := []string{}
	args := []any{}

	if opts.ItemType != nil {
		clauses = append(clauses, fmt.Sprintf("item_type = $%d", len(args)+1))
		args = append(args, *opts.ItemType)
	}

	// When filtering by status with no type filter (All), only apply to books (BE-2)
	if opts.ReadingStatus != nil {
		if opts.ItemType == nil {
			if *opts.ReadingStatus == BookStatusNone {
				clauses = append(clauses, fmt.Sprintf("(item_type != 'book' OR reading_status = $%d)", len(args)+1))
				args = append(args, BookStatusNone)
			} else {
				clauses = append(clauses, "item_type = 'book'")
				clauses = append(clauses, fmt.Sprintf("reading_status = $%d", len(args)+1))
				args = append(args, *opts.ReadingStatus)
			}
		} else {
			clauses = append(clauses, fmt.Sprintf("reading_status = $%d", len(args)+1))
			args = append(args, *opts.ReadingStatus)
		}
	}

	if len(clauses) > 0 {
		query = query + " WHERE " + strings.Join(clauses, " AND ")
	}

	query = query + " GROUP BY letter"

	type letterCount struct {
		Letter string `db:"letter"`
		Count  int    `db:"count"`
	}

	rows := []letterCount{}
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, fmt.Errorf("histogram: %w", err)
	}

	histogram := make(LetterHistogram)
	for _, row := range rows {
		histogram[row.Letter] = row.Count
	}

	return histogram, nil
}

// FindDuplicates searches for items matching the given title or identifiers.
// Title matching is case-insensitive. Identifier matching normalizes by stripping non-digits.
// Returns up to 5 matches.
func (r *PostgresRepository) FindDuplicates(ctx context.Context, input DuplicateCheckInput) ([]DuplicateMatch, error) {
	normalizedTitle := NormalizeTitle(input.Title)
	normalizedISBN13 := NormalizeIdentifier(input.ISBN13)
	normalizedISBN10 := NormalizeIdentifier(input.ISBN10)

	// Build OR conditions for matching
	clauses := []string{}
	args := []any{}

	if normalizedTitle != "" {
		clauses = append(clauses, fmt.Sprintf("lower(trim(i.title)) = $%d", len(args)+1))
		args = append(args, normalizedTitle)
	}

	if normalizedISBN13 != "" {
		clauses = append(clauses, fmt.Sprintf("regexp_replace(i.isbn_13, '[^0-9]', '', 'g') = $%d", len(args)+1))
		args = append(args, normalizedISBN13)
	}

	if normalizedISBN10 != "" {
		clauses = append(clauses, fmt.Sprintf("regexp_replace(i.isbn_10, '[^0-9]', '', 'g') = $%d", len(args)+1))
		args = append(args, normalizedISBN10)
	}

	if len(clauses) == 0 {
		return []DuplicateMatch{}, nil
	}

	query := baseSelect + " WHERE (" + strings.Join(clauses, " OR ") + ") ORDER BY i.updated_at DESC LIMIT 5"

	rows := []itemRow{}
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, fmt.Errorf("find duplicates: %w", err)
	}

	matches := make([]DuplicateMatch, 0, len(rows))
	for _, row := range rows {
		item := row.toItem()
		matches = append(matches, itemToDuplicateMatch(item))
	}

	return matches, nil
}
