export type ItemType = 'book' | 'game' | 'movie' | 'music';
export type BookStatus = 'read' | 'reading' | 'want_to_read';

export interface Item {
    id: string;
    title: string;
    creator: string;
    itemType: ItemType;
    releaseYear?: number;
    pageCount?: number | null;
    isbn13?: string;
    isbn10?: string;
    description?: string;
    coverImage?: string;
    readingStatus?: BookStatus;
    readAt?: string | null;
    notes: string;
    createdAt: string;
    updatedAt: string;
}

export interface ItemForm {
    title: string;
    creator: string;
    itemType: ItemType;
    releaseYear?: number | null;
    pageCount?: number | null;
    isbn13?: string;
    isbn10?: string;
    description: string;
    coverImage?: string;
    readingStatus?: BookStatus;
    readAt?: string | null;
    notes: string;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
    book: 'Book',
    game: 'Game',
    movie: 'Movie',
    music: 'Music',
};

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
    read: 'Read',
    reading: 'Reading',
    want_to_read: 'Want to read',
};
