ALTER TABLE items
    ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS genre TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS rating INTEGER,
    ADD COLUMN IF NOT EXISTS retail_price_usd DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS google_volume_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_items_google_volume_id ON items (google_volume_id) WHERE google_volume_id != '';
