import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { environment } from '../config/environment';
import { ItemForm } from '../models/item';

export type ItemLookupCategory = 'book' | 'game' | 'movie' | 'music';

@Injectable({ providedIn: 'root' })
export class ItemLookupService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiUrl}/catalog/lookup`;

    lookup(query: string, category: ItemLookupCategory): Observable<Partial<ItemForm>[]> {
        const params = new HttpParams().set('query', query).set('category', category);

        return this.http
            .get<{ items: Partial<ItemForm>[] | null }>(this.baseUrl, { params })
            .pipe(map((response) => response.items ?? []));
    }
}
