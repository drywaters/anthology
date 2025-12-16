import { BookStatus } from './book';

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
