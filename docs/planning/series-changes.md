# Fix Series View to Show All Books

## Problem
The series view only displays books that have a `series_name` set. Standalone books (not part of any series) are excluded entirely because the backend query filters with `WHERE i.series_name != ''`.

## Solution
Extend the API response to include standalone books in a separate section. The series view will display:
1. Series grouped in expandable panels (existing behavior)
2. A "Standalone Books" section at the bottom for books without a series

---

## Implementation Steps

### Phase 1: Backend Changes

#### 1.1 Add Response Struct
**File:** `internal/items/model.go` (after line 248)

Add new struct:
```go
type SeriesListResponse struct {
    Series          []SeriesSummary `json:"series"`
    StandaloneItems []Item          `json:"standaloneItems"`
}
```

#### 1.2 Add Repository Method
**File:** `internal/items/model.go` (line 272, in Repository interface)

Add method:
```go
ListStandaloneItems(ctx context.Context, itemType ItemType) ([]Item, error)
```

#### 1.3 Implement Repository Method
**File:** `internal/items/postgres_repository.go` (after ListSeries method ~line 418)

Add new method to query books without a series:
```go
func (r *PostgresRepository) ListStandaloneItems(ctx context.Context, itemType ItemType) ([]Item, error)
```
Query: `WHERE (i.series_name = '' OR i.series_name IS NULL) AND i.item_type = $1 ORDER BY i.title`

#### 1.4 Update Service
**File:** `internal/items/service.go` (lines 329-363)

Change `ListSeries` to:
- Return `SeriesListResponse` instead of `[]SeriesSummary`
- Call `ListStandaloneItems` to fetch standalone books
- Include standalone items in response when `IncludeItems` is true

#### 1.5 Update Handler
**File:** `internal/http/series_handler.go` (lines 24-35)

Update `List` handler to serialize the new `SeriesListResponse` structure.

---

### Phase 2: Frontend Changes

#### 2.1 Add Response Interface
**File:** `web/src/app/models/series.ts`

Add:
```typescript
export interface SeriesListResponse {
    series: SeriesSummary[];
    standaloneItems: Item[];
}
```

#### 2.2 Update Series Service
**File:** `web/src/app/services/series.service.ts`

Change `list()` return type from `Observable<SeriesSummary[]>` to `Observable<SeriesListResponse>`

#### 2.3 Update Items Page Component
**File:** `web/src/app/pages/items/items-page.component.ts`

- Add `standaloneItems` signal
- Update series loading logic to extract both `series` and `standaloneItems` from response
- Pass `standaloneItems` to child component

#### 2.4 Update Series View Component
**File:** `web/src/app/pages/items/items-series-view/items-series-view.component.ts`

Add input:
```typescript
@Input({ required: true }) standaloneItems!: Signal<Item[]>;
```

Add helper methods for standalone section expansion handling.

#### 2.5 Update Series View Template
**File:** `web/src/app/pages/items/items-series-view/items-series-view.component.html`

Add "Standalone Books" section after the series accordion:
- Header with count
- Grid of `ItemCardComponent` for each standalone book
- Same click handling as series items

#### 2.6 Add Styles
**File:** `web/src/app/pages/items/items-series-view/items-series-view.component.scss`

Add styles for standalone section (margin, header, grid layout).

#### 2.7 Update Parent Template
**File:** `web/src/app/pages/items/items-page.component.html`

Pass `[standaloneItems]="standaloneItems"` to the series view component.

---

## Files to Modify

| File | Change |
|------|--------|
| `internal/items/model.go` | Add `SeriesListResponse` struct, update Repository interface |
| `internal/items/postgres_repository.go` | Add `ListStandaloneItems` method |
| `internal/items/service.go` | Update `ListSeries` to return combined response |
| `internal/http/series_handler.go` | Update handler for new response type |
| `web/src/app/models/series.ts` | Add `SeriesListResponse` interface |
| `web/src/app/services/series.service.ts` | Update return type |
| `web/src/app/pages/items/items-page.component.ts` | Add standalone signal, update loading |
| `web/src/app/pages/items/items-series-view/items-series-view.component.ts` | Add input, helpers |
| `web/src/app/pages/items/items-series-view/items-series-view.component.html` | Add standalone section |
| `web/src/app/pages/items/items-series-view/items-series-view.component.scss` | Add styles |
| `web/src/app/pages/items/items-page.component.html` | Pass standalone input |

---

## Testing
- Run `make api-test` after backend changes
- Run `cd web && npm test -- --watch=false` after frontend changes
