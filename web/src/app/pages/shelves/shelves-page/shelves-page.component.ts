import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';

import { ShelfService } from '../../../services/shelf.service';
import { ShelfSummary } from '../../../models/shelf';

@Component({
    selector: 'app-shelves-page',
    standalone: true,
    imports: [
        NgFor,
        NgIf,
        MatCardModule,
        MatIconModule,
        MatProgressBarModule,
        MatSnackBarModule,
        RouterModule,
        MatButtonModule,
    ],
    templateUrl: './shelves-page.component.html',
    styleUrl: './shelves-page.component.scss',
})
export class ShelvesPageComponent {
    private readonly shelfService = inject(ShelfService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    readonly loading = signal(false);
    readonly shelves = signal<ShelfSummary[]>([]);
    readonly hasShelves = computed(() => this.shelves().length > 0);

    constructor() {
        this.loadShelves();
    }

    loadShelves(): void {
        this.loading.set(true);
        this.shelfService
            .list()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (shelves) => {
                    this.shelves.set(shelves);
                    this.loading.set(false);
                },
                error: () => {
                    this.loading.set(false);
                    this.snackBar.open('Unable to load shelves right now.', 'Dismiss', {
                        duration: 4000,
                    });
                },
            });
    }

    trackByShelf(_: number, shelf: ShelfSummary): string {
        return shelf.shelf.id;
    }
}
