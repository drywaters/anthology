export type ItemType = 'book' | 'game' | 'movie' | 'music';

export interface Item {
  id: string;
  title: string;
  creator: string;
  itemType: ItemType;
  releaseYear?: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemForm {
  title: string;
  creator: string;
  itemType: ItemType;
  releaseYear?: number | null;
  notes: string;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  book: 'Book',
  game: 'Game',
  movie: 'Movie',
  music: 'Music',
};
