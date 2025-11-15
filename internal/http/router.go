package http

import (
	"net/http"
	"strings"
	"time"

	"log/slog"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"anthology/internal/catalog"
	"anthology/internal/config"
	"anthology/internal/items"
)

// NewRouter wires application routes and middleware using chi.
func NewRouter(cfg config.Config, svc *items.Service, catalogSvc *catalog.Service, logger *slog.Logger) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(newSlogMiddleware(logger))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":      "ok",
			"environment": cfg.Environment,
		})
	})

	sessionHandler := NewSessionHandler(cfg.APIToken, cfg.Environment)
	handler := NewItemHandler(svc, logger)
	catalogHandler := NewCatalogHandler(catalogSvc, logger)

	if strings.TrimSpace(cfg.APIToken) == "" {
		logger.Warn("API token authentication disabled; /api endpoints are unauthenticated")
	}

	r.Route("/api", func(r chi.Router) {
		r.Route("/session", func(r chi.Router) {
			r.Post("/", sessionHandler.Login)
			r.Get("/", sessionHandler.Status)
			r.Delete("/", sessionHandler.Logout)
		})

		r.Group(func(r chi.Router) {
			r.Use(newTokenAuthMiddleware(cfg.APIToken))
			r.Route("/items", func(r chi.Router) {
				r.Get("/", handler.List)
				r.Post("/", handler.Create)
				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", handler.Get)
					r.Put("/", handler.Update)
					r.Delete("/", handler.Delete)
				})
			})
			r.Route("/catalog", func(r chi.Router) {
				r.Get("/lookup", catalogHandler.Lookup)
			})
		})
	})

	r.NotFound(http.NotFoundHandler().ServeHTTP)

	return r
}
