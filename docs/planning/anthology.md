# Anthology Project Plan

## Phase 0 – Project Organization & Tracking

Set up a GitHub repository with a `main` branch protected via branch protections (status checks, reviews). Create a GitHub Project board (e.g., “Anthology”) using columns such as *Backlog*, *In Progress*, *In Review*, *Done*. Define issue templates for user stories (feature), bugs, and technical tasks. Agree on a naming convention for issues/branches/commits. Add a CONTRIBUTING.md describing commit message style (Conventional Commits), review expectations, coding standards, and test requirements. Add CI (GitHub Actions) workflows for linting, tests, Docker build, Go static checks (`go vet`, `golangci-lint` if feasible), Angular lint/tests (`ng lint`, `ng test --watch=false`). Create project milestones matching phases below to visualize progress.

:::task-stub{title="Repository & project scaffolding"}
1. Initialize Git repo with README, license, `.gitignore` (Go, Angular, Docker), CONTRIBUTING.md.
2. Configure GitHub Project board, issue templates, milestones, and branch protections.
3. Set up CI workflows for Go, Angular, Docker image build.
4. Document coding standards, commit conventions, review process.
:::

---

## Phase 1 – Minimum Viable Product

Goal: list items (books, records, games) with core metadata via CRUD API and Angular UI.

### Backend (Go)
- Create a Go module (`cmd/api`, `internal/…`) following Clean Architecture or layered structure.
- Define Postgres schema using migrations (e.g., `golang-migrate`). Tables: `items`, `item_categories`, `platforms`, `item_formats`, maybe `tags` pivot tables later. For MVP, single `items` table with enum-ish fields (`type`, `title`, `creator`, `release_year`, `notes`, `created_at`, `updated_at`).
- Build REST API with the [`chi`](https://github.com/go-chi/chi) router. Endpoints: `POST /items`, `GET /items`, `GET /items/{id}`, `PUT /items/{id}`, `DELETE /items/{id}`. Provide validation, error handling, loggers (structured logs). Add configuration via environment variables (12-factor style), support `.env` for local dev.
- Persistence layer using repository interface, transaction handling, context propagation, unit tests with test containers or mocking DB using `sqlmock`.
- Containerize API with multi-stage Dockerfile (build binary → minimal runtime). Provide `docker-compose.yml` (for local dev, even if final is swarm) with Go API, Postgres (init scripts), Angular dev container optional.

### Frontend (Angular)
- Scaffold Angular app with routing, state management (NgRx optional later), shared module. Minimal layout (toolbar, navigation).
- Create Item list page (table/cards) with sorting/filtering placeholder, Item form page (create/edit). Use Angular Material for consistent UI. Implement services calling backend via `HttpClient`, environment configs for API base URL. Add basic form validation and toasts/snackbars.

### Tests & Quality
- Backend unit tests for handlers/services. E2E tests using `go test` with integration container? (optional now).
- Frontend unit tests for components/services, basic e2e (Cypress/Playwright) smoke.
- Ensure linting (golangci-lint, `ng lint`) passes in CI.

### Deployment
- Create Docker Swarm stack file (`deploy/stack.yml`) referencing backend, frontend (served via nginx), Postgres (with persistent volume).
- Document local development workflow in README.

:::task-stub{title="MVP: CRUD inventory app"}
1. Design DB schema and migrations for core item fields; configure Postgres connection pooling.
2. Implement Go API (routing, handlers, services, repositories) with validation, logging, tests.
3. Scaffold Angular app with list/detail forms for items, service layer, Angular Material styling.
4. Containerize services; add docker-compose for dev and swarm stack manifest; update docs.
:::

---

## Phase 2 – Catalog Enhancements

Add richer metadata, search, categorization.

### Backend
- Extend schema to include `authors/artists`, `genres`, `platforms`, `formats`, `locations`, `status` (owned/loaned). Use join tables (`item_tags`, `item_platforms`). Provide migrations and seed data.
- Add endpoints for metadata management (`GET /genres`, etc.) and filtering query params for `/items` (by type, platform, status).
- Implement search (full-text index in Postgres using `tsvector` or `ILIKE`). Support pagination, sorting.

### Frontend
- Update forms to support additional fields with select inputs/autocomplete, chips for tags.
- Add advanced filter panel, search bar, and saved filters if desired.
- Display counts (dashboard cards for totals per type/status).

### Tests
- Expand backend tests for search/filter logic. Integration tests verifying DB queries.
- Frontend tests for new components/filters.

:::task-stub{title="Enhanced metadata & search"}
1. Create migrations for new reference tables and relationships; seed defaults.
2. Extend Go services/endpoints for metadata CRUD and filtering/pagination.
3. Update Angular UI for advanced filters, extra fields, search; adjust state management.
4. Add tests covering new query parameters and UI behavior.
:::

---

## Phase 3 – Media & UX Improvements

Introduce cover art, bulk operations, import/export.

### Features
- Allow uploading cover images/manual URLs stored in object storage (local filesystem or MinIO). Serve via CDN path.
- Bulk import/export via CSV/JSON. Backend endpoints to process uploads; use background jobs queue (simple go routine worker) for large imports.
- Implement bulk edit/delete in frontend (checkbox selection). Provide toasts, confirmations.

### Best Practices
- Validate upload sizes/types, sanitize filenames.
- Add rate limiting/auth (even for personal use, maybe simple basic auth or local network IP restrictions).
- Logging/tracing improvements (OpenTelemetry). Add structured audit logs for changes.

:::task-stub{title="Media handling & bulk workflows"}
1. Add storage service (filesystem/minio) and API endpoints for media upload/retrieval.
2. Implement import/export pipelines with background jobs and progress feedback.
3. Extend Angular UI for image preview, bulk selection actions, upload flows.
4. Harden security (auth middleware, rate limiting) and observability.
:::

---

## Phase 4 – Automation & Insights

- Optional scheduled backups (cron job containers) for Postgres and media.
- Analytics dashboard: charts for collection size over time, most frequent genres, etc. Use material chart or ngx-charts. Backend aggregate queries.
- Notifications (email/local) for reminders (e.g., loaned items due). Could integrate with calendar.

:::task-stub{title="Backups, analytics, notifications"}
1. Configure scheduled backup service in swarm (pg_dump, media sync); document restore.
2. Build reporting endpoints (aggregates) and Angular dashboard with charts.
3. Implement optional notification service (email/smtp) with backend jobs and settings UI.
:::

---

## Ongoing Best Practices

- Maintain consistent coding style with linters/formatters (`gofmt`, `goimports`, `eslint`, `prettier`).
- Use feature branches per issue, link commits via closing keywords (“Closes #123”).
- Keep secrets out of repo (use Docker secrets or `.env` excluded from Git).
- Monitor dependencies (Renovate bot) and security (Dependabot alerts).
- Regularly update documentation (README, architecture diagrams, ADRs for key decisions).
- Consider writing automated end-to-end tests (Playwright/Cypress + Go integration) triggered on CI.
