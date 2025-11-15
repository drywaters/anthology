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

const baseSelect = "SELECT id, title, creator, item_type, release_year, page_count, isbn_13, isbn_10, description, notes, created_at, updated_at FROM items"

// Create inserts a new row and returns the stored representation.
func (r *PostgresRepository) Create(ctx context.Context, item Item) (Item, error) {
	insert := `INSERT INTO items (id, title, creator, item_type, release_year, page_count, isbn_13, isbn_10, description, notes, created_at, updated_at)
VALUES (:id, :title, :creator, :item_type, :release_year, :page_count, :isbn_13, :isbn_10, :description, :notes, :created_at, :updated_at)`

	if _, err := r.db.NamedExecContext(ctx, insert, item); err != nil {
		return Item{}, fmt.Errorf("insert item: %w", err)
	}

	return r.Get(ctx, item.ID)
}

// Get retrieves a row by primary key.
func (r *PostgresRepository) Get(ctx context.Context, id uuid.UUID) (Item, error) {
	var item Item
	if err := r.db.GetContext(ctx, &item, baseSelect+" WHERE id = $1", id); err != nil {
		if err == sql.ErrNoRows {
			return Item{}, ErrNotFound
		}
		return Item{}, fmt.Errorf("get item: %w", err)
	}
	return item, nil
}

// List returns items ordered by creation timestamp descending, filtered by the provided options.
func (r *PostgresRepository) List(ctx context.Context, opts ListOptions) ([]Item, error) {
	query := baseSelect
	clauses := []string{}
	args := []any{}

	if opts.ItemType != nil {
		clauses = append(clauses, fmt.Sprintf("item_type = $%d", len(args)+1))
		args = append(args, *opts.ItemType)
	}

	if opts.Initial != nil {
		initial := strings.ToUpper(strings.TrimSpace(*opts.Initial))
		if initial == "#" {
			clauses = append(clauses, "NOT (upper(substr(trim(title), 1, 1)) BETWEEN 'A' AND 'Z')")
		} else {
			clauses = append(clauses, fmt.Sprintf("upper(substr(trim(title), 1, 1)) = $%d", len(args)+1))
			args = append(args, initial)
		}
	}

	if len(clauses) > 0 {
		query = query + " WHERE " + strings.Join(clauses, " AND ")
	}

	query = query + " ORDER BY created_at DESC, title ASC"

	items := []Item{}
	if err := r.db.SelectContext(ctx, &items, query, args...); err != nil {
		return nil, fmt.Errorf("list items: %w", err)
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
    isbn_13 = :isbn_13,
    isbn_10 = :isbn_10,
    description = :description,
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
