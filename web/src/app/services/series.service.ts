import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../config/environment';
import { SeriesListResponse, SeriesSummary, SeriesStatus } from '../models/series';

export interface SeriesListOptions {
    includeItems?: boolean;
    status?: SeriesStatus;
}

@Injectable({ providedIn: 'root' })
export class SeriesService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiUrl}/series`;

    list(options?: SeriesListOptions): Observable<SeriesListResponse> {
        let params = new HttpParams();
        if (options?.includeItems) {
            params = params.set('include_items', 'true');
        }
        if (options?.status) {
            params = params.set('status', options.status);
        }

        return this.http.get<SeriesListResponse>(this.baseUrl, { params });
    }

    get(name: string): Observable<SeriesSummary> {
        const params = new HttpParams().set('name', name);
        return this.http.get<SeriesSummary>(`${this.baseUrl}/detail`, { params });
    }
}
