import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Item, ItemForm, ItemType, ITEM_TYPE_LABELS } from '../../models/item';
import { ItemService } from '../../services/item.service';
import { ItemFormComponent } from '../../components/item-form/item-form.component';

interface EditFormContext {
    item: Item;
}

type ItemTypeFilter = ItemType | 'all';
type LetterFilter = AlphabetLetter | 'ALL';

type AlphabetLetter =
    | 'A'
    | 'B'
    | 'C'
    | 'D'
    | 'E'
    | 'F'
    | 'G'
    | 'H'
    | 'I'
    | 'J'
    | 'K'
    | 'L'
    | 'M'
    | 'N'
    | 'O'
    | 'P'
    | 'Q'
    | 'R'
    | 'S'
    | 'T'
    | 'U'
    | 'V'
    | 'W'
    | 'X'
    | 'Y'
    | 'Z'
    | '#';

@Component({
    selector: 'app-items-page',
    standalone: true,
    imports: [
        DatePipe,
        NgFor,
        NgIf,
        ItemFormComponent,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        MatCardModule,
        MatChipsModule,
        MatIconModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatTableModule,
        RouterModule,
    ],
    templateUrl: './items-page.component.html',
    styleUrl: './items-page.component.scss',
})
export class ItemsPageComponent {
    private readonly itemService = inject(ItemService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);
    private readonly router = inject(Router);

    readonly displayedColumns = ['title', 'creator', 'itemType', 'releaseYear', 'updatedAt', 'actions'] as const;
    readonly items = signal<Item[]>([]);
    readonly loading = signal(false);
    readonly mutationInFlight = signal(false);
    readonly formContext = signal<EditFormContext | null>(null);
    readonly letterFilter = signal<LetterFilter>('ALL');
    readonly typeFilter = signal<ItemTypeFilter>('all');

    readonly typeLabels = ITEM_TYPE_LABELS;
    readonly typeOptions: Array<{ value: ItemTypeFilter; label: string }> = [
        { value: 'all', label: 'All items' },
        { value: 'book', label: ITEM_TYPE_LABELS.book },
        { value: 'game', label: ITEM_TYPE_LABELS.game },
        { value: 'movie', label: ITEM_TYPE_LABELS.movie },
        { value: 'music', label: ITEM_TYPE_LABELS.music },
    ];

    readonly alphabet: AlphabetLetter[] = [
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'G',
        'H',
        'I',
        'J',
        'K',
        'L',
        'M',
        'N',
        'O',
        'P',
        'Q',
        'R',
        'S',
        'T',
        'U',
        'V',
        'W',
        'X',
        'Y',
        'Z',
        '#',
    ];

    readonly hasFilteredItems = computed(() => this.items().length > 0);
    readonly isUnfiltered = computed(
        () => this.typeFilter() === 'all' && this.letterFilter() === 'ALL'
    );

    constructor() {
        this.refresh();
    }

    refresh(): void {
        this.loading.set(true);
        this.itemService
            .list(this.currentFilters())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (items) => {
                    this.items.set(items);
                    this.loading.set(false);
                },
                error: () => {
                    this.loading.set(false);
                    this.snackBar.open('Unable to load your anthology right now.', 'Dismiss', { duration: 5000 });
                },
            });
    }

    startCreate(): void {
        this.router.navigate(['/items/add']);
    }

    startEdit(item: Item): void {
        this.formContext.set({ item });
    }

    closeForm(): void {
        this.formContext.set(null);
    }

    handleSave(formValue: ItemForm): void {
        const ctx = this.formContext();
        if (!ctx) {
            return;
        }

        this.mutationInFlight.set(true);
        this.itemService
            .update(ctx.item.id, formValue)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (item) => {
                    this.mutationInFlight.set(false);
                    this.snackBar.open(`Saved “${item.title}”`, 'Dismiss', { duration: 4000 });
                    this.closeForm();
                    this.refresh();
                },
                error: () => {
                    this.mutationInFlight.set(false);
                    this.snackBar.open('We could not save the item. Double-check required fields.', 'Dismiss', {
                        duration: 5000,
                    });
                },
            });
    }

    deleteItem(item: Item): void {
        if (this.mutationInFlight()) {
            return;
        }

        this.mutationInFlight.set(true);
        this.itemService
            .delete(item.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.mutationInFlight.set(false);
                    this.snackBar.open(`Removed “${item.title}”`, 'Dismiss', { duration: 4000 });
                    this.closeForm();
                    this.refresh();
                },
                error: () => {
                    this.mutationInFlight.set(false);
                    this.snackBar.open('Unable to delete this entry right now.', 'Dismiss', { duration: 5000 });
                },
            });
    }

    trackById(_: number, item: Item): string {
        return item.id;
    }

    labelFor(item: Item): string {
        return this.typeLabels[item.itemType];
    }

    setLetterFilter(letter: LetterFilter): void {
        this.letterFilter.set(letter);
        this.refresh();
    }

    setTypeFilter(type: ItemTypeFilter): void {
        this.typeFilter.set(type);
        this.refresh();
    }

    private currentFilters(): { itemType?: ItemType; letter?: string } | undefined {
        const filters: { itemType?: ItemType; letter?: string } = {};

        const typeFilter = this.typeFilter();
        if (typeFilter !== 'all') {
            filters.itemType = typeFilter;
        }

        const letterFilter = this.letterFilter();
        if (letterFilter !== 'ALL') {
            filters.letter = letterFilter;
        }

        return Object.keys(filters).length > 0 ? filters : undefined;
    }
}
