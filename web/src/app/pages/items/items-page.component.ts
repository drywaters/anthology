import { DatePipe, NgClass, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import {
    AfterViewInit,
    Component,
    DestroyRef,
    ElementRef,
    Injector,
    OnDestroy,
    ViewChild,
    computed,
    effect,
    inject,
    signal,
} from '@angular/core';
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
import { EMPTY, catchError, combineLatest, switchMap, tap } from 'rxjs';

import {
    BOOK_STATUS_LABELS,
    BookStatus,
    BookStatusFilter,
    BookStatusFilters,
    Item,
    ItemType,
    ItemTypes,
    ITEM_TYPE_LABELS,
    LetterHistogram,
    SHELF_STATUS_LABELS,
    ShelfStatusFilter,
    ShelfStatusFilters,
} from '../../models/item';
import { ItemService } from '../../services/item.service';
import { AlphaRailComponent } from '../../components/alpha-rail/alpha-rail.component';
import { ThumbnailPipe } from '../../pipes/thumbnail.pipe';

type ItemTypeFilter = ItemType | 'all';

export interface LetterGroup {
    letter: string;
    items: Item[];
}

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
        AlphaRailComponent,
        ThumbnailPipe,
    ],
    templateUrl: './items-page.component.html',
    styleUrl: './items-page.component.scss',
})
export class ItemsPageComponent implements AfterViewInit, OnDestroy {
    private readonly itemService = inject(ItemService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);
    private readonly router = inject(Router);
    private readonly injector = inject(Injector);

    @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLElement>;

    readonly displayedColumns = [
        'title',
        'creator',
        'itemType',
        'releaseYear',
        'updatedAt',
    ] as const;
    readonly items = signal<Item[]>([]);
    readonly loading = signal(false);
    readonly typeFilter = signal<ItemTypeFilter>('all');
    readonly statusFilter = signal<BookStatusFilter>(BookStatusFilters.All);
    readonly shelfStatusFilter = signal<ShelfStatusFilter>(ShelfStatusFilters.All);
    readonly viewMode = signal<'table' | 'grid'>('table');
    readonly histogram = signal<LetterHistogram>({});
    readonly activeLetter = signal<string | null>(null);

    readonly typeLabels = ITEM_TYPE_LABELS;
    readonly statusLabels = BOOK_STATUS_LABELS;
    readonly BookStatus = BookStatus;
    readonly typeOptions: Array<{ value: ItemTypeFilter; label: string }> = [
        { value: 'all', label: 'All items' },
        { value: ItemTypes.Book, label: ITEM_TYPE_LABELS[ItemTypes.Book] },
        { value: ItemTypes.Game, label: ITEM_TYPE_LABELS[ItemTypes.Game] },
        { value: ItemTypes.Movie, label: ITEM_TYPE_LABELS[ItemTypes.Movie] },
        { value: ItemTypes.Music, label: ITEM_TYPE_LABELS[ItemTypes.Music] },
    ];
    readonly statusOptions: Array<{ value: BookStatusFilter; label: string }> = [
        { value: BookStatusFilters.All, label: 'All' },
        { value: BookStatusFilters.None, label: BOOK_STATUS_LABELS[BookStatus.None] },
        { value: BookStatusFilters.WantToRead, label: BOOK_STATUS_LABELS[BookStatus.WantToRead] },
        { value: BookStatusFilters.Reading, label: BOOK_STATUS_LABELS[BookStatus.Reading] },
        { value: BookStatusFilters.Read, label: BOOK_STATUS_LABELS[BookStatus.Read] },
    ];
    readonly shelfStatusOptions: Array<{ value: ShelfStatusFilter; label: string }> = [
        { value: ShelfStatusFilters.All, label: SHELF_STATUS_LABELS[ShelfStatusFilters.All] },
        { value: ShelfStatusFilters.On, label: SHELF_STATUS_LABELS[ShelfStatusFilters.On] },
        { value: ShelfStatusFilters.Off, label: SHELF_STATUS_LABELS[ShelfStatusFilters.Off] },
    ];

    readonly hasFilteredItems = computed(() => this.items().length > 0);
    readonly isUnfiltered = computed(
        () =>
            this.typeFilter() === 'all' &&
            this.statusFilter() === BookStatusFilters.All &&
            this.shelfStatusFilter() === ShelfStatusFilters.All,
    );
    readonly isGridView = computed(() => this.viewMode() === 'grid');
    readonly showStatusFilter = computed(() => {
        const type = this.typeFilter();
        return type === 'all' || type === ItemTypes.Book;
    });

    readonly groupedItems = computed<LetterGroup[]>(() => {
        const items = this.items();
        const groups = new Map<string, Item[]>();

        for (const item of items) {
            const letter = this.getFirstLetter(item.title);
            if (!groups.has(letter)) {
                groups.set(letter, []);
            }
            groups.get(letter)!.push(item);
        }

        return Array.from(groups.entries())
            .sort(([a], [b]) => {
                if (a === '#') return 1;
                if (b === '#') return -1;
                return a.localeCompare(b);
            })
            .map(([letter, items]) => ({ letter, items }));
    });

    private observer: IntersectionObserver | null = null;

    constructor() {
        const filters$ = toObservable(computed(() => this.currentFilters()));

        // Load items when filters change
        filters$
            .pipe(
                switchMap((filters) => {
                    this.loading.set(true);
                    return this.itemService.list(filters).pipe(
                        tap((items) => {
                            const sortedItems = [...items].sort((a, b) =>
                                a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
                            );
                            this.items.set(sortedItems);
                            this.loading.set(false);
                        }),
                        catchError(() => {
                            this.loading.set(false);
                            this.snackBar.open(
                                'Unable to load your anthology right now.',
                                'Dismiss',
                                { duration: 5000 },
                            );
                            return EMPTY;
                        }),
                    );
                }),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();

        // Load histogram when filters change
        filters$
            .pipe(
                switchMap((filters) => {
                    return this.itemService.getHistogram(filters).pipe(
                        tap((histogram) => this.histogram.set(histogram)),
                        catchError(() => EMPTY),
                    );
                }),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    ngAfterViewInit(): void {
        this.setupScrollObserver();

        effect(
            () => {
                // Re-attach the observer after the list renders or changes
                this.groupedItems();
                setTimeout(() => this.observeLetterSections(), 0);
            },
            { injector: this.injector },
        );
    }

    ngOnDestroy(): void {
        this.observer?.disconnect();
    }

    private setupScrollObserver(): void {
        const options: IntersectionObserverInit = {
            root: this.scrollContainer?.nativeElement,
            rootMargin: '-10% 0px -85% 0px',
            threshold: [0, 0.1, 0.5, 1],
        };

        this.observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((e) => e.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

            if (visible.length > 0) {
                const letter = visible[0].target.getAttribute('data-letter');
                if (letter) {
                    this.activeLetter.set(letter);
                }
            }
        }, options);

        // Initial observation after DOM renders
        setTimeout(() => this.observeLetterSections(), 0);
    }

    private observeLetterSections(): void {
        if (!this.observer) return;

        this.observer.disconnect();
        const sections = document.querySelectorAll('[data-letter]');
        sections.forEach((el) => this.observer!.observe(el));
    }

    scrollToLetter(letter: string): void {
        if (letter === 'ALL') {
            this.scrollContainer?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
            this.activeLetter.set(null);
            return;
        }

        const target = document.querySelector(`[data-letter="${letter}"]`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    onLetterSelected(letter: string): void {
        this.scrollToLetter(letter);
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

    trackByLetter(_: number, group: LetterGroup): string {
        return group.letter;
    }

    labelFor(item: Item): string {
        return this.typeLabels[item.itemType];
    }

    readingStatusLabel(item: Item): string | null {
        if (
            item.itemType !== ItemTypes.Book ||
            !item.readingStatus ||
            item.readingStatus === BookStatus.None
        ) {
            return null;
        }

        return this.statusLabels[item.readingStatus];
    }

    readingProgress(item: Item): { current: number; total?: number; percent?: number } | null {
        if (item.itemType !== ItemTypes.Book || item.readingStatus !== BookStatus.Reading) {
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

    setTypeFilter(type: ItemTypeFilter): void {
        this.typeFilter.set(type);
        // Clear status filter when switching to non-book type (UI-3)
        if (type !== 'all' && type !== ItemTypes.Book) {
            this.statusFilter.set(BookStatusFilters.All);
        }
    }

    setStatusFilter(status: BookStatusFilter): void {
        this.statusFilter.set(status);
    }

    setShelfStatusFilter(shelfStatus: ShelfStatusFilter): void {
        this.shelfStatusFilter.set(shelfStatus);
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

    private getFirstLetter(title: string): string {
        const trimmed = title.trim();
        if (trimmed.length === 0) {
            return '#';
        }

        const first = trimmed[0].toUpperCase();
        if (first >= 'A' && first <= 'Z') {
            return first;
        }
        return '#';
    }

    private currentFilters():
        | { itemType?: ItemType; status?: BookStatus; shelfStatus?: ShelfStatusFilter }
        | undefined {
        const filters: {
            itemType?: ItemType;
            status?: BookStatus;
            shelfStatus?: ShelfStatusFilter;
        } = {};

        const typeFilter = this.typeFilter();
        if (typeFilter !== 'all') {
            filters.itemType = typeFilter;
        }

        // Only include status filter when type is 'all' or 'book' (FE-1, FE-2)
        const statusFilter = this.statusFilter();
        if (
            statusFilter !== BookStatusFilters.All &&
            (typeFilter === 'all' || typeFilter === ItemTypes.Book)
        ) {
            filters.status = statusFilter;
        }

        const shelfStatusFilter = this.shelfStatusFilter();
        if (shelfStatusFilter !== ShelfStatusFilters.All) {
            filters.shelfStatus = shelfStatusFilter;
        }

        return Object.keys(filters).length > 0 ? filters : undefined;
    }
}
