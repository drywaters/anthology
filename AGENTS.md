# Repository Guidelines

## Stack overview
Anthology is a two-tier catalogue: a Go 1.22 API (under `cmd/api` + `internal/`) fronted by an Angular 20 Material UI (`web/`). Recent work adds metadata search (Google Books), CSV imports, and cover thumbnails that all flow through the Add Item page so validation and enrichment behave consistently. A new shelves module models real-world shelves with photo-backed layouts so items can be placed into slots and surfaced in the UI.

## Project Structure & Module Organization
- `cmd/api`: Go entrypoint; wire up config, repositories, chi router, middleware, and HTTP handlers.
- `internal/`: shared Go packages (domain logic, importer, catalog lookups, services, transport, config). Shelf layout + placement logic now lives in `internal/shelves`.
- `migrations/`: Postgres DDL (apply via `psql` or your migration runner before switching to `DATA_STORE=postgres`). Run through `0007_make_no_status_explicit.sql` to get shelves and explicit default reading status.
- `web/`: Angular workspace (feature modules under `web/src/app`, Material theme in `web/src/styles.scss`, runtime config in `web/src/assets/runtime-config.js`). Shelf management views live under `web/src/app/pages/shelves`.
- `Docker/`: split Dockerfiles (`Dockerfile.api`, `Dockerfile.ui`) for the independently deployable API/UI containers.
- `docs/architecture/` & `docs/planning/`: architecture diagrams, startup flows, Material guidelines, and roadmap notes.

## Build, Test, and Development Commands
- `go run ./cmd/api` — boots the API using the current env vars; defaults to `DATA_STORE=memory` with seeded demo data.
- `go test ./...` — Go unit tests (catalog lookups, importer, services, handlers).
- `cd web && npm install` — install Angular deps (Material, CLI, test runners).
- `cd web && npm start` — Angular dev server on `http://localhost:4200` proxying to the API URL defined in the meta tag/runtime config.
- `cd web && npm test -- --watch=false` and `npm run lint` — Jasmine/Karma suite plus ESLint.
- `make local` — convenience target to boot the API and Angular dev server together for end-to-end checks.

## Coding Style & Naming Conventions
- Go: auto-format with `gofmt`, keep imports sorted, use short receiver names, and follow package boundaries like `internal/items`. Exported types mirror the `ItemService`/`ItemRepository` style. Logging uses `slog`.
- Angular: 2-space indentation, kebab-case filenames (`items-page.component.ts`), standalone components, and SCSS scoped per component. Stick to Material 3 tokens defined in `styles.scss`. Keep environment variables in screaming snake case (e.g., `API_TOKEN`).

## Configuration & Security
- Primary env vars: `DATA_STORE`, `DATABASE_URL`, `PORT`, `LOG_LEVEL`, `ALLOWED_ORIGINS`, `API_TOKEN`, `GOOGLE_BOOKS_API_KEY`. `_FILE` variants are respected (defaults point to `/run/secrets/anthology_*` in Docker, including `/run/secrets/anthology_google_books_api_key`). `GOOGLE_BOOKS_API_KEY` is required even in local/dev; set a placeholder when testing.
- `DATA_STORE=memory` seeds demo catalogue data plus a sample shelf with pre-placed items; `DATA_STORE=postgres` expects migrations through `0007` to be applied and uses the `sqlx` repo implementation.
- CORS defaults allow `http://localhost:4200`/`8080`; override via `ALLOWED_ORIGINS`.
- Enable bearer auth (`API_TOKEN`) outside local demos. The Angular login screen exchanges tokens via `/api/session` to mint HttpOnly cookies.
- Never commit secrets; rely on `.env` files locally. Docker secrets `anthology_database_url` and `anthology_api_token` map to the `_FILE` envs.

## Feature behavior notes
- Reading status supports `none`/`want_to_read`/`reading`/`read`; defaults to `none`. Filtering by `status` with no type filter applies only to books (non-books remain visible when status = `none`, and are excluded for the other statuses). `read` requires `readAt`; `reading` enforces non-negative `currentPage` capped by `pageCount` when provided.
- Shelf APIs (`/api/shelves`) expose list/create/get, layout updates, and slot assignment/removal. Layout updates return displaced items; item placements update the cached `shelfPlacement` on items for list/grid views.

## Testing & Validation Guidelines
- Backend tests live next to their code (`*_test.go`); cover validation, repository behaviour, importer edge cases, catalog lookups, shelf layout validation, and displacement/placement flows.
- Frontend specs (`*.spec.ts`) mirror component paths, covering search flow, manual entry, CSV imports, and UI copy.
- Run `go test ./...`, `npm test -- --watch=false`, and `npm run lint` before every PR. Hook `githooks/pre-commit` into `.git/hooks` to enforce `golangci-lint run ./...` plus `npm run lint` unless `SKIP_PRECOMMIT_LINT=1` is set.
- Always validate UI work in the running Angular app via the Playwright MCP: grab at least one screenshot (include scrolled states if relevant) from `http://localhost:4200`, and log any console or network errors.

## Commit & Pull Request Guidelines
- Keep commits short, imperative, and scoped (e.g., “Add bearer token authentication”). Reference issues in the body when helpful.
- PRs must include a change summary, manual test notes, confirmation that both `go test` and `npm test`/`npm run lint` were run, and screenshots or GIFs for UI changes. Mention deployment/migration steps if applicable.

## Deployment Notes
- Docker images are split: API (`Docker/Dockerfile.api`) and UI (`Docker/Dockerfile.ui`). Makefile targets (`docker-build-*`, `docker-push-*`, `docker-buildx-*`) wrap builds/pushes.
- UI container rewrites `assets/runtime-config.js` from `NG_APP_API_URL` at startup so you can repoint environments without rebuilding Angular assets.
- Apply SQL migrations before booting the Postgres-backed API (run through `0007` for shelves + explicit reading status defaults), and ensure services load secrets through env vars or Swarm/Stack secret mounts.

## Local Auth Token
The Makefile defaults `API_TOKEN ?= local-dev-token`. Reuse this for local testing/logins unless explicitly overriding the token in your environment or deployment config.
