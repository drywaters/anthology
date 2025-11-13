# Anthology

Anthology is a two-tier catalogue that combines a Go API (powered by the [`chi`](https://github.com/go-chi/chi) router) with an Angular Material frontend. The Phase 1 MVP focuses on managing a personal library of books, games, movies, and music with a polished catalogue presentation.

## Project structure

```
├── cmd/api                # Go entrypoint
├── internal               # Go packages (config, HTTP transport, domain logic)
├── migrations             # SQL migrations for Postgres
├── web                    # Angular workspace (standalone application)
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

### Tests

```bash
go test ./...
```

## Frontend (Angular)

* Angular 20 standalone application located in `web/`.
* Styling is powered by [`@angular/material`](https://www.npmjs.com/package/@angular/material) and its Material 3 design tokens. The global theme lives in [`web/src/styles.scss`](web/src/styles.scss).
* The main page (`ItemsPageComponent`) provides a responsive catalogue view, inline editing, and CRUD actions that call the Go API. A dedicated login screen exchanges your bearer token for an HttpOnly session cookie so browsers send it automatically without exposing it to JavaScript.
* API base URL is resolved from the `<meta name="anthology-api">` tag (defaults to `http://localhost:8080/api`).
  Deployments can override this without rebuilding by setting `window.NG_APP_API_URL` before the Angular bundle loads (the shipped `assets/runtime-config.js` file is replaced at container start when `NG_APP_API_URL` is defined).
* The UI seed data and layout offer a curated catalogue dashboard out of the box.

### Development workflow

```bash
cd web
npm install
npm start                           # ng serve --open
```

The dev server runs on `http://localhost:4200` and proxies requests directly to the API URL specified in the meta tag. To point at a different backend, update the meta tag in `web/src/index.html` or adjust `web/src/assets/runtime-config.js` before serving. Running `make local` will start both the Go API and Angular dev server together for local testing.

When you first load the app you will be redirected to the login screen. Paste the same value you configured for `API_TOKEN` on the API server and the Angular client will call `/api/session` to mint an HttpOnly cookie. Use the “Log out” button in the toolbar to clear it at any time.

### Testing and linting

After installing dependencies you can run:

```bash
cd web
npm test -- --watch=false
npm run lint
```

(Angular CLI creates the recommended lint configuration out of the box.)

To produce the bundle consumed by the nginx-based UI container, build the production assets so they land in `web/dist/web/browser`:

```bash
cd web
npm run build
```


## Deployment notes

* **Docker**: the repository now publishes separate images for the API (`Docker/Dockerfile.api`) and UI (`Docker/Dockerfile.ui`). The Makefile targets `docker-build-api`/`docker-build-ui` (and matching `docker-push`/`docker-buildx` variants) build and publish each image. The UI container writes `assets/runtime-config.js` from the `NG_APP_API_URL` environment variable so preview deployments can point at different backends.
* **Secrets**: the API automatically loads `DATABASE_URL` and `API_TOKEN` from either the env var or a `<NAME>_FILE` path. The published Docker image sets `/run/secrets/anthology_database_url` and `/run/secrets/anthology_api_token` as the defaults, so Swarm/Stack secrets are consumed without baking credentials into the image.
* **Environment management**: prefer `.env` files for local overrides (`DATA_STORE`, `DATABASE_URL`, `LOG_LEVEL`). Do not commit secrets.
* **Migrations**: Ship migrations alongside deployments (e.g., run via `golang-migrate` or `psql`) before starting the API container.

### Docker secrets quickstart

The container expects two Docker secrets:

| Secret name                       | Environment variable | Description                                      |
| --------------------------------- | -------------------- | ------------------------------------------------ |
| `anthology_database_url`          | `DATABASE_URL_FILE`  | Full Postgres connection string                  |
| `anthology_api_token`             | `API_TOKEN_FILE`     | Bearer token required by the HTTP API            |

Create them once per Swarm and attach them to the stack/service:

```bash
printf 'postgres://user:pass@db:5432/anthology?sslmode=disable' | docker secret create anthology_database_url -
printf 'super-secret-token' | docker secret create anthology_api_token -

# example stack deployment (provide your own stack file)
docker stack deploy -c stack.yml anthology
```

Secrets are immutable. To change a value, remove and recreate it, then update the service:

```bash
docker secret rm anthology_database_url anthology_api_token
printf 'new-connection-string' | docker secret create anthology_database_url -
printf 'new-token' | docker secret create anthology_api_token -

docker service update --secret-rm anthology_database_url --secret-rm anthology_api_token \
  --secret-add source=anthology_database_url,target=anthology_database_url \
  --secret-add source=anthology_api_token,target=anthology_api_token \
  anthology_api
```

Alternatively, override `DATABASE_URL_FILE` / `API_TOKEN_FILE` or set `DATABASE_URL` / `API_TOKEN` directly when not running under Swarm (e.g., local `docker compose up`).

When provisioning Postgres outside of Compose, create the database/user first:

```sql
CREATE USER anthology WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE anthology OWNER anthology;
GRANT ALL PRIVILEGES ON DATABASE anthology TO anthology;
```

Use the resulting credentials in your `anthology_database_url` secret (e.g., `postgres://anthology:choose-a-strong-password@db:5432/anthology?sslmode=disable`).

## Further reading

* [Planning document](docs/planning/anthology.md) for the full multi-phase roadmap.
* [Go startup flow diagram](docs/architecture/go-startup.md) showing how config, repositories, services, and HTTP components initialize.
* [Angular Material reference](docs/architecture/material-design.md) for theming notes, component usage, and the formatting checklist before shipping UI changes.
* `internal/items/service_test.go` covers domain validation logic and in-memory repository behaviour.
* `web/src/app/pages/items/items-page.component.*` contains the main Angular page that ties the experience together.
