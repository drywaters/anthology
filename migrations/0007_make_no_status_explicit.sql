ALTER TABLE items
    ALTER COLUMN reading_status SET DEFAULT 'none';

UPDATE items
SET reading_status = 'none'
WHERE reading_status IS NULL OR reading_status = '';
