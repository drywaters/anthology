# Multi-Tenancy Implementation Plan

## Overview

Implement user-scoped data isolation so each user only sees their own items and shelves. Design uses `owner_id` column for future extensibility to shared libraries.

## Key Decisions

- **Column name**: `owner_id` (better semantics for future sharing)
- **Error handling**: Return 404 for unauthorized access (prevents enumeration attacks)
- **Data migration**: Hardcode assignment to `danwater1@gmail.com` for existing data
- **Filtering layer**: Repository level (single enforcement point, SQL performance)

---

## Implementation Steps

### Step 1: Database Migration

**Create**: `/migrations/0012_add_owner_id.sql`

```sql
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
```

### Step 2: Update Item Models

**Modify**: `/internal/items/model.go`

- Add `OwnerID uuid.UUID` field to `Item` struct
- Add `OwnerID uuid.UUID` to `CreateItemInput` struct
- Add `OwnerID uuid.UUID` to `ListOptions` struct (required filter)
- Add `OwnerID uuid.UUID` to `HistogramOptions` struct
- Update `Repository` interface:
  - `Get(ctx, id, ownerID)` - add ownerID param
  - `Delete(ctx, id, ownerID)` - add ownerID param
  - `FindDuplicates(ctx, input, ownerID)` - add ownerID param
  - `ListSeries(ctx, opts, ownerID)` - add ownerID param
  - `GetSeriesByName(ctx, name, ownerID)` - add ownerID param

### Step 3: Update Shelf Models

**Modify**: `/internal/shelves/model.go`

- Add `OwnerID uuid.UUID` field to `Shelf` struct
- Update `Repository` interface - add ownerID param to all methods

### Step 4: Update Item Repository

**Modify**: `/internal/items/postgres_repository.go`

- Add `owner_id` to `baseSelect` query
- Update `Create()`: include `owner_id` in INSERT
- Update `Get()`: add `WHERE owner_id = $2` filter
- Update `List()`: always filter by `owner_id` (first WHERE clause)
- Update `Delete()`: add `WHERE owner_id = $2` filter
- Update `Histogram()`: filter by owner_id
- Update `FindDuplicates()`: filter by owner_id
- Update `ListSeries()`: filter by owner_id
- Update `GetSeriesByName()`: filter by owner_id

**Modify**: `/internal/items/memory_repository.go`

- Update in-memory implementation for tests

### Step 5: Update Shelf Repository

**Modify**: `/internal/shelves/postgres_repository.go`

- Add `owner_id` to shelf SELECT/INSERT queries
- Update all methods to filter by owner_id:
  - `CreateShelf()`, `ListShelves()`, `GetShelf()`
  - `SaveLayout()`, `AssignItemToSlot()`, `RemoveItemFromSlot()`
  - `ListPlacements()`, `UpsertUnplaced()`

**Modify**: `/internal/shelves/memory_repository.go`

- Update in-memory implementation for tests

### Step 6: Update Item Service

**Modify**: `/internal/items/service.go`

- `Create()`: validate OwnerID is set, pass to repo
- `Get()`: add ownerID parameter, pass to repo
- `List()`: validate OwnerID in opts, pass to repo
- `Update()`: add ownerID parameter, fetch with owner check
- `Delete()`: add ownerID parameter, pass to repo
- `Histogram()`: ownerID already in opts
- `FindDuplicates()`: add ownerID parameter
- `ListSeries()`: add ownerID parameter
- `GetSeriesByName()`: add ownerID parameter

### Step 7: Update Shelf Service

**Modify**: `/internal/shelves/service.go`

- Add ownerID parameter to all public methods
- Pass ownerID to repository calls
- Update `attachItems()` to filter items by owner

### Step 8: Update HTTP Handlers

**Modify**: `/internal/http/handlers.go`

For each handler method:
1. Extract user: `user := UserFromContext(r.Context())`
2. Check nil: return 401 if user is nil (already protected by middleware, but defensive)
3. Pass `user.ID` to service methods

Methods to update:
- `List()`, `Create()`, `Get()`, `Update()`, `Delete()`
- `Duplicates()`, `Histogram()`, `ExportCSV()`, `ImportCSV()`

**Modify**: `/internal/http/shelf_handler.go`

Same pattern for all shelf handlers:
- `List()`, `Create()`, `Get()`, `Update()`, `Delete()`
- `SaveLayout()`, `AssignItem()`, `RemoveItem()`, `ListPlacements()`

**Modify**: `/internal/http/series_handler.go`

- `List()`, `Get()` - extract user and pass to service

### Step 9: Update CSV Importer

**Modify**: `/internal/importer/csv_importer.go`

- Update `Import()` signature: `Import(ctx, reader, ownerID uuid.UUID)`
- Pass ownerID when listing existing items for duplicate detection
- Set ownerID on all created items

**Modify**: `/internal/http/handlers.go` (ImportCSV handler)

- Extract user and pass `user.ID` to importer

### Step 10: Update Tests

**Modify**: Test files to include owner context:
- `/internal/items/service_test.go`
- `/internal/items/postgres_repository_test.go` (if exists)
- `/internal/shelves/service_test.go`
- `/internal/http/handlers_test.go`

Add new test cases:
- Verify user A cannot see user B's items
- Verify user A cannot update/delete user B's items
- Verify 404 returned for cross-user access attempts

---

## Files to Modify (Summary)

| File | Changes |
|------|---------|
| `migrations/0012_add_owner_id.sql` | NEW - schema migration |
| `internal/items/model.go` | Add OwnerID field, update interfaces |
| `internal/items/postgres_repository.go` | Add owner filtering to all queries |
| `internal/items/memory_repository.go` | Update for tests |
| `internal/items/service.go` | Add ownerID params, validation |
| `internal/shelves/model.go` | Add OwnerID field, update interfaces |
| `internal/shelves/postgres_repository.go` | Add owner filtering to all queries |
| `internal/shelves/memory_repository.go` | Update for tests |
| `internal/shelves/service.go` | Add ownerID params |
| `internal/http/handlers.go` | Extract user, pass to services |
| `internal/http/shelf_handler.go` | Extract user, pass to services |
| `internal/http/series_handler.go` | Extract user, pass to services |
| `internal/importer/csv_importer.go` | Add ownerID param to Import |
| `internal/items/service_test.go` | Update tests with owner context |

---

## Future: Shared Libraries (Family Sharing)

The `owner_id` design enables easy extension to shared libraries. Here's how it would work:

### Scenario: Family Sharing
- **You** own all the books (owner_id = your user ID)
- **Family members** each have their own login
- You share your library with family members
- They see your items as if they were their own

### Implementation (future phase)

**1. New sharing table:**
```sql
CREATE TABLE library_shares (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id),      -- who owns the data
    shared_with_id UUID NOT NULL REFERENCES users(id), -- who can access it
    permission TEXT NOT NULL DEFAULT 'read',           -- 'read' or 'write'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_id, shared_with_id)
);
```

**2. Updated repository queries:**
```sql
-- Items visible to a user (their own + shared with them)
SELECT * FROM items
WHERE owner_id = $1  -- user's own items
   OR owner_id IN (SELECT owner_id FROM library_shares WHERE shared_with_id = $1)

-- For mutations, check permission level
-- 'read' users cannot edit/delete
-- 'write' users can modify shared items
```

**3. Permission levels:**
| Permission | View | Add | Edit | Delete |
|------------|------|-----|------|--------|
| `read`     | Yes  | No  | No   | No     |
| `write`    | Yes  | Yes | Yes  | Yes    |

**4. UI considerations (future):**
- Show indicator when viewing shared items
- Allow owner to manage who has access
- Show which family member added an item (if `write` access)

### Why `owner_id` enables this
Using `owner_id` (not `user_id`) makes semantics clear:
- `items.owner_id` = who created/owns the item
- `library_shares.owner_id` = whose library is being shared
- `library_shares.shared_with_id` = who can access it

If we used `user_id` everywhere, it would be confusing which "user" we mean.
