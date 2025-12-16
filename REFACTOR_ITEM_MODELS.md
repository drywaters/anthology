# Plan: Refactor item.ts into smaller model files

## Current State
`web/src/app/models/item.ts` (177 lines) contains:
- Core interfaces: `Item`, `ItemForm`
- Item type constants: `ItemTypes`, `ItemType`, `ITEM_TYPE_LABELS`
- Book-specific: `BookStatus`, `Formats`, `Genres` + their labels
- Filter types: `BookStatusFilters`, `ShelfStatusFilters` + labels
- Utility types: `DuplicateMatch`, `DuplicateCheckInput`, `LetterHistogram`, `ShelfPlacementSummary`

23 files import from this module with no circular dependencies.

## Proposed Structure

Split into 5 focused files under `web/src/app/models/`:

### 1. `item-types.ts` (new)
General item type enumeration:
```
ItemTypes, ItemType, ITEM_TYPE_LABELS
```

### 2. `book.ts` (new)
All book-specific types and constants:
```
BookStatus (type + const), BOOK_STATUS_LABELS
Formats, Format, FORMAT_LABELS
Genres, Genre, GENRE_LABELS
```

### 3. `filters.ts` (new)
Filter-related types:
```
BookStatusFilters, BookStatusFilter
ShelfStatusFilters, ShelfStatusFilter, SHELF_STATUS_LABELS
```

### 4. `duplicates.ts` (new)
Duplicate detection types:
```
DuplicateMatch, DuplicateCheckInput
```

### 5. `item.ts` (simplified)
Core item interfaces only:
```
Item, ItemForm, LetterHistogram, ShelfPlacementSummary
```
Imports types from the other files as needed.

### 6. `index.ts` (new barrel export)
Re-exports everything for backward compatibility:
```typescript
export * from './item-types';
export * from './book';
export * from './filters';
export * from './duplicates';
export * from './item';
```

## Implementation Steps

1. Create `item-types.ts` - move ItemTypes, ItemType, ITEM_TYPE_LABELS
2. Create `book.ts` - move BookStatus, Formats, Genres and their labels
3. Create `filters.ts` - move filter types (imports BookStatus from book.ts)
4. Create `duplicates.ts` - move DuplicateMatch, DuplicateCheckInput
5. Simplify `item.ts` - keep Item, ItemForm, LetterHistogram, ShelfPlacementSummary; add imports from new files
6. Create `index.ts` barrel export for backward compatibility
7. Update all 23 consumer files to import from `models` or specific files
8. Run `npm run lint` and `npm test -- --watch=false` to verify

## Files to Modify
- `web/src/app/models/item.ts` (simplify)
- `web/src/app/models/index.ts` (create)
- `web/src/app/models/item-types.ts` (create)
- `web/src/app/models/book.ts` (create)
- `web/src/app/models/filters.ts` (create)
- `web/src/app/models/duplicates.ts` (create)
- 23 consumer files (update imports)
