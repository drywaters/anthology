# Anthology future features

This document outlines potential features and enhancements for the Anthology application to expand its capabilities and improve user experience.

## Expanded metadata & automation
- **Multi-domain metadata providers:** Integrate additional APIs like IGDB (Games), TMDB/OMDB (Movies), and MusicBrainz/Discogs (Music) to automate metadata population for non-book items.
- **Mobile camera barcode scanner:** Enable native camera-based barcode scanning in the UI (via PWA capabilities) to streamline cataloging physical media.

## Collection management & organization
- **Lending tracker:** Track loaned items, including borrowers and due dates, to manage physical media distribution.
- **Series & collections:** Group items into sets (e.g., book series, movie trilogies) to maintain logical relationships beyond alphabetical sorting.
- **Flexible tagging system:** Implement user-defined tags (e.g., #signed, #gift, #first-edition) for custom organization and filtering.

## Insights & gamification
- **Consumption statistics:** Dashboard for tracking annual progress, such as pages read, games completed, or genre distributions.
- **Goals & streaks:** Allow users to set and track personal consumption goals (e.g., "Read 20 books this year").

## User experience
- **"Next Up" queue:** Dedicated list for items the user intends to consume next, separate from the general "Unread" status.
- **Rich reviews:** Expand rating and notes into a full review system with support for long-form text and spoiler tags.

## Data portability
- **Export to CSV/JSON:** Allow users to export their entire catalog for backups, personal analysis, or migration to other tools.
- **Shareable lists:** Generate read-only public links for specific shelves or curated lists to share with others.

## Multi-user support
- **User registration & authentication:** Transition from a single shared token to individual user accounts with secure password hashing or OAuth (e.g., Google, GitHub) integration.
- **Data multi-tenancy:** Update the database schema and API logic to isolate items, shelves, and history by `user_id`, ensuring users only access their own data.
- **Shared libraries:** Implement permission-based sharing, allowing users to grant read or write access to specific shelves or their entire catalog to other users.
- **Personalized preferences:** Store per-user settings such as default catalog views (list vs. grid), preferred metadata providers, and UI themes.
