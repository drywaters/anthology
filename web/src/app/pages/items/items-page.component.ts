import { DatePipe, NgClass, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';

import { ActiveBookStatus, BOOK_STATUS_LABELS, Item, ItemType, ITEM_TYPE_LABELS } from '../../models/item';
import { ItemService } from '../../services/item.service';

type ItemTypeFilter = ItemType | 'all';
type LetterFilter = AlphabetLetter | 'ALL';
type BookStatusFilter = ActiveBookStatus | 'all';

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
        NgClass,
        NgFor,
        NgIf,
        NgTemplateOutlet,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        MatCardModule,
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

    readonly displayedColumns = ['title', 'creator', 'itemType', 'releaseYear', 'updatedAt'] as const;
    readonly items = signal<Item[]>([]);
    readonly loading = signal(false);
    readonly letterFilter = signal<LetterFilter>('ALL');
    readonly typeFilter = signal<ItemTypeFilter>('all');
    readonly statusFilter = signal<BookStatusFilter>('all');
    readonly viewMode = signal<'table' | 'grid'>('table');

    readonly typeLabels = ITEM_TYPE_LABELS;
    readonly statusLabels = BOOK_STATUS_LABELS;
    readonly typeOptions: Array<{ value: ItemTypeFilter; label: string }> = [
        { value: 'all', label: 'All items' },
        { value: 'book', label: ITEM_TYPE_LABELS.book },
        { value: 'game', label: ITEM_TYPE_LABELS.game },
        { value: 'movie', label: ITEM_TYPE_LABELS.movie },
        { value: 'music', label: ITEM_TYPE_LABELS.music },
    ];
    readonly statusOptions: Array<{ value: BookStatusFilter; label: string }> = [
        { value: 'all', label: 'All' },
        { value: 'want_to_read', label: BOOK_STATUS_LABELS.want_to_read },
        { value: 'reading', label: BOOK_STATUS_LABELS.reading },
        { value: 'read', label: BOOK_STATUS_LABELS.read },
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
        () => this.typeFilter() === 'all' && this.letterFilter() === 'ALL' && this.statusFilter() === 'all'
    );
    readonly isGridView = computed(() => this.viewMode() === 'grid');

    constructor() {
        toObservable(computed(() => this.currentFilters()))
            .pipe(
                switchMap((filters) => {
                    this.loading.set(true);
                    return this.itemService.list(filters).pipe(
                        tap((items) => {
                            const sortedItems = [...items].sort((a, b) =>
                                a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
                            );
                            this.items.set(sortedItems);
                            this.loading.set(false);
                        }),
                        catchError(() => {
                            this.loading.set(false);
                            this.snackBar.open('Unable to load your anthology right now.', 'Dismiss', { duration: 5000 });
                            return EMPTY;
                        })
                    );
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe();
    }

    startCreate(): void {
        this.router.navigate(['/items/add']);
    }

    startEdit(item: Item): void {
        this.router.navigate(['/items', item.id, 'edit']);
    }

    viewShelfPlacement(item: Item, event: MouseEvent): void {
        event.stopPropagation();
        const placement = item.shelfPlacement;
        if (!placement) {
            return;
        }
        this.router.navigate(['/shelves', placement.shelfId], {
            queryParams: { slot: placement.slotId },
        });
    }

    trackById(_: number, item: Item): string {
        return item.id;
    }

    labelFor(item: Item): string {
        return this.typeLabels[item.itemType];
    }

    readingStatusLabel(item: Item): string | null {
        if (item.itemType !== 'book' || !item.readingStatus) {
            return null;
        }

        return this.statusLabels[item.readingStatus];
    }

    readingProgress(item: Item): { current: number; total?: number; percent?: number } | null {
        if (item.itemType !== 'book' || item.readingStatus !== 'reading') {
            return null;
        }
        if (item.currentPage === null || item.currentPage === undefined) {
            return null;
        }

        const progress: { current: number; total?: number; percent?: number } = {
            current: item.currentPage,
        };

        if (item.pageCount && item.pageCount > 0) {
            const clampedCurrent = Math.max(0, Math.min(item.currentPage, item.pageCount));
            progress.total = item.pageCount;
            progress.percent = Math.round((clampedCurrent / item.pageCount) * 100);
            progress.current = clampedCurrent;
        }

        return progress;
    }

    chipClassFor(itemType: ItemType): string {
        return `item-type-chip--${itemType}`;
    }

    filterByType(itemType: ItemType): void {
        this.setTypeFilter(itemType);
    }

    setLetterFilter(letter: LetterFilter): void {
        this.letterFilter.set(letter);
    }

    setTypeFilter(type: ItemTypeFilter): void {
        this.typeFilter.set(type);
    }

    setStatusFilter(status: BookStatusFilter): void {
        this.statusFilter.set(status);
    }

    setViewMode(mode: 'table' | 'grid'): void {
        this.viewMode.set(mode);
    }

    handleCardKeydown(event: KeyboardEvent, item: Item): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.startEdit(item);
        }
    }

    private currentFilters(): { itemType?: ItemType; letter?: string; status?: ActiveBookStatus } | undefined {
        const filters: { itemType?: ItemType; letter?: string; status?: ActiveBookStatus } = {};

        const typeFilter = this.typeFilter();
        if (typeFilter !== 'all') {
            filters.itemType = typeFilter;
        }

        const letterFilter = this.letterFilter();
        if (letterFilter !== 'ALL') {
            filters.letter = letterFilter;
        }

        const statusFilter = this.statusFilter();
        if (statusFilter !== 'all') {
            filters.status = statusFilter;
        }

        return Object.keys(filters).length > 0 ? filters : undefined;
    }
}
