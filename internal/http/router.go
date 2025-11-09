package http

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
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
	if strings.TrimSpace(cfg.APIToken) == "" {
		logger.Warn("API token authentication disabled; /api endpoints are unauthenticated")
	}
	r.Route("/api", func(r chi.Router) {
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
	})

	spa := newSPAHandler(cfg.StaticDir, logger)
	r.NotFound(spa)

	return r
}

func newSPAHandler(root string, logger *slog.Logger) http.HandlerFunc {
	spaRoot := resolveSPARoot(root, logger)
	indexPath := filepath.Join(spaRoot, "index.html")

	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}

		cleaned := path.Clean(r.URL.Path)
		cleaned = strings.TrimPrefix(cleaned, "/")
		if cleaned == "" || cleaned == "." {
			cleaned = "index.html"
		}

		if strings.Contains(cleaned, "..") {
			http.NotFound(w, r)
			return
		}

		filePath := filepath.Join(spaRoot, cleaned)
		if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
			http.ServeFile(w, r, filePath)
			return
		} else if err != nil && !os.IsNotExist(err) {
			logger.Error("failed to serve static asset", "path", filePath, "error", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if _, err := os.Stat(indexPath); err != nil {
			logger.Error("frontend bundle missing", "path", indexPath, "error", err)
			http.Error(w, "frontend unavailable", http.StatusInternalServerError)
			return
		}

		http.ServeFile(w, r, indexPath)
	}
}

func resolveSPARoot(root string, logger *slog.Logger) string {
	if root == "" {
		root = "web/dist/web/browser"
	}
	info, err := os.Stat(root)
	if err == nil && info.IsDir() {
		if abs, absErr := filepath.Abs(root); absErr == nil {
			root = abs
		}
		logger.Info("serving frontend bundle", "root", root)
		return root
	}
	logger.Warn("frontend bundle directory not found", "path", root, "error", err)
	return root
}
