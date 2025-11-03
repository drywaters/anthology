package http

import (
	"net/http"
	"time"

	"log/slog"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"anthology/internal/config"
	"anthology/internal/items"
)

// NewRouter wires application routes and middleware using chi.
func NewRouter(cfg config.Config, svc *items.Service, logger *slog.Logger) http.Handler {
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

	handler := NewItemHandler(svc, logger)
	r.Route("/api", func(r chi.Router) {
		r.Route("/items", func(r chi.Router) {
			r.Get("/", handler.List)
			r.Post("/", handler.Create)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", handler.Get)
				r.Put("/", handler.Update)
				r.Delete("/", handler.Delete)
			})
		})
	})

	return r
}
