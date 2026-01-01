import { ItemType } from './item-types';
import { BookStatus, Format, Genre } from './book';

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
    format?: Format;
    genre?: Genre;
    rating?: number | null;
    retailPriceUsd?: number | null;
    googleVolumeId?: string;
    platform?: string;
    ageGroup?: string;
    playerCount?: string;
    readingStatus?: BookStatus;
    readAt?: string | null;
    notes: string;
    seriesName?: string;
    volumeNumber?: number | null;
    totalVolumes?: number | null;
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
    format?: Format;
    genre?: Genre;
    rating?: number | null;
    retailPriceUsd?: number | null;
    googleVolumeId?: string;
    platform?: string;
    ageGroup?: string;
    playerCount?: string;
    readingStatus?: BookStatus;
    readAt?: string | Date | null;
    notes: string;
    seriesName?: string;
    volumeNumber?: number | null;
    totalVolumes?: number | null;
}

export interface ShelfPlacementSummary {
    shelfId: string;
    shelfName: string;
    slotId: string;
    rowIndex: number;
    colIndex: number;
}
