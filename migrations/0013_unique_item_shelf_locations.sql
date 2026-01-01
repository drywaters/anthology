CREATE UNIQUE INDEX IF NOT EXISTS idx_item_shelf_locations_shelf_item
    ON item_shelf_locations (shelf_id, item_id);
