-- Add owner_id columns (nullable initially for migration)
ALTER TABLE items ADD COLUMN owner_id UUID REFERENCES users(id);
ALTER TABLE shelves ADD COLUMN owner_id UUID REFERENCES users(id);

-- Create indexes for query performance
CREATE INDEX idx_items_owner_id ON items (owner_id);
CREATE INDEX idx_shelves_owner_id ON shelves (owner_id);

-- Migrate existing data to danwater1@gmail.com
UPDATE items SET owner_id = (SELECT id FROM users WHERE email = 'danwater1@gmail.com') WHERE owner_id IS NULL;
UPDATE shelves SET owner_id = (SELECT id FROM users WHERE email = 'danwater1@gmail.com') WHERE owner_id IS NULL;

-- Make owner_id NOT NULL after migration
ALTER TABLE items ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE shelves ALTER COLUMN owner_id SET NOT NULL;

-- Update unique constraint on shelf name to be per-user
DROP INDEX IF EXISTS uq_shelves_name;
CREATE UNIQUE INDEX uq_shelves_name_owner ON shelves (owner_id, name);

