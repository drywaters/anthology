package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"log/slog"

	"github.com/google/uuid"

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
	shelfSvc := shelves.NewService(shelfRepo, itemRepo)
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

func seedLocalItems() []items.Item {
	now := time.Now().UTC()
	year2013 := 2013
	year2015 := 2015
	year2016 := 2016
	pageCount := 464

	return []items.Item{
		{
			ID:            uuid.New(),
			Title:         "The Night Circus",
			Creator:       "Erin Morgenstern",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   &year2013,
			PageCount:     &pageCount,
			ISBN13:        "9780385534796",
			ISBN10:        "0385534795",
			ReadingStatus: items.BookStatusWantToRead,
			Description:   "A phantasmagorical circus romance that rewards slow reading.",
			Notes:         "Dreamlike storytelling that anchors the curated fantasy shelf.",
			CreatedAt:     now,
			UpdatedAt:     now,
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
		{
			ID:          uuid.New(),
			Title:       "Arrival",
			Creator:     "Denis Villeneuve",
			ItemType:    items.ItemTypeMovie,
			ReleaseYear: &year2016,
			Notes:       "Moody first-contact film that balances cerebral sci-fi with lush visuals.",
			CreatedAt:   now.Add(2 * time.Minute),
			UpdatedAt:   now.Add(2 * time.Minute),
		},
		{
			ID:          uuid.New(),
			Title:       "How Big, How Blue, How Beautiful",
			Creator:     "Florence + The Machine",
			ItemType:    items.ItemTypeMusic,
			ReleaseYear: &year2015,
			Notes:       "Anthemic art-pop anchor that rounds out the music shelf.",
			CreatedAt:   now.Add(3 * time.Minute),
			UpdatedAt:   now.Add(3 * time.Minute),
		},
	}
}

func seedShelves(ctx context.Context, repo shelves.Repository, demoItems []items.Item) map[uuid.UUID]items.ShelfPlacement {
	now := time.Now().UTC()
	shelf := shelves.Shelf{
		ID:          uuid.New(),
		Name:        "Living Room - Feature Shelf",
		Description: "Sample shelf seeded for local demos",
		PhotoURL:    "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&q=80",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	topRowID := uuid.New()
	bottomRowID := uuid.New()
	rows := []shelves.ShelfRow{
		{ID: topRowID, ShelfID: shelf.ID, RowIndex: 0, YStartNorm: 0.0, YEndNorm: 0.48},
		{ID: bottomRowID, ShelfID: shelf.ID, RowIndex: 1, YStartNorm: 0.52, YEndNorm: 1.0},
	}

	cols := []shelves.ShelfColumn{
		{ID: uuid.New(), ShelfRowID: topRowID, ColIndex: 0, XStartNorm: 0.0, XEndNorm: 0.33},
		{ID: uuid.New(), ShelfRowID: topRowID, ColIndex: 1, XStartNorm: 0.33, XEndNorm: 0.66},
		{ID: uuid.New(), ShelfRowID: topRowID, ColIndex: 2, XStartNorm: 0.66, XEndNorm: 1.0},
		{ID: uuid.New(), ShelfRowID: bottomRowID, ColIndex: 0, XStartNorm: 0.0, XEndNorm: 0.5},
		{ID: uuid.New(), ShelfRowID: bottomRowID, ColIndex: 1, XStartNorm: 0.5, XEndNorm: 1.0},
	}

	var slots []shelves.ShelfSlot
	for _, row := range rows {
		for _, col := range cols {
			if col.ShelfRowID != row.ID {
				continue
			}
			slots = append(slots, shelves.ShelfSlot{
				ID:            uuid.New(),
				ShelfID:       shelf.ID,
				ShelfRowID:    row.ID,
				ShelfColumnID: col.ID,
				RowIndex:      row.RowIndex,
				ColIndex:      col.ColIndex,
				XStartNorm:    col.XStartNorm,
				XEndNorm:      col.XEndNorm,
				YStartNorm:    row.YStartNorm,
				YEndNorm:      row.YEndNorm,
			})
		}
	}

	layout, err := repo.CreateShelf(ctx, shelf, rows, cols, slots)
	if err != nil {
		return map[uuid.UUID]items.ShelfPlacement{}
	}

	slotLookup := make(map[string]uuid.UUID, len(layout.Slots))
	for _, slot := range layout.Slots {
		key := fmt.Sprintf("%d-%d", slot.RowIndex, slot.ColIndex)
		slotLookup[key] = slot.ID
	}

	itemLookup := make(map[string]uuid.UUID, len(demoItems))
	for _, item := range demoItems {
		itemLookup[item.Title] = item.ID
	}

	placements := make(map[uuid.UUID]items.ShelfPlacement)
	assignments := []struct {
		title    string
		rowIndex int
		colIndex int
	}{
		{"The Night Circus", 0, 0},
		{"Stardew Valley", 0, 1},
		{"Arrival", 1, 0},
	}

	for _, placement := range assignments {
		itemID, ok := itemLookup[placement.title]
		if !ok {
			continue
		}
		slotID, ok := slotLookup[fmt.Sprintf("%d-%d", placement.rowIndex, placement.colIndex)]
		if !ok {
			continue
		}
		if _, err := repo.AssignItemToSlot(ctx, shelf.ID, slotID, itemID); err != nil {
			continue
		}
		placements[itemID] = items.ShelfPlacement{
			ShelfID:   shelf.ID,
			ShelfName: shelf.Name,
			SlotID:    slotID,
			RowIndex:  placement.rowIndex,
			ColIndex:  placement.colIndex,
		}
	}

	return placements
}
