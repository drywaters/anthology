import { Pipe, PipeTransform } from '@angular/core';

/**
 * Transforms cover image URLs to request smaller thumbnails.
 * Primarily targets Google Books API URLs which support zoom parameter.
 *
 * Usage: {{ item.coverImage | thumbnail }}
 */
@Pipe({
    name: 'thumbnail',
    standalone: true,
})
export class ThumbnailPipe implements PipeTransform {
    transform(url: string | undefined | null): string {
        if (!url) {
            return '';
        }

        const isGoogleBooksUrl =
            url.includes('books.google.com') ||
            url.includes('googleapis.com/books') ||
            url.includes('books.googleusercontent.com');

        // Avoid requesting undersized Google Books thumbnails that often return the "image not available" placeholder.
        // Clamp zoom to at least 1 and ensure a zoom parameter exists for consistent rendering.
        if (isGoogleBooksUrl) {
            try {
                const parsed = new URL(url);
                const zoomParam = parsed.searchParams.get('zoom');
                const zoomValue = zoomParam ? Number.parseInt(zoomParam, 10) : NaN;

                if (!zoomParam || Number.isNaN(zoomValue) || zoomValue < 1) {
                    parsed.searchParams.set('zoom', '1');
                    return parsed.toString();
                }
            } catch {
                // Fall back to string manipulation if URL parsing fails (e.g., malformed but still usable URLs)
                if (!url.includes('zoom=')) {
                    const separator = url.includes('?') ? '&' : '?';
                    return `${url}${separator}zoom=1`;
                }
                return url.replace('zoom=0', 'zoom=1');
            }
        }

        // Return unchanged for other URLs
        return url;
    }
}
