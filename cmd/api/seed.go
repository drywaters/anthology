package main

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"anthology/internal/items"
	"anthology/internal/shelves"
)

// seedLocalItems returns a collection of demo items for local development.
func seedLocalItems() []items.Item {
	now := time.Now().UTC()

	// Helper to create year pointers
	year := func(y int) *int { return &y }
	pages := func(p int) *int { return &p }

	return []items.Item{
		// Books (10 items)
		{
			ID:            uuid.New(),
			Title:         "The Night Circus",
			Creator:       "Erin Morgenstern",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2011),
			PageCount:     pages(464),
			ISBN13:        "9780385534796",
			ISBN10:        "0385534795",
			ReadingStatus: items.BookStatusWantToRead,
			Description:   "A phantasmagorical circus romance that rewards slow reading.",
			Notes:         "Dreamlike storytelling that anchors the curated fantasy shelf.",
			CreatedAt:     now,
			UpdatedAt:     now,
		},
		{
			ID:            uuid.New(),
			Title:         "Code Complete",
			Creator:       "Steve McConnell",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2004),
			PageCount:     pages(960),
			ISBN13:        "9780735619678",
			ReadingStatus: items.BookStatusRead,
			Description:   "A comprehensive guide to software construction.",
			CreatedAt:     now.Add(1 * time.Minute),
			UpdatedAt:     now.Add(1 * time.Minute),
		},
		{
			ID:            uuid.New(),
			Title:         "Docs for Developers",
			Creator:       "Jared Bhatti",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2021),
			PageCount:     pages(236),
			ISBN13:        "9781484272169",
			ReadingStatus: items.BookStatusReading,
			Description:   "An engineer's field guide to technical writing.",
			CreatedAt:     now.Add(2 * time.Minute),
			UpdatedAt:     now.Add(2 * time.Minute),
		},
		{
			ID:            uuid.New(),
			Title:         "Effective Rust",
			Creator:       "David Drysdale",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2024),
			PageCount:     pages(280),
			ISBN13:        "9781098151409",
			ReadingStatus: items.BookStatusWantToRead,
			Description:   "35 specific ways to improve your Rust code.",
			CreatedAt:     now.Add(3 * time.Minute),
			UpdatedAt:     now.Add(3 * time.Minute),
		},
		{
			ID:            uuid.New(),
			Title:         "Effective TypeScript",
			Creator:       "Dan Vanderkam",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2019),
			PageCount:     pages(264),
			ISBN13:        "9781492053743",
			ReadingStatus: items.BookStatusRead,
			Description:   "62 specific ways to improve your TypeScript.",
			CreatedAt:     now.Add(4 * time.Minute),
			UpdatedAt:     now.Add(4 * time.Minute),
		},
		{
			ID:            uuid.New(),
			Title:         "Eloquent JavaScript",
			Creator:       "Marijn Haverbeke",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2018),
			PageCount:     pages(472),
			ISBN13:        "9781593279509",
			ReadingStatus: items.BookStatusRead,
			Description:   "A modern introduction to programming.",
			CreatedAt:     now.Add(5 * time.Minute),
			UpdatedAt:     now.Add(5 * time.Minute),
		},
		{
			ID:            uuid.New(),
			Title:         "How Linux Works",
			Creator:       "Brian Ward",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2021),
			PageCount:     pages(464),
			ISBN13:        "9781718500402",
			ReadingStatus: items.BookStatusReading,
			Description:   "What every superuser should know.",
			CreatedAt:     now.Add(6 * time.Minute),
			UpdatedAt:     now.Add(6 * time.Minute),
		},
		{
			ID:            uuid.New(),
			Title:         "JavaScript for Web Developers",
			Creator:       "Matt Frisbie",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2023),
			PageCount:     pages(1200),
			ISBN13:        "9781394193219",
			ReadingStatus: items.BookStatusWantToRead,
			Description:   "Professional JavaScript for web development.",
			CreatedAt:     now.Add(7 * time.Minute),
			UpdatedAt:     now.Add(7 * time.Minute),
		},
		{
			ID:            uuid.New(),
			Title:         "Kubernetes in Action",
			Creator:       "Marko Luksa",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2023),
			PageCount:     pages(600),
			ISBN13:        "9781617297618",
			ReadingStatus: items.BookStatusReading,
			Description:   "Deep dive into Kubernetes concepts and applications.",
			CreatedAt:     now.Add(8 * time.Minute),
			UpdatedAt:     now.Add(8 * time.Minute),
		},
		{
			ID:            uuid.New(),
			Title:         "Learning SQL",
			Creator:       "Alan Beaulieu",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2020),
			PageCount:     pages(376),
			ISBN13:        "9781492057611",
			ReadingStatus: items.BookStatusRead,
			Description:   "Generate, manipulate, and retrieve data.",
			CreatedAt:     now.Add(9 * time.Minute),
			UpdatedAt:     now.Add(9 * time.Minute),
		},
		{
			ID:            uuid.New(),
			Title:         "Linux Cookbook",
			Creator:       "Carla Schroder",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2021),
			PageCount:     pages(578),
			ISBN13:        "9781492087168",
			ReadingStatus: items.BookStatusWantToRead,
			Description:   "Essential skills for Linux users and administrators.",
			CreatedAt:     now.Add(10 * time.Minute),
			UpdatedAt:     now.Add(10 * time.Minute),
		},
		{
			ID:            uuid.New(),
			Title:         "Security Engineering",
			Creator:       "Ross Anderson",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2020),
			PageCount:     pages(1232),
			ISBN13:        "9781119642787",
			ReadingStatus: items.BookStatusReading,
			Description:   "A guide to building dependable distributed systems.",
			CreatedAt:     now.Add(11 * time.Minute),
			UpdatedAt:     now.Add(11 * time.Minute),
		},
		{
			ID:            uuid.New(),
			Title:         "The Pragmatic Programmer",
			Creator:       "David Thomas & Andrew Hunt",
			ItemType:      items.ItemTypeBook,
			ReleaseYear:   year(2019),
			PageCount:     pages(352),
			ISBN13:        "9780135957059",
			ReadingStatus: items.BookStatusRead,
			Description:   "Your journey to mastery, 20th anniversary edition.",
			CreatedAt:     now.Add(12 * time.Minute),
			UpdatedAt:     now.Add(12 * time.Minute),
		},

		// Games (4 items)
		{
			ID:          uuid.New(),
			Title:       "Stardew Valley",
			Creator:     "ConcernedApe",
			ItemType:    items.ItemTypeGame,
			ReleaseYear: year(2016),
			Notes:       "Cozy management vibes drawn from community-favourite collections.",
			CreatedAt:   now.Add(13 * time.Minute),
			UpdatedAt:   now.Add(13 * time.Minute),
		},
		{
			ID:          uuid.New(),
			Title:       "Hollow Knight",
			Creator:     "Team Cherry",
			ItemType:    items.ItemTypeGame,
			ReleaseYear: year(2017),
			Notes:       "Atmospheric metroidvania with challenging combat.",
			CreatedAt:   now.Add(14 * time.Minute),
			UpdatedAt:   now.Add(14 * time.Minute),
		},
		{
			ID:          uuid.New(),
			Title:       "Hades",
			Creator:     "Supergiant Games",
			ItemType:    items.ItemTypeGame,
			ReleaseYear: year(2020),
			Notes:       "Rogue-like with incredible narrative integration.",
			CreatedAt:   now.Add(15 * time.Minute),
			UpdatedAt:   now.Add(15 * time.Minute),
		},
		{
			ID:          uuid.New(),
			Title:       "Celeste",
			Creator:     "Maddy Makes Games",
			ItemType:    items.ItemTypeGame,
			ReleaseYear: year(2018),
			Notes:       "Precision platformer with a heartfelt story.",
			CreatedAt:   now.Add(16 * time.Minute),
			UpdatedAt:   now.Add(16 * time.Minute),
		},

		// Movies (4 items)
		{
			ID:          uuid.New(),
			Title:       "Arrival",
			Creator:     "Denis Villeneuve",
			ItemType:    items.ItemTypeMovie,
			ReleaseYear: year(2016),
			Notes:       "Moody first-contact film that balances cerebral sci-fi with lush visuals.",
			CreatedAt:   now.Add(17 * time.Minute),
			UpdatedAt:   now.Add(17 * time.Minute),
		},
		{
			ID:          uuid.New(),
			Title:       "Blade Runner 2049",
			Creator:     "Denis Villeneuve",
			ItemType:    items.ItemTypeMovie,
			ReleaseYear: year(2017),
			Notes:       "Stunning sequel that expands the Blade Runner universe.",
			CreatedAt:   now.Add(18 * time.Minute),
			UpdatedAt:   now.Add(18 * time.Minute),
		},
		{
			ID:          uuid.New(),
			Title:       "Everything Everywhere All at Once",
			Creator:     "Daniel Kwan & Daniel Scheinert",
			ItemType:    items.ItemTypeMovie,
			ReleaseYear: year(2022),
			Notes:       "Multiverse mayhem with surprising emotional depth.",
			CreatedAt:   now.Add(19 * time.Minute),
			UpdatedAt:   now.Add(19 * time.Minute),
		},
		{
			ID:          uuid.New(),
			Title:       "Spider-Man: Into the Spider-Verse",
			Creator:     "Bob Persichetti & Peter Ramsey",
			ItemType:    items.ItemTypeMovie,
			ReleaseYear: year(2018),
			Notes:       "Revolutionary animation meets heartfelt storytelling.",
			CreatedAt:   now.Add(20 * time.Minute),
			UpdatedAt:   now.Add(20 * time.Minute),
		},

		// Music (3 items)
		{
			ID:          uuid.New(),
			Title:       "How Big, How Blue, How Beautiful",
			Creator:     "Florence + The Machine",
			ItemType:    items.ItemTypeMusic,
			ReleaseYear: year(2015),
			Notes:       "Anthemic art-pop anchor that rounds out the music shelf.",
			CreatedAt:   now.Add(21 * time.Minute),
			UpdatedAt:   now.Add(21 * time.Minute),
		},
		{
			ID:          uuid.New(),
			Title:       "Random Access Memories",
			Creator:     "Daft Punk",
			ItemType:    items.ItemTypeMusic,
			ReleaseYear: year(2013),
			Notes:       "Disco-influenced electronic masterpiece.",
			CreatedAt:   now.Add(22 * time.Minute),
			UpdatedAt:   now.Add(22 * time.Minute),
		},
		{
			ID:          uuid.New(),
			Title:       "In Rainbows",
			Creator:     "Radiohead",
			ItemType:    items.ItemTypeMusic,
			ReleaseYear: year(2007),
			Notes:       "Warm, intimate, and sonically adventurous.",
			CreatedAt:   now.Add(23 * time.Minute),
			UpdatedAt:   now.Add(23 * time.Minute),
		},
	}
}

// seedShelves creates demo shelves with layouts and item placements.
func seedShelves(ctx context.Context, repo shelves.Repository, demoItems []items.Item) map[uuid.UUID]items.ShelfPlacement {
	placements := make(map[uuid.UUID]items.ShelfPlacement)

	// Build item lookup by title
	itemLookup := make(map[string]uuid.UUID, len(demoItems))
	for _, item := range demoItems {
		itemLookup[item.Title] = item.ID
	}

	// Shelf 1: Living Room - Feature Shelf (original)
	shelf1Placements := seedLivingRoomShelf(ctx, repo, itemLookup)
	for k, v := range shelf1Placements {
		placements[k] = v
	}

	// Shelf 2: Office - Tech Books (densely packed to demonstrate compact UI)
	shelf2Placements := seedOfficeTechShelf(ctx, repo, itemLookup)
	for k, v := range shelf2Placements {
		placements[k] = v
	}

	return placements
}

func seedLivingRoomShelf(ctx context.Context, repo shelves.Repository, itemLookup map[string]uuid.UUID) map[uuid.UUID]items.ShelfPlacement {
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

	for _, a := range assignments {
		itemID, ok := itemLookup[a.title]
		if !ok {
			continue
		}
		slotID, ok := slotLookup[fmt.Sprintf("%d-%d", a.rowIndex, a.colIndex)]
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
			RowIndex:  a.rowIndex,
			ColIndex:  a.colIndex,
		}
	}

	return placements
}

func seedOfficeTechShelf(ctx context.Context, repo shelves.Repository, itemLookup map[string]uuid.UUID) map[uuid.UUID]items.ShelfPlacement {
	now := time.Now().UTC()
	shelf := shelves.Shelf{
		ID:          uuid.New(),
		Name:        "Office - Tech Books",
		Description: "Programming and technology reference shelf",
		PhotoURL:    "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=80",
		CreatedAt:   now.Add(1 * time.Hour),
		UpdatedAt:   now.Add(1 * time.Hour),
	}

	// Single row shelf with one large slot for many books
	rowID := uuid.New()
	rows := []shelves.ShelfRow{
		{ID: rowID, ShelfID: shelf.ID, RowIndex: 0, YStartNorm: 0.05, YEndNorm: 0.95},
	}

	cols := []shelves.ShelfColumn{
		{ID: uuid.New(), ShelfRowID: rowID, ColIndex: 0, XStartNorm: 0.02, XEndNorm: 0.98},
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

	placements := make(map[uuid.UUID]items.ShelfPlacement)

	// Assign many books to the single slot to demonstrate the compact UI
	techBooks := []string{
		"Code Complete",
		"Docs for Developers",
		"Effective Rust",
		"Effective TypeScript",
		"Eloquent JavaScript",
		"How Linux Works",
		"JavaScript for Web Developers",
		"Kubernetes in Action",
		"Learning SQL",
		"Linux Cookbook",
		"Security Engineering",
		"The Pragmatic Programmer",
	}

	slotID, ok := slotLookup["0-0"]
	if !ok {
		return placements
	}

	for _, title := range techBooks {
		itemID, ok := itemLookup[title]
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
			RowIndex:  0,
			ColIndex:  0,
		}
	}

	return placements
}
