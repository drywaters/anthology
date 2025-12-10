import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { environment } from '../config/environment';
import { LayoutSlotInput, LayoutUpdateResponse, ScanAndAssignResult, ShelfSummary, ShelfWithLayout } from '../models/shelf';

@Injectable({ providedIn: 'root' })
export class ShelfService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiUrl}/shelves`;

    list(): Observable<ShelfSummary[]> {
        return this.http.get<{ shelves: ShelfSummary[] }>(this.baseUrl).pipe(map((res) => res.shelves));
    }

    create(payload: { name: string; description?: string; photoUrl: string }): Observable<ShelfWithLayout> {
        return this.http.post<ShelfWithLayout>(this.baseUrl, payload);
    }

    get(id: string): Observable<ShelfWithLayout> {
        return this.http.get<ShelfWithLayout>(`${this.baseUrl}/${id}`);
    }

    updateLayout(id: string, slots: LayoutSlotInput[]): Observable<LayoutUpdateResponse> {
        return this.http.put<LayoutUpdateResponse>(`${this.baseUrl}/${id}/layout`, { slots });
    }

    assignItem(shelfId: string, slotId: string, itemId: string): Observable<ShelfWithLayout> {
        return this.http.post<ShelfWithLayout>(`${this.baseUrl}/${shelfId}/slots/${slotId}/items`, { itemId });
    }

    removeItem(shelfId: string, slotId: string, itemId: string): Observable<ShelfWithLayout> {
        return this.http.delete<ShelfWithLayout>(`${this.baseUrl}/${shelfId}/slots/${slotId}/items/${itemId}`);
    }

    scanAndAssign(shelfId: string, slotId: string, isbn: string): Observable<ScanAndAssignResult> {
        return this.http.post<ScanAndAssignResult>(`${this.baseUrl}/${shelfId}/slots/${slotId}/scan`, { isbn });
    }
}
