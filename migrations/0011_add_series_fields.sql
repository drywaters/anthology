-- Add series tracking fields for books
ALTER TABLE items
    ADD COLUMN IF NOT EXISTS series_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS volume_number INTEGER,
    ADD COLUMN IF NOT EXISTS total_volumes INTEGER;

-- Index for efficient series grouping queries
CREATE INDEX IF NOT EXISTS idx_items_series_name ON items (series_name) WHERE series_name != '';

-- Composite index for series + volume ordering
CREATE INDEX IF NOT EXISTS idx_items_series_volume ON items (series_name, volume_number) WHERE series_name != '';

