import {
    BookStatus,
    BOOK_STATUS_LABELS,
    Item,
    ItemType,
    ItemTypes,
    ITEM_TYPE_LABELS,
} from '../../models';

export interface ReadingProgress {
    current: number;
    total?: number;
    percent?: number;
}

export function labelFor(item: Item): string {
    return ITEM_TYPE_LABELS[item.itemType];
}

export function readingStatusLabel(item: Item): string | null {
    if (
        item.itemType !== ItemTypes.Book ||
        !item.readingStatus ||
        item.readingStatus === BookStatus.None
    ) {
        return null;
    }

    return BOOK_STATUS_LABELS[item.readingStatus];
}

export function readingProgress(item: Item): ReadingProgress | null {
    if (item.itemType !== ItemTypes.Book || item.readingStatus !== BookStatus.Reading) {
        return null;
    }
    if (item.currentPage === null || item.currentPage === undefined) {
        return null;
    }

    const progress: ReadingProgress = {
        current: item.currentPage,
    };

    if (item.pageCount && item.pageCount > 0) {
        const clampedCurrent = Math.max(0, Math.min(item.currentPage, item.pageCount));
        progress.total = item.pageCount;
        progress.percent = Math.round((clampedCurrent / item.pageCount) * 100);
        progress.current = clampedCurrent;
    }

    return progress;
}

export function chipClassFor(itemType: ItemType): string {
    return `item-type-chip--${itemType}`;
}
