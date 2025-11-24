import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { environment } from '../config/environment';
import { ActiveBookStatus, BookStatus, Item, ItemForm, ItemType } from '../models/item';
import { CsvImportSummary } from '../models/import';

@Injectable({ providedIn: 'root' })
export class ItemService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiUrl}/items`;

    list(filters?: {
        itemType?: ItemType;
        letter?: string;
        status?: ActiveBookStatus;
        query?: string;
        limit?: number;
    }): Observable<Item[]> {
        let params = new HttpParams();
        if (filters?.itemType) {
            params = params.set('type', filters.itemType);
        }
        if (filters?.letter) {
            params = params.set('letter', filters.letter);
        }
        if (filters?.status) {
            params = params.set('status', filters.status);
        }
        if (filters?.query) {
            params = params.set('query', filters.query);
        }
        if (filters?.limit && filters.limit > 0) {
            params = params.set('limit', filters.limit.toString());
        }

        return this.http
            .get<{ items: Item[] }>(this.baseUrl, { params: params.keys().length ? params : undefined })
            .pipe(map((response) => response.items));
    }

    get(id: string): Observable<Item> {
        return this.http.get<Item>(`${this.baseUrl}/${id}`);
    }

    create(form: ItemForm): Observable<Item> {
        const payload = this.normalizeForm(form);
        return this.http.post<Item>(this.baseUrl, payload);
    }

    update(id: string, form: Partial<ItemForm>): Observable<Item> {
        const payload = this.normalizeForm(form);
        return this.http.put<Item>(`${this.baseUrl}/${id}`, payload);
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`);
    }

    importCsv(file: File): Observable<CsvImportSummary> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<CsvImportSummary>(`${this.baseUrl}/import`, formData);
    }

    private normalizeForm(form: Partial<ItemForm>): Record<string, unknown> {
        const payload: Record<string, unknown> = { ...form };
        if ('releaseYear' in payload) {
            const releaseYear = payload['releaseYear'];
            if (releaseYear === '' || releaseYear === null) {
                payload['releaseYear'] = null;
            } else if (typeof releaseYear === 'string') {
                payload['releaseYear'] = Number.parseInt(releaseYear, 10);
            }
        }

        if ('pageCount' in payload) {
            const pageCount = payload['pageCount'];
            if (pageCount === '' || pageCount === null) {
                payload['pageCount'] = null;
            } else if (typeof pageCount === 'string') {
                payload['pageCount'] = Number.parseInt(pageCount, 10);
            }
        }

        if ('currentPage' in payload) {
            const currentPage = payload['currentPage'];
            if (currentPage === '' || currentPage === null) {
                payload['currentPage'] = null;
            } else if (typeof currentPage === 'string') {
                payload['currentPage'] = Number.parseInt(currentPage, 10);
            }
        }

        if ('readAt' in payload) {
            const readAt = payload['readAt'];
            if (readAt === '' || readAt === null) {
                payload['readAt'] = null;
            } else if (readAt instanceof Date) {
                payload['readAt'] = Number.isNaN(readAt.getTime()) ? null : readAt.toISOString();
            } else if (typeof readAt === 'string') {
                const dateValue = new Date(readAt);
                payload['readAt'] = Number.isNaN(dateValue.getTime()) ? null : dateValue.toISOString();
            }
        }

        if ('readingStatus' in payload && payload['readingStatus'] === undefined) {
            delete payload['readingStatus'];
        }

        return payload;
    }
}
