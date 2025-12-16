import { ThumbnailPipe } from './thumbnail.pipe';

describe('ThumbnailPipe', () => {
    let pipe: ThumbnailPipe;

    beforeEach(() => {
        pipe = new ThumbnailPipe();
    });

    it('should create', () => {
        expect(pipe).toBeTruthy();
    });

    it('should return empty string for null', () => {
        expect(pipe.transform(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
        expect(pipe.transform(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
        expect(pipe.transform('')).toBe('');
    });

    it('should leave zoom=1 for Google Books URLs', () => {
        const url =
            'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1';
        const result = pipe.transform(url);
        expect(result).toBe(url);
    });

    it('should clamp zoom=0 to zoom=1 for Google Books URLs', () => {
        const url =
            'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=0';
        const result = pipe.transform(url);
        expect(result).toBe(
            'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1',
        );
    });

    it('should add zoom=1 for Google Books URLs without zoom parameter', () => {
        const url = 'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1';
        const result = pipe.transform(url);
        expect(result).toBe(
            'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1',
        );
    });

    it('should handle googleapis.com/books URLs', () => {
        const url = 'https://www.googleapis.com/books/v1/volumes/abc?zoom=0';
        const result = pipe.transform(url);
        expect(result).toBe('https://www.googleapis.com/books/v1/volumes/abc?zoom=1');
    });

    it('should handle googleusercontent URLs', () => {
        const url =
            'https://books.googleusercontent.com/books/content?id=abc&printsec=frontcover&img=1';
        const result = pipe.transform(url);
        expect(result).toBe(
            'https://books.googleusercontent.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1',
        );
    });

    it('should not modify non-Google Books URLs', () => {
        const url = 'https://example.com/image.jpg';
        const result = pipe.transform(url);
        expect(result).toBe(url);
    });
});
