import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { environment } from '../config/environment';
import { Item, ItemForm } from '../models/item';

@Injectable({ providedIn: 'root' })
export class ItemService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/items`;

  list(): Observable<Item[]> {
    return this.http.get<{ items: Item[] }>(this.baseUrl).pipe(map((response) => response.items));
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
    return payload;
  }
}
