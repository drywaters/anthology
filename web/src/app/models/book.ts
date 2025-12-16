export const BookStatus = {
    None: 'none',
    Read: 'read',
    Reading: 'reading',
    WantToRead: 'want_to_read',
} as const;

export type BookStatus = (typeof BookStatus)[keyof typeof BookStatus];

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
    [BookStatus.None]: 'No status',
    [BookStatus.Read]: 'Read',
    [BookStatus.Reading]: 'Reading',
    [BookStatus.WantToRead]: 'Up Next',
};

export const Formats = {
    Unknown: 'UNKNOWN',
    Hardcover: 'HARDCOVER',
    Paperback: 'PAPERBACK',
    Softcover: 'SOFTCOVER',
    Ebook: 'EBOOK',
    Magazine: 'MAGAZINE',
} as const;

export type Format = (typeof Formats)[keyof typeof Formats];

export const FORMAT_LABELS: Record<Format, string> = {
    [Formats.Unknown]: 'Unknown',
    [Formats.Hardcover]: 'Hardcover',
    [Formats.Paperback]: 'Paperback',
    [Formats.Softcover]: 'Softcover',
    [Formats.Ebook]: 'E-Book',
    [Formats.Magazine]: 'Magazine',
};

export const Genres = {
    Fiction: 'FICTION',
    NonFiction: 'NON_FICTION',
    ScienceTech: 'SCIENCE_TECH',
    History: 'HISTORY',
    Biography: 'BIOGRAPHY',
    Childrens: 'CHILDRENS',
    ArtsEntertainment: 'ARTS_ENTERTAINMENT',
    ReferenceOther: 'REFERENCE_OTHER',
} as const;

export type Genre = (typeof Genres)[keyof typeof Genres];

export const GENRE_LABELS: Record<Genre, string> = {
    [Genres.Fiction]: 'Fiction',
    [Genres.NonFiction]: 'Non-Fiction',
    [Genres.ScienceTech]: 'Science & Technology',
    [Genres.History]: 'History',
    [Genres.Biography]: 'Biography & Memoir',
    [Genres.Childrens]: "Children's & Young Adult",
    [Genres.ArtsEntertainment]: 'Arts & Entertainment',
    [Genres.ReferenceOther]: 'Reference & Other',
};
