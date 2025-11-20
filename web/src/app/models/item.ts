export type ItemType = 'book' | 'game' | 'movie' | 'music';

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
    notes: string;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
    book: 'Book',
    game: 'Game',
    movie: 'Movie',
    music: 'Music',
};
