package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"log/slog"

	"anthology/internal/catalog"
	"anthology/internal/config"
	transporthttp "anthology/internal/http"
	"anthology/internal/items"
	"anthology/internal/platform/database"
	"anthology/internal/platform/logging"
	"anthology/internal/platform/migrate"
	"anthology/internal/shelves"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	logger := logging.New(cfg.LogLevel)

	itemRepo, shelfRepo, cleanup, err := buildRepositories(ctx, cfg, logger)
	if err != nil {
		logger.Error("failed to initialize repository", "error", err)
		os.Exit(1)
	}
	if cleanup != nil {
		defer cleanup()
	}

	svc := items.NewService(itemRepo)
	lookupClient := &http.Client{Timeout: 12 * time.Second}
	catalogSvc := catalog.NewService(lookupClient, catalog.WithGoogleBooksAPIKey(cfg.GoogleBooksAPIKey))
	shelfSvc := shelves.NewService(shelfRepo, itemRepo, catalogSvc, svc)
	router := transporthttp.NewRouter(cfg, svc, catalogSvc, shelfSvc, logger)

	srv := &http.Server{
		Addr:              cfg.HTTPAddress(),
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    http.DefaultMaxHeaderBytes,
	}

	go func() {
		logger.Info("Anthology API listening", "addr", srv.Addr, "store", cfg.DataStore)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("http server error", "error", err)
		}
	}()

	<-ctx.Done()
	logger.Info("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
	}
}

func buildRepositories(ctx context.Context, cfg config.Config, logger *slog.Logger) (items.Repository, shelves.Repository, func(), error) {
	if cfg.UseInMemoryStore() {
		logger.Info("using in-memory repository")
		demoItems := seedLocalItems()
		shelfRepo := shelves.NewInMemoryRepository()
		placements := seedShelves(ctx, shelfRepo, demoItems)
		for i := range demoItems {
			if placement, ok := placements[demoItems[i].ID]; ok {
				placementCopy := placement
				demoItems[i].ShelfPlacement = &placementCopy
			}
		}
		itemRepo := items.NewInMemoryRepository(demoItems)
		return itemRepo, shelfRepo, nil, nil
	}

	db, err := database.NewPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, nil, nil, err
	}

	cleanup := func() {
		_ = db.Close()
	}

	if err := migrate.Apply(ctx, db, logger); err != nil {
		cleanup()
		return nil, nil, nil, err
	}

	logger.Info("connected to postgres")
	return items.NewPostgresRepository(db), shelves.NewPostgresRepository(db), cleanup, nil
}
