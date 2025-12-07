export type ItemType = 'book' | 'game' | 'movie' | 'music';

export const BookStatus = {
    None: 'none',
    Read: 'read',
    Reading: 'reading',
    WantToRead: 'want_to_read',
} as const;

export type BookStatus = (typeof BookStatus)[keyof typeof BookStatus];
export type LetterHistogram = Record<string, number>;

export interface Item {
    id: string;
    title: string;
    creator: string;
    itemType: ItemType;
    releaseYear?: number;
    pageCount?: number | null;
    currentPage?: number | null;
    isbn13?: string;
    isbn10?: string;
    description?: string;
    coverImage?: string;
    readingStatus?: BookStatus;
    readAt?: string | null;
    notes: string;
    createdAt: string;
    updatedAt: string;
    shelfPlacement?: ShelfPlacementSummary;
}

export interface ItemForm {
    title: string;
    creator: string;
    itemType: ItemType;
    releaseYear?: number | null;
    pageCount?: number | null;
    currentPage?: number | null;
    isbn13?: string;
    isbn10?: string;
    description: string;
    coverImage?: string;
    readingStatus?: BookStatus;
    readAt?: string | Date | null;
    notes: string;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
    book: 'Book',
    game: 'Game',
    movie: 'Movie',
    music: 'Music',
};

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
    [BookStatus.None]: 'No status',
    [BookStatus.Read]: 'Read',
    [BookStatus.Reading]: 'Reading',
    [BookStatus.WantToRead]: 'Up Next',
};

export interface ShelfPlacementSummary {
    shelfId: string;
    shelfName: string;
    slotId: string;
    rowIndex: number;
    colIndex: number;
}

export interface DuplicateMatch {
    id: string;
    title: string;
    primaryIdentifier: string;
    identifierType: string;
    coverUrl?: string;
    location?: string;
    updatedAt: string;
}

export interface DuplicateCheckInput {
    title?: string;
    isbn13?: string;
    isbn10?: string;
}
