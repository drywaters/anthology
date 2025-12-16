export const ItemTypes = {
    Book: 'book',
    Game: 'game',
    Movie: 'movie',
    Music: 'music',
} as const;

export type ItemType = (typeof ItemTypes)[keyof typeof ItemTypes];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
    [ItemTypes.Book]: 'Book',
    [ItemTypes.Game]: 'Game',
    [ItemTypes.Movie]: 'Movie',
    [ItemTypes.Music]: 'Music',
};
