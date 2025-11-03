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

	"github.com/google/uuid"

	"anthology/internal/config"
	transporthttp "anthology/internal/http"
	"anthology/internal/items"
	"anthology/internal/platform/database"
	"anthology/internal/platform/logging"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	logger := logging.New(cfg.LogLevel)

	repo, cleanup, err := buildRepository(ctx, cfg, logger)
	if err != nil {
		logger.Error("failed to initialize repository", "error", err)
		os.Exit(1)
	}
	if cleanup != nil {
		defer cleanup()
	}

	svc := items.NewService(repo)
	router := transporthttp.NewRouter(cfg, svc, logger)

	srv := &http.Server{
		Addr:    cfg.HTTPAddress(),
		Handler: router,
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

func buildRepository(ctx context.Context, cfg config.Config, logger *slog.Logger) (items.Repository, func(), error) {
	if cfg.UseInMemoryStore() {
		logger.Info("using in-memory repository")
		return items.NewInMemoryRepository(seedLocalItems()), nil, nil
	}

	db, err := database.NewPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, nil, err
	}

	cleanup := func() {
		_ = db.Close()
	}
	logger.Info("connected to postgres")
	return items.NewPostgresRepository(db), cleanup, nil
}

func seedLocalItems() []items.Item {
	now := time.Now().UTC()
	year2013 := 2013
	year2016 := 2016

	return []items.Item{
		{
			ID:          uuid.New(),
			Title:       "The Night Circus",
			Creator:     "Erin Morgenstern",
			ItemType:    items.ItemTypeBook,
			ReleaseYear: &year2013,
			Notes:       "Dreamlike storytelling that anchors the curated fantasy shelf.",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          uuid.New(),
			Title:       "Stardew Valley",
			Creator:     "ConcernedApe",
			ItemType:    items.ItemTypeGame,
			ReleaseYear: &year2016,
			Notes:       "Cozy management vibes drawn from community-favourite collections.",
			CreatedAt:   now.Add(1 * time.Minute),
			UpdatedAt:   now.Add(1 * time.Minute),
		},
	}
}
