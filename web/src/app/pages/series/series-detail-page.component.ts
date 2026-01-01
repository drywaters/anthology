import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { catchError, EMPTY, switchMap, tap } from 'rxjs';

import { Item, SeriesStatus, SeriesSummary, SERIES_STATUS_LABELS } from '../../models';
import { SeriesService } from '../../services/series.service';
import { NotificationService } from '../../services/notification.service';
import { ItemCardComponent } from '../items/item-card/item-card.component';

const STATUS_CLASS_MAP: Record<SeriesStatus, string> = {
    complete: 'status-complete',
    incomplete: 'status-incomplete',
    unknown: 'status-unknown',
};

@Component({
    selector: 'app-series-detail-page',
    standalone: true,
    imports: [
        NgClass,
        NgFor,
        NgIf,
        MatButtonModule,
        MatCardModule,
        MatChipsModule,
        MatIconModule,
        MatProgressBarModule,
        ItemCardComponent,
    ],
    templateUrl: './series-detail-page.component.html',
    styleUrl: './series-detail-page.component.scss',
})
export class SeriesDetailPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly seriesService = inject(SeriesService);
    private readonly notification = inject(NotificationService);
    private readonly destroyRef = inject(DestroyRef);

    readonly series = signal<SeriesSummary | null>(null);
    readonly loading = signal(true);

    ngOnInit(): void {
        this.route.queryParams
            .pipe(
                switchMap((params) => {
                    const name = params['name'];
                    if (!name) {
                        this.router.navigate(['/items']);
                        return EMPTY;
                    }
                    this.loading.set(true);
                    return this.seriesService.get(name).pipe(
                        tap((series) => {
                            this.series.set(series);
                            this.loading.set(false);
                        }),
                        catchError(() => {
                            this.notification.error('Unable to load series details.');
                            this.loading.set(false);
                            return EMPTY;
                        }),
                    );
                }),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    goBack(): void {
        this.router.navigate(['/items']);
    }

    editItem(item: Item): void {
        this.router.navigate(['/items', item.id, 'edit']);
    }

    addMissingVolume(volumeNumber: number): void {
        const seriesName = this.series()?.seriesName;
        if (!seriesName) return;

        this.router.navigate(['/items/add'], {
            queryParams: {
                prefill: 'series',
                seriesName,
                volumeNumber,
            },
        });
    }

    getStatusClass(status: SeriesStatus): string {
        return STATUS_CLASS_MAP[status];
    }

    getStatusLabel(status: SeriesStatus): string {
        return SERIES_STATUS_LABELS[status];
    }

    trackById(_: number, item: Item): string {
        return item.id;
    }

    trackByVolume(_: number, volume: number): number {
        return volume;
    }
}
