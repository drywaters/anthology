# Go Startup Flow (Mermaid)

```mermaid
flowchart TD
  A["cmd/api/main.go"] --> B["config.Load()"]:::config
  B --> C["logging.New()"]:::infra
  C --> D{"buildRepository()"}:::infra
  D -->|DATA_STORE=memory| E["items & shelves InMemoryRepository"]:::domain
  D -->|DATA_STORE=postgres| F["database.NewPostgres()"]:::infra
  F --> G["migrate.Apply()"]:::infra
  G --> H["items & shelves PostgresRepository"]:::domain
  E --> I["Services: items, shelves, catalog"]:::domain
  H --> I
  I --> J["http.NewRouter"]:::transport
  J --> K["http.Server setup"]:::transport
  K --> L["go srv.ListenAndServe()"]:::transport
  K --> M["&lt;-ctx.Done() wait for signal"]:::infra
  M --> N["Graceful shutdown (srv.Shutdown)"]:::infra

  classDef config fill:#d4f1ff,stroke:#1f6aa5,color:#000;
  classDef infra fill:#f4f4f4,stroke:#555,color:#000;
  classDef domain fill:#fff0d6,stroke:#b36b00,color:#000;
  classDef transport fill:#e7ffe6,stroke:#2a8c41,color:#000;
```

## Diagram Notes

- `config.Load()` gathers environment-driven settings (ports, datastore selection, tokens, CORS).
- `logging.New()` builds the global `slog.Logger` instance used across packages.
- `buildRepository()` either seeds in-memory repos (local/demo) or initializes Postgres, runs migrations, and wires `items`/`shelves` repositories.
- Domain services (`items`, `shelves`, `catalog`) encapsulate validation and business logic; they are injected into HTTP handlers.
- `http.NewRouter` composes middleware, auth, session handlers, and API endpoints. Static assets moved to the standalone UI container, so non-API paths return standard 404 responses.
- The HTTP server runs `ListenAndServe` in a goroutine; the main goroutine blocks on the signal-aware context and then calls `srv.Shutdown` with a timeout to drain connections gracefully.
