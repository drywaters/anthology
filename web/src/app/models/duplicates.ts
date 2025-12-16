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
