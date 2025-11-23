ALTER TABLE items
    ADD COLUMN IF NOT EXISTS reading_status TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_items_reading_status ON items (reading_status);

UPDATE items
SET reading_status = 'want_to_read'
WHERE item_type = 'book'
  AND (reading_status = '' OR reading_status IS NULL);
