# Anthology

Anthology is a two-tier catalogue that combines a Go API (powered by the [`chi`](https://github.com/go-chi/chi) router) with an Angular Material frontend. The Phase 1 MVP focuses on managing a personal library of books, games, movies, and music with a polished catalogue presentation.

## Project structure

```
├── cmd/api                # Go entrypoint
├── internal               # Go packages (config, HTTP transport, domain logic)
├── migrations             # SQL migrations for Postgres
├── web                    # Angular workspace (standalone application)
├── deploy/docker-compose.yml
└── docs/planning/anthology.md
```

## Backend (Go)

* Go 1.22 with structured logging via `log/slog`.
* HTTP routing handled by `chi`, with middleware for request IDs, timeouts, and structured logging.
* Domain package `internal/items` exposes a repository interface with both in-memory and Postgres implementations.
* Configuration is environment-driven (`DATA_STORE`, `DATABASE_URL`, `PORT`, `LOG_LEVEL`, `ALLOWED_ORIGINS`, `API_TOKEN`). When `DATA_STORE=memory` (the default), the API boots with a seeded in-memory catalogue to help demo the experience quickly.
* When `API_TOKEN` is set, every `/api/*` request must send `Authorization: Bearer <token>`. Requests to `/health` remain public so uptime checks continue to work.
* CORS is enabled via [`github.com/go-chi/cors`](https://github.com/go-chi/cors) and defaults to allowing `http://localhost:4200` and `http://localhost:8080`. Override with `ALLOWED_ORIGINS="https://example.com,https://admin.example.com"` when deploying.
* Postgres persistence is implemented with `sqlx`; see [`migrations/0001_create_items.sql`](migrations/0001_create_items.sql) for the schema.

### Running the API locally (in-memory)

```bash
# From the repository root
export DATA_STORE=memory
export PORT=8080
export ALLOWED_ORIGINS="http://localhost:4200,http://localhost:8080"
export API_TOKEN="super-secret-token"
go run ./cmd/api
```

The API listens on `http://localhost:8080` and exposes:

| Method | Endpoint       | Description            |
| ------ | -------------- | ---------------------- |
| GET    | `/health`      | Service health check   |
| GET    | `/api/items`   | List catalogue items   |
| POST   | `/api/items`   | Create a new item      |
| GET    | `/api/items/{id}` | Retrieve an item   |
| PUT    | `/api/items/{id}` | Update an item      |
| DELETE | `/api/items/{id}` | Delete an item      |

### Using Postgres

```bash
export DATA_STORE=postgres
export DATABASE_URL="postgres://anthology:anthology@localhost:5432/anthology?sslmode=disable"
export PORT=8080
export ALLOWED_ORIGINS="https://tracker.example.com"
export API_TOKEN="super-secret-token"

# Apply the migration (example)
psql "$DATABASE_URL" -f migrations/0001_create_items.sql

go run ./cmd/api
```

A ready-to-run Compose file is included:

```bash
cd deploy
docker compose up --build
```

This starts Postgres and the API container. The API automatically reads the connection string defined in the Compose file.

### Tests

```bash
go test ./...
```

## Frontend (Angular)

* Angular 20 standalone application located in `web/`.
* Styling is powered by [`@angular/material`](https://www.npmjs.com/package/@angular/material) and its Material 3 design tokens. The global theme lives in [`web/src/styles.scss`](web/src/styles.scss).
* The main page (`ItemsPageComponent`) provides a responsive catalogue view, inline editing, and CRUD actions that call the Go API. A dedicated login screen stores your bearer token locally and the application automatically attaches it to every request.
* API base URL is resolved from the `<meta name="anthology-api">` tag (defaults to `http://localhost:8080/api`).
* The UI seed data and layout offer a curated catalogue dashboard out of the box.

### Development workflow

```bash
cd web
npm install --package-lock=false   # Avoids creating package-lock.json as requested
npm start                           # ng serve --open
```

The dev server runs on `http://localhost:4200` and proxies requests directly to the API URL specified in the meta tag. To point at a different backend, update the meta tag in `web/src/index.html` (for local overrides you can edit it before serving).

When you first load the app you will be redirected to the login screen. Paste the same value you configured for `API_TOKEN` on the API server and the Angular client will persist it in `localStorage` for subsequent visits. Use the “Log out” button in the toolbar to clear it at any time.

### Testing and linting

After installing dependencies you can run:

```bash
cd web
npm test -- --watch=false
npm run lint
```

(Angular CLI creates the recommended lint configuration out of the box.)

## Deployment notes

* **Docker**: the repository includes a multi-stage `Dockerfile` that builds the Go binary into a distroless image. Copy `web/` assets into a separate static hosting solution (such as an nginx container) for production.
* **Environment management**: prefer `.env` files for local overrides (`DATA_STORE`, `DATABASE_URL`, `LOG_LEVEL`). Do not commit secrets.
* **Migrations**: Ship migrations alongside deployments (e.g., run via `golang-migrate` or `psql`) before starting the API container.

## Further reading

* [Planning document](docs/planning/anthology.md) for the full multi-phase roadmap.
* `internal/items/service_test.go` covers domain validation logic and in-memory repository behaviour.
* `web/src/app/pages/items/items-page.component.*` contains the main Angular page that ties the experience together.
