CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    creator TEXT NOT NULL DEFAULT '',
    item_type TEXT NOT NULL,
    release_year INTEGER,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at DESC);
