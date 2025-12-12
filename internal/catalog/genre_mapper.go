package catalog

import (
	"strings"
)

// Genre constants matching the items.Genre type values.
// These are defined here to avoid import cycles with the items package.
const (
	genreFiction           = "FICTION"
	genreNonFiction        = "NON_FICTION"
	genreScienceTech       = "SCIENCE_TECH"
	genreHistory           = "HISTORY"
	genreBiography         = "BIOGRAPHY"
	genreChildrens         = "CHILDRENS"
	genreArtsEntertainment = "ARTS_ENTERTAINMENT"
	genreReferenceOther    = "REFERENCE_OTHER"
)

// genreMapping defines keyword patterns mapped to normalized genres.
// Each entry contains keywords that indicate a specific genre.
type genreMapping struct {
	genre    string
	keywords []string
}

// genreMappings defines the genre mappings in priority order (highest to lowest).
// When multiple genres match, the first (highest priority) match wins.
// More specific genres come before broader categories.
var genreMappings = []genreMapping{
	// Priority 1: Most specific genres
	{
		genre:    genreBiography,
		keywords: []string{"biography", "autobiography", "memoir"},
	},
	// Priority 2: Children's (specific audience)
	{
		genre:    genreChildrens,
		keywords: []string{"juvenile", "children", "young adult", "ya "},
	},
	// Priority 3: History
	{
		genre:    genreHistory,
		keywords: []string{"history", "historical", "war", "military"},
	},
	// Priority 4: Science & Technology
	{
		genre:    genreScienceTech,
		keywords: []string{"science", "technology", "computers", "programming", "mathematics", "engineering", "medical"},
	},
	// Priority 5: Arts & Entertainment
	{
		genre:    genreArtsEntertainment,
		keywords: []string{"art", "music", "film", "photography", "cooking", "crafts", "games", "sports", "travel"},
	},
	// Priority 6: Fiction (broad category)
	{
		genre:    genreFiction,
		keywords: []string{"fiction", "novel", "literary", "romance", "mystery", "thriller", "fantasy", "science fiction", "horror"},
	},
	// Priority 7: Non-Fiction (broad category)
	{
		genre:    genreNonFiction,
		keywords: []string{"nonfiction", "non-fiction", "self-help", "business", "economics", "psychology", "philosophy"},
	},
	// Priority 8: Reference/Other (fallback)
	{
		genre:    genreReferenceOther,
		keywords: []string{"reference", "education", "study aids", "language", "religion"},
	},
}

// MapCategoriesToGenre converts Google Books categories to a single normalized genre string.
// It scans categories for keyword matches and returns the highest-priority genre found.
// If categories is empty or no match is found, returns an empty string so callers can
// distinguish "no data from Google" from an actual genre classification.
func MapCategoriesToGenre(categories []string) string {
	// Return empty string when Google provides no categories, so we don't
	// overwrite user-selected genres with a default fallback during resync
	if len(categories) == 0 {
		return ""
	}

	// Check each category against our mappings in priority order
	for _, mapping := range genreMappings {
		for _, category := range categories {
			lower := strings.ToLower(category)
			for _, keyword := range mapping.keywords {
				if strings.Contains(lower, keyword) {
					return mapping.genre
				}
			}
		}
	}

	// No match found.
	// Return empty string so callers can preserve existing genres during resync.
	return ""
}
