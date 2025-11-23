import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ShelfService } from '../../services/shelf.service';
import { ShelfSummary } from '../../models/shelf';

@Component({
    selector: 'app-shelves-page',
    standalone: true,
    imports: [
        NgFor,
        NgIf,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSnackBarModule,
        RouterModule,
    ],
    templateUrl: './shelves-page.component.html',
    styleUrl: './shelves-page.component.scss',
})
export class ShelvesPageComponent {
    private readonly shelfService = inject(ShelfService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly router = inject(Router);
    private readonly fb = inject(FormBuilder);
    private readonly destroyRef = inject(DestroyRef);

    readonly loading = signal(false);
    readonly creating = signal(false);
    readonly shelves = signal<ShelfSummary[]>([]);
    readonly hasShelves = computed(() => this.shelves().length > 0);

    readonly createForm = this.fb.group({
        name: ['', [Validators.required]],
        photoUrl: ['', [Validators.required]],
        description: [''],
    });

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
                    this.snackBar.open('Unable to load shelves right now.', 'Dismiss', { duration: 4000 });
                },
            });
    }

    createShelf(): void {
        if (this.createForm.invalid) {
            this.createForm.markAllAsTouched();
            return;
        }
        this.creating.set(true);
        const payload = this.createForm.value as { name: string; photoUrl: string; description?: string };
        this.shelfService
            .create(payload)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (shelf) => {
                    this.creating.set(false);
                    this.snackBar.open('Shelf created', undefined, { duration: 2000 });
                    this.router.navigate(['/shelves', shelf.shelf.id]);
                },
                error: () => {
                    this.creating.set(false);
                    this.snackBar.open('Could not create shelf', 'Dismiss', { duration: 4000 });
                },
            });
    }

    trackByShelf(_: number, shelf: ShelfSummary): string {
        return shelf.shelf.id;
    }
}
