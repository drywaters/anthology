package migrate

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"log/slog"

	"github.com/jmoiron/sqlx"

	"anthology/migrations"
)

const schemaMigrationsTable = "schema_migrations"

// Apply runs any pending SQL migrations bundled with the binary.
func Apply(ctx context.Context, db *sqlx.DB, logger *slog.Logger) error {
	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("migrate: begin tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(ctx, fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);`, schemaMigrationsTable)); err != nil {
		return fmt.Errorf("migrate: create schema table: %w", err)
	}

	if _, err := tx.ExecContext(ctx, fmt.Sprintf(`LOCK TABLE %s IN EXCLUSIVE MODE`, schemaMigrationsTable)); err != nil {
		return fmt.Errorf("migrate: lock schema table: %w", err)
	}

	applied, err := fetchApplied(ctx, tx)
	if err != nil {
		return err
	}

	files, err := readMigrationFiles()
	if err != nil {
		return err
	}

	for _, name := range files {
		if applied[name] {
			continue
		}

		src, err := migrations.Files.ReadFile(name)
		if err != nil {
			return fmt.Errorf("migrate: read %s: %w", name, err)
		}

		if _, err := tx.ExecContext(ctx, string(src)); err != nil {
			return fmt.Errorf("migrate: exec %s: %w", name, err)
		}

		if _, err := tx.ExecContext(ctx,
			fmt.Sprintf("INSERT INTO %s (name) VALUES ($1)", schemaMigrationsTable),
			name,
		); err != nil {
			return fmt.Errorf("migrate: record %s: %w", name, err)
		}

		if logger != nil {
			logger.Info("migration applied", "name", name)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("migrate: commit: %w", err)
	}

	return nil
}

func fetchApplied(ctx context.Context, q sqlx.QueryerContext) (map[string]bool, error) {
        rows, err := q.QueryxContext(ctx, fmt.Sprintf(`SELECT name FROM %s`, schemaMigrationsTable))
        if err != nil {
                // table creation should guarantee existence, so propagate errors here
                return nil, fmt.Errorf("migrate: fetch applied: %w", err)
        }
        defer func() {
                _ = rows.Close()
        }()

	applied := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("migrate: scan applied: %w", err)
		}
		applied[name] = true
	}
	return applied, rows.Err()
}

func readMigrationFiles() ([]string, error) {
	entries, err := fs.ReadDir(migrations.Files, ".")
	if err != nil {
		return nil, fmt.Errorf("migrate: read dir: %w", err)
	}

	var files []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if strings.HasSuffix(name, ".sql") {
			files = append(files, name)
		}
	}

	sort.Strings(files)
	return files, nil
}
