CREATE TABLE IF NOT EXISTS shelves (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    photo_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shelf_rows (
    id UUID PRIMARY KEY,
    shelf_id UUID NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    y_start_norm DOUBLE PRECISION NOT NULL,
    y_end_norm DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS shelf_columns (
    id UUID PRIMARY KEY,
    shelf_row_id UUID NOT NULL REFERENCES shelf_rows(id) ON DELETE CASCADE,
    col_index INTEGER NOT NULL,
    x_start_norm DOUBLE PRECISION NOT NULL,
    x_end_norm DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS shelf_slots (
    id UUID PRIMARY KEY,
    shelf_id UUID NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
    shelf_row_id UUID NOT NULL REFERENCES shelf_rows(id) ON DELETE CASCADE,
    shelf_column_id UUID NOT NULL REFERENCES shelf_columns(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    col_index INTEGER NOT NULL,
    x_start_norm DOUBLE PRECISION NOT NULL,
    x_end_norm DOUBLE PRECISION NOT NULL,
    y_start_norm DOUBLE PRECISION NOT NULL,
    y_end_norm DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS item_shelf_locations (
    id UUID PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    shelf_id UUID NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
    shelf_slot_id UUID REFERENCES shelf_slots(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shelf_rows_shelf_id ON shelf_rows (shelf_id);
CREATE INDEX IF NOT EXISTS idx_shelf_columns_row_id ON shelf_columns (shelf_row_id);
CREATE INDEX IF NOT EXISTS idx_shelf_slots_shelf_id ON shelf_slots (shelf_id);
CREATE INDEX IF NOT EXISTS idx_item_shelf_locations_shelf_id ON item_shelf_locations (shelf_id);
CREATE INDEX IF NOT EXISTS idx_item_shelf_locations_item_id ON item_shelf_locations (item_id);
