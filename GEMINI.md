# Gemini Context: Anthology

## Project Overview
Anthology is a two-tier catalogue application designed to manage personal libraries of books, games, movies, and music. It features a Go (1.24+) API backend and an Angular (20) Material frontend. The architecture allows for independent deployment of the API and UI.

## Architecture

### Backend (Go)
-   **Entrypoint:** `cmd/api`
-   **Router:** `chi` (v5)
-   **Persistence:** Postgres (via `sqlx`), Goose-managed migrations.
-   **Structure:**
    -   `internal/items`: Domain logic and repository interfaces.
    -   `internal/catalog`: Google Books API client for metadata.
    -   `internal/importer`: CSV import logic.
    -   `internal/http`: HTTP handlers and routing.
    -   `internal/config`: Configuration management.

### Frontend (Angular)
-   **Location:** `web/`
-   **Framework:** Angular 20 (Standalone components).
-   **UI Library:** Angular Material 3.
-   **Key Components:**
    -   `ItemsPageComponent`: Main catalogue view.
    -   `AddItemPageComponent`: Search, manual entry, and CSV import flows.

## Building and Running

### Prerequisites
-   Go 1.24+
-   Node.js & npm
-   Docker (optional, for container builds)

### Backend (API)
The API runs on port 8080 by default.

```bash
# Run with Postgres storage (required)
make api-run
# OR directly
go run ./cmd/api

# Run tests
make api-test
# OR
go test ./...
```

### Frontend (UI)
The UI runs on port 4200 by default and proxies API requests to `http://localhost:8080`.

```bash
cd web
npm install
npm start  # Runs ng serve
```

### Combined (Local Dev)
To run both backend and frontend concurrently:
```bash
make local
```

### Docker
Build images for both API and UI:
```bash
make docker-build
```

## Configuration
Configuration is driven by environment variables. Defaults are set in `Makefile` and `internal/config`.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DATA_STORE` | `postgres` | `postgres` (required) |
| `DATABASE_URL` | `...` | Postgres connection string |
| `PORT` | `8080` | API listening port |
| `APP_ENV` | `production` | `development` or `production` |
| `GOOGLE_BOOKS_API_KEY` | `...` | API key for metadata lookups |
| `AUTH_GOOGLE_CLIENT_ID` | `...` | Google OAuth client ID (required) |
| `AUTH_GOOGLE_CLIENT_SECRET` | `...` | Google OAuth client secret (required) |
| `AUTH_GOOGLE_ALLOWED_DOMAINS` | `...` | OAuth allowlist domains (required) |
| `AUTH_GOOGLE_ALLOWED_EMAILS` | `...` | OAuth allowlist emails (required) |
| `AUTH_GOOGLE_REDIRECT_URL` | `...` | OAuth callback URL |
| `FRONTEND_URL` | `...` | UI URL used for OAuth redirects |
| `ALLOWED_ORIGINS` | `...` | CORS allowed origins |

**Note:** `_FILE` variants (e.g., `DATABASE_URL_FILE`) are supported for Docker secrets. OAuth is required in all environments, and sessions use Postgres. Goose runs migrations on API startup using `migrations/0001_baseline.sql` as the current-schema baseline.

## Development Conventions

### Go
-   **Formatting:** Standard `gofmt`.
-   **Logging:** Use `log/slog`.
-   **Testing:** Colocated tests (`*_test.go`).
-   **Linting:** `golangci-lint`.

### Angular
-   **Style:** 2-space indentation.
-   **Naming:** Kebab-case filenames (e.g., `items-page.component.ts`).
-   **Structure:** Standalone components; SCSS scoped per component.
-   **Linting:** `npm run lint` (ESLint).

### Git Hooks
A pre-commit hook is available to enforce linting:
```bash
cp githooks/pre-commit .git/hooks/pre-commit
```
