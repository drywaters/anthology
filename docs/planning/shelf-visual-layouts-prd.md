# Shelf Visual Layouts (Photo + Grid Overlay)

## Overview / Problem Statement
Shelf and storage locations are currently text-only, which makes them hard to visualize, keep consistent, and update when shelves change. This feature adds a dedicated Shelf workspace—separate from existing item pages—where users upload a shelf photo, overlay an adjustable grid, and place items visually. Irregular shelves (rows with varying column counts/widths) must be supported without breaking existing placements when layouts change.

## Goals
- Upload a shelf photo and overlay a resizable grid of slots.
- Support irregular layouts with per-row column counts and variable boundaries.
- Assign items to slots and visualize placements on the photo.
- Allow safe layout edits (resize, add/remove rows/columns) with predictable item handling.
- Remain usable for large shelves via zoom/pan and performant rendering.

## Non-Goals
- Computer vision for auto-detecting books/items in photos.
- Physical measurements in inches/cm.
- Multi-user collaborative editing; single-user editing assumed.

## User Personas
- **Owner / Power User:** multiple shelves, wants precise control and quick retrieval.
- **Casual User:** one or two shelves, prefers simple setup and visual browsing.

## Core User Stories
1. **Create a shelf layout from a photo:** upload shelf image, draw rows/columns to define slots.
2. **Handle irregular rows/columns:** rows can differ in column counts and widths.
3. **Assign items to slots:** click a slot, see current contents, add/remove items.
4. **View items on the shelf:** open shelf detail with overlayed grid and item indicators.
5. **Modify layout without chaos:** edit boundaries or add/remove rows/columns while preserving placements where possible and surfacing unplaced items when not.
6. **Large shelf navigation:** zoom/pan (and optional segments) keep large grids usable.

## UX / Interaction Design
### Shelf workspace
- **Shelf List (new module separate from existing item flows):** name, thumbnail (photo + overlay hint), item count, "Add Shelf" button.
- **Shelf Detail:** full photo with grid overlay, zoom/pan controls, sidebar with items on the shelf; clicking an item highlights its slot.
- **Mode toggle:** View vs. Edit Layout.

### Creating a new shelf
1. "Add Shelf" opens form for name + optional description and photo upload.
2. Display photo on a canvas with a default single-row/column grid and guidance to draw rows/columns.
3. **Rows:** "Add Row" inserts horizontal divider across width; drag boundaries (stored as normalized Y 0–1).
4. **Columns per row:** select a row then "Add Column"; drag boundaries within that row (normalized X 0–1). Different rows can have different column counts/widths.
5. Each slot = rowIndex/colIndex with derived x/y start/end from row/column boundaries.

### Assigning items to slots
- In View Mode, clicking a slot opens sidebar/modal showing current items and an "Add item" search/select.
- Multiple items per slot allowed; remove from slot inline.
- Optional Move Items mode for drag-and-drop between slots.

### Editing layout later
- Drag existing row/column boundaries; add/remove rows or columns.
- Items stay tied to their (rowIndex, colIndex) when boundaries move.
- Deleting a row/column warns how many items will be unplaced; on confirm, affected items move to an **Unplaced** pool in the sidebar for reassignment.
- Edit session keeps an original copy in memory: Cancel reverts; Save commits changes.

### Large shelf handling
- Zoom/pan over photo + overlay; optional mini-map showing viewport for large layouts.
- Optional future segmentation (split a physical shelf into sub-sections) if zoom/pan alone is insufficient.

## Data Model (proposed, align to Go/Postgres stack)
- `shelves`: `id` (UUID PK), `name`, `description`, `photo_url`, timestamps.
- `shelf_rows`: `id`, `shelf_id` FK, `row_index` (0-based), `y_start_norm`, `y_end_norm` (0–1, non-overlapping, ordered).
- `shelf_columns`: `id`, `shelf_row_id` FK, `col_index` (0-based), `x_start_norm`, `x_end_norm` (0–1, non-overlapping within row).
- `shelf_slots` (materialized for simpler joins): `id`, `shelf_id` FK, `shelf_row_id` FK, `shelf_column_id` FK, `row_index`, `col_index`, `x_start_norm`, `x_end_norm`, `y_start_norm`, `y_end_norm`.
- `item_shelf_locations`: `id`, `item_id` FK -> items, `shelf_id` FK, nullable `shelf_slot_id` (null = unplaced on this shelf), `created_at`.

## API Design (JSON over REST)
- **POST /api/shelves** — create shelf (name, description, photo upload/URL). Returns shelf metadata and empty layout scaffold.
- **GET /api/shelves** — list shelves with thumbnail info and item counts.
- **GET /api/shelves/:id** — returns shelf + rows/columns/slots + item placements (placed + unplaced).
- **PUT /api/shelves/:id** — update shelf metadata/photo; keep normalized coordinates when photo changes (warn if alignment might shift).
- **PUT /api/shelves/:id/layout** — upsert rows/columns and regenerate slots. Body example:
  ```json
  {
    "rows": [
      {
        "rowId": "existing-or-null",
        "rowIndex": 0,
        "yStartNorm": 0.1,
        "yEndNorm": 0.2,
        "columns": [
          { "columnId": "existing-or-null", "colIndex": 0, "xStartNorm": 0.0, "xEndNorm": 0.15 }
        ]
      }
    ]
  }
  ```
  - Server recomputes slots and returns updated layout plus any items displaced into the Unplaced pool.
- **POST /api/shelves/:id/slots/:slotId/items** — assign item to slot (allow multiple items).
- **DELETE /api/shelves/:id/slots/:slotId/items/:itemId** — remove item from slot.
- **POST /api/shelves/:id/items/reassign** — optional batch move payload to support drag-and-drop.

## Validation / Rules
- Rows/columns must not overlap and must have positive height/width (`end_norm` > `start_norm`).
- Layout update warns and returns counts of items unplaced due to deleted rows/columns.
- Keeping normalized coordinates allows photo replacement without recalculating layout (may still require visual tweak).
- Pagination/limits on item lists to keep large shelves performant.

## Rollout Notes
- Implement as a dedicated Shelf module in the Angular app (list + detail + layout editor) to keep workflows isolated from existing item CRUD pages.
- Go API: add migrations for shelf tables, repository/service layer for layout validation and reconciliation, and handler responses that include displaced items for UI prompts.
- Seed data for demo: include one shelf photo URL with a simple layout to showcase the feature.
