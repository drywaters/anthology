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

        // Handle Google Books API URLs
        // These URLs contain zoom=1 for standard size, zoom=0 for smaller thumbnails (~80px width)
        if (url.includes('books.google.com') || url.includes('googleapis.com/books')) {
            // Replace zoom=1 with zoom=0 for smaller thumbnails
            if (url.includes('zoom=1')) {
                return url.replace('zoom=1', 'zoom=0');
            }
            // If no zoom parameter, add zoom=0
            if (!url.includes('zoom=')) {
                const separator = url.includes('?') ? '&' : '?';
                return `${url}${separator}zoom=0`;
            }
        }

        // Return unchanged for other URLs
        return url;
    }
}
