# Repository Guidelines

## Project Structure & Module Organization
`cmd/api` hosts the Go entrypoint, while shared domain, transport, and config code lives under `internal/`. SQL migrations sit in `migrations/`, and container build assets live in `Docker/`. Architectural diagrams live under `docs/architecture/`, and the Angular workspace is contained in `web/`, with feature modules under `web/src/app` and global styles in `web/src/styles.scss`.

## Build, Test, and Development Commands
- `go run ./cmd/api` — boots the API with the current `DATA_STORE` configuration.
- `go test ./...` — runs all Go unit tests; use before every PR.
- `cd web && npm install` — install UI dependencies.
- `cd web && npm start` — Angular dev server with proxy to the configured API.
- `cd web && npm test -- --watch=false` / `npm run lint` — CLI test runner and ESLint/Angular checks.

## Coding Style & Naming Conventions
Go files are auto-formatted with `gofmt`; keep imports sorted and favor short, descriptive receiver names. Package boundaries follow `internal/<domain>` and exported types should use the `ItemService`/`ItemRepository` naming seen in `internal/items`. Angular code uses 2-space indentation, kebab-case file names (`items-page.component.ts`), and SCSS modules scoped per component. Environment variables stay in screaming snake case (e.g., `API_TOKEN`).

## Testing Guidelines
Backend tests rely on the Go standard library; place new specs beside the code (`*_test.go`) and cover validation plus repository behaviours. Frontend uses Jasmine/Karma; test files mirror the component path with `.spec.ts`. Aim for meaningful assertions around API integration and UI state. Run both `go test ./...` and `npm test -- --watch=false` before pushing.

Always validate UI changes in the running Angular app with Playwright MCP: capture at least one screenshot that demonstrates the change (scrolling states when relevant) and note any console/network errors. Use the dev server at `http://localhost:4200` for these checks whenever possible.

## Commit & Pull Request Guidelines
Commits should stay short, imperative, and scoped (see `Add bearer token authentication` in history). Reference related issues in the body when helpful. PRs need a summary of the change, manual-test notes, and screenshots/GIFs for UI updates. Link deployment or migration steps when relevant, and confirm both API and Angular test suites were run.

## Security & Configuration Tips
Never check secrets into Git; rely on local `.env` files for `DATABASE_URL`, `API_TOKEN`, etc. Lock down CORS origins through `ALLOWED_ORIGINS` and enable bearer auth outside of local demos. When using Postgres, run migrations (`psql "$DATABASE_URL" -f migrations/0001_create_items.sql`) before starting the API so schema drift does not break requests.

For local testing, reuse the `API_TOKEN` default defined in the `Makefile` (`API_TOKEN ?= local-dev-token`). Use that token in the login screen or in automated flows unless overriding via environment variables.
