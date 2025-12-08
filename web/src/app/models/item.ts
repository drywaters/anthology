export const ItemTypes = {
    Book: 'book',
    Game: 'game',
    Movie: 'movie',
    Music: 'music',
} as const;

export type ItemType = (typeof ItemTypes)[keyof typeof ItemTypes];

export const BookStatus = {
    None: 'none',
    Read: 'read',
    Reading: 'reading',
    WantToRead: 'want_to_read',
} as const;

export type BookStatus = (typeof BookStatus)[keyof typeof BookStatus];
export const BookStatusFilters = {
    All: 'all',
    None: BookStatus.None,
    WantToRead: BookStatus.WantToRead,
    Reading: BookStatus.Reading,
    Read: BookStatus.Read,
} as const;

export type BookStatusFilter = (typeof BookStatusFilters)[keyof typeof BookStatusFilters];

export const ShelfStatusFilters = {
    All: 'all',
    On: 'on',
    Off: 'off',
} as const;

export type ShelfStatusFilter = (typeof ShelfStatusFilters)[keyof typeof ShelfStatusFilters];

export const SHELF_STATUS_LABELS: Record<ShelfStatusFilter, string> = {
    [ShelfStatusFilters.All]: 'All',
    [ShelfStatusFilters.On]: 'On shelf',
    [ShelfStatusFilters.Off]: 'Not on shelf',
};

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
    platform?: string;
    ageGroup?: string;
    playerCount?: string;
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
    platform?: string;
    ageGroup?: string;
    playerCount?: string;
    readingStatus?: BookStatus;
    readAt?: string | Date | null;
    notes: string;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
    [ItemTypes.Book]: 'Book',
    [ItemTypes.Game]: 'Game',
    [ItemTypes.Movie]: 'Movie',
    [ItemTypes.Music]: 'Music',
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
