# Plan: Remove Uncollected Books from Series View

## Summary
Remove the "Uncollected books" section from the series/collection view so it only displays actual series/collections.

## Background
The series view currently shows:
1. Series panels (e.g., "The Lord of the Rings") with owned/missing counts
2. An "Uncollected books" panel showing standalone items not part of any series

The user wants to remove #2 - the uncollected books section.

## Files to Modify

### Frontend (Angular)

1. **`web/src/app/pages/items/items-series-view/items-series-view.component.html`**
   - Remove the expansion panel that displays "Uncollected books" and iterates over `standaloneItems()`

2. **`web/src/app/pages/items/items-series-view/items-series-view.component.ts`**
   - Remove `@Input() standaloneItems` input
   - Remove `standaloneExpanded` signal
   - Remove `toggleStandaloneExpanded()` method

3. **`web/src/app/pages/items/items-page.component.html`**
   - Remove `[standaloneItems]="standaloneItems"` binding from `<app-items-series-view>`

4. **`web/src/app/pages/items/items-page.component.ts`**
   - Remove `standaloneItems` signal (line 107)
   - Update `hasSeriesData` computed to only check `seriesData().length > 0` (remove standaloneItems check)
   - Remove `this.standaloneItems.set(...)` from the series service response handler

5. **`web/src/app/pages/items/items-series-view/items-series-view.component.spec.ts`**
   - Update tests to remove standaloneItems-related test data and assertions

### Backend (Go)

6. **`internal/items/service.go`**
   - Remove logic that collects standalone items in `ListSeriesWithItems()`
   - Update `SeriesListResult` struct to remove `StandaloneItems` field

7. **`internal/http/series_handler.go`**
   - Remove `standalone_items` from JSON response

8. **`internal/items/model.go`**
   - Remove `StandaloneItems` from `SeriesListResult` struct if defined here

9. **`internal/items/postgres_repository.go`** and **`internal/items/memory_repository.go`**
   - Remove standalone items query/logic if present

10. **`internal/http/handlers_test.go`**
    - Update tests to remove standalone items assertions

### Frontend Models

11. **`web/src/app/models/series.ts`**
    - Remove `standaloneItems` from `SeriesListResponse` interface

12. **`web/src/app/services/series.service.ts`**
    - Update response handling if needed

## Implementation Order
1. Backend: Remove standalone items from service, model, and handlers
2. Backend: Update tests
3. Frontend: Remove standaloneItems from models and service
4. Frontend: Update component TS to remove inputs/signals
5. Frontend: Update component HTML to remove uncollected books panel
6. Frontend: Update parent component to stop passing standaloneItems
7. Frontend: Update tests
