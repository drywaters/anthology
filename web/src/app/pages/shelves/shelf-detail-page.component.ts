import { Component, DestroyRef, ElementRef, computed, inject, signal, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
import { NgClass, NgFor, NgIf, NgStyle } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, finalize, map, of, startWith, switchMap } from 'rxjs';

import { Item, ItemType, ITEM_TYPE_LABELS } from '../../models/item';
import { LayoutSlotInput, PlacementWithItem, ShelfSlot, ShelfWithLayout } from '../../models/shelf';
import { ShelfService } from '../../services/shelf.service';
import { ItemService } from '../../services/item.service';

interface LayoutRowGroup {
    rowId: FormControl<string | null>;
    rowIndex: FormControl<number>;
    columns: FormArray<FormGroup<LayoutColumnGroup>>;
}

interface LayoutColumnGroup {
    columnId: FormControl<string | null>;
    colIndex: FormControl<number>;
    xStartNorm: FormControl<number>;
    xEndNorm: FormControl<number>;
    yStartNorm: FormControl<number>;
    yEndNorm: FormControl<number>;
    slotId: FormControl<string | null>;
}

type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

type DragContext = {
    kind: 'corner';
    rowIndex: number;
    columnIndex: number;
    corner: CornerPosition;
};

type ItemTypeFilter = ItemType | 'all';

@Component({
    selector: 'app-shelf-detail-page',
    standalone: true,
    imports: [
        NgFor,
        NgIf,
        NgClass,
        NgStyle,
        RouterModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatChipsModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatAutocompleteModule,
        MatSelectModule,
        MatSnackBarModule,
    ],
    templateUrl: './shelf-detail-page.component.html',
    styleUrl: './shelf-detail-page.component.scss',
})
export class ShelfDetailPageComponent {
    private static readonly MIN_SEGMENT = 0.02;
    private static readonly AXIS_LOCK_THRESHOLD_PX = 16;
    private static readonly MIN_SEARCH_LENGTH = 2;
    private static readonly SEARCH_RESULT_LIMIT = 10;
    private static readonly DEFAULT_SLOT_MARGIN = 0.02;

    private readonly route = inject(ActivatedRoute);
    private readonly shelfService = inject(ShelfService);
    private readonly itemService = inject(ItemService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly fb = inject(FormBuilder);
    private readonly destroyRef = inject(DestroyRef);
    private readonly ngZone = inject(NgZone);
    private readonly cdr = inject(ChangeDetectorRef);
    private activeDrag: DragContext | null = null;
    private overlayRect: DOMRect | null = null;
    private readonly pointerMoveListener = (event: PointerEvent) => this.handlePointerMove(event);
    private readonly pointerUpListener = () => this.endDrag();
    private dragStartPoint: { x: number; y: number } | null = null;
    private dragLockedAxis: 'x' | 'y' | null = null;
    private pendingSlotId: string | null = null;

    @ViewChild('canvasOverlay') canvasOverlay?: ElementRef<HTMLDivElement>;

    readonly loading = signal(false);
    readonly savingLayout = signal(false);
    readonly shelf = signal<ShelfWithLayout | null>(null);
    readonly selectedSlot = signal<ShelfSlot | null>(null);
    readonly displaced = signal<PlacementWithItem[]>([]);
    readonly mode = signal<'view' | 'edit'>('view');
    readonly activeLayoutSelection = signal<{ rowIndex: number; columnIndex: number } | null>(null);
    readonly itemSearchControl = this.fb.control('', { nonNullable: true });
    readonly itemSearchResults = signal<Item[]>([]);
    readonly searchingItems = signal(false);
    readonly minSearchLength = ShelfDetailPageComponent.MIN_SEARCH_LENGTH;
    readonly itemSearchType = this.fb.control<ItemTypeFilter>('all', { nonNullable: true });
    readonly itemTypeOptions: Array<{ value: ItemTypeFilter; label: string }> = [
        { value: 'all', label: 'All items' },
        { value: 'book', label: ITEM_TYPE_LABELS.book },
        { value: 'game', label: ITEM_TYPE_LABELS.game },
        { value: 'movie', label: ITEM_TYPE_LABELS.movie },
        { value: 'music', label: ITEM_TYPE_LABELS.music },
    ];

    readonly itemTypeLabels = ITEM_TYPE_LABELS;

    readonly layoutForm = this.fb.array<FormGroup<LayoutRowGroup>>([]);
    readonly unplacedItems = computed(() => this.shelf()?.unplaced ?? []);

    constructor() {
        this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
            const id = params.get('id');
            if (!id) {
                this.shelf.set(null);
                return;
            }
            this.mode.set('view');
            this.displaced.set([]);
            this.selectedSlot.set(null);
            this.loadShelf(id);
        });

        this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
            this.pendingSlotId = params.get('slot');
            this.highlightSlotFromQuery();
        });

        this.initializeItemSearch();
        this.destroyRef.onDestroy(() => this.endDrag());
    }

    get rows(): FormArray<FormGroup<LayoutRowGroup>> {
        return this.layoutForm;
    }

    loadShelf(id: string): void {
        this.loading.set(true);
        this.shelfService
            .get(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (shelf) => {
                    this.shelf.set(shelf);
                    this.loading.set(false);
                    const highlighted = this.highlightSlotFromQuery();
                    if (!highlighted && !this.selectedSlot()) {
                        this.selectedSlot.set(shelf.slots[0] ?? null);
                    }
                    this.resetLayoutForm();
                },
                error: () => {
                    this.loading.set(false);
                    this.snackBar.open('Could not load shelf.', 'Dismiss', { duration: 4000 });
                },
            });
    }

    resetLayoutForm(): void {
        this.layoutForm.clear();
        const shelf = this.shelf();
        if (!shelf) {
            return;
        }
        const slotMap = new Map<string, ShelfSlot>();
        (shelf.slots ?? []).forEach((slot) => slotMap.set(`${slot.rowIndex}-${slot.colIndex}`, slot));
        shelf.rows.forEach((row) => {
            const columns = row.columns ?? [];
            const columnGroups = columns.map((col) => {
                const slot = slotMap.get(`${row.rowIndex}-${col.colIndex}`);
                return this.createColumnGroup(col.colIndex, {
                    columnId: col.id,
                    slotId: slot?.id ?? null,
                    xStartNorm: col.xStartNorm,
                    xEndNorm: col.xEndNorm,
                    yStartNorm: slot?.yStartNorm ?? row.yStartNorm,
                    yEndNorm: slot?.yEndNorm ?? row.yEndNorm,
                });
            });
            const group = this.fb.group<LayoutRowGroup>({
                rowId: this.fb.control(row.id, { nonNullable: false }),
                rowIndex: this.fb.control(row.rowIndex, { nonNullable: true, validators: [Validators.required] }),
                columns: this.fb.array(columnGroups),
            });
            this.rows.push(group);
        });
    }

    private highlightSlotFromQuery(): boolean {
        const slotId = this.pendingSlotId;
        const shelf = this.shelf();
        if (!slotId || !shelf) {
            return false;
        }
        const slot = shelf.slots.find((s) => s.id === slotId);
        if (!slot) {
            return false;
        }
        this.selectedSlot.set(slot);
        this.pendingSlotId = null;
        return true;
    }

    private initializeItemSearch(): void {
        const query$ = this.itemSearchControl.valueChanges.pipe(
            startWith(this.itemSearchControl.value),
            debounceTime(250),
            map((value) => (value ?? '').trim()),
            distinctUntilChanged()
        );
        const type$ = this.itemSearchType.valueChanges.pipe(startWith(this.itemSearchType.value));

        combineLatest([query$, type$])
            .pipe(
                switchMap(([query, type]) => this.queryItems(query, type)),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((results) => {
                this.itemSearchResults.set(results);
            });
    }

    private queryItems(query: string, typeFilter: ItemTypeFilter) {
        if (query.length < this.minSearchLength) {
            this.itemSearchResults.set([]);
            this.searchingItems.set(false);
            return of<Item[]>([]);
        }

        this.searchingItems.set(true);
        const filters: { itemType?: ItemType; query: string; limit: number } = {
            query,
            limit: ShelfDetailPageComponent.SEARCH_RESULT_LIMIT,
        };
        if (typeFilter !== 'all') {
            filters.itemType = typeFilter;
        }

        return this.itemService.list(filters).pipe(
            catchError(() => {
                this.snackBar.open('Unable to search your library', 'Dismiss', { duration: 4000 });
                return of<Item[]>([]);
            }),
            finalize(() => this.searchingItems.set(false))
        );
    }

    private createColumnGroup(
        colIndex: number,
        initial?: Partial<{
            columnId: string | null;
            slotId: string | null;
            xStartNorm: number;
            xEndNorm: number;
            yStartNorm: number;
            yEndNorm: number;
        }>
    ): FormGroup<LayoutColumnGroup> {
        return this.fb.group<LayoutColumnGroup>({
            columnId: this.fb.control(initial?.columnId ?? null, { nonNullable: false }),
            colIndex: this.fb.control(colIndex, { nonNullable: true, validators: [Validators.required] }),
            xStartNorm: this.fb.control(initial?.xStartNorm ?? 0, {
                nonNullable: true,
                validators: [Validators.required, Validators.min(0), Validators.max(1)],
            }),
            xEndNorm: this.fb.control(initial?.xEndNorm ?? 1, {
                nonNullable: true,
                validators: [Validators.required, Validators.min(0), Validators.max(1)],
            }),
            yStartNorm: this.fb.control(initial?.yStartNorm ?? 0, {
                nonNullable: true,
                validators: [Validators.required, Validators.min(0), Validators.max(1)],
            }),
            yEndNorm: this.fb.control(initial?.yEndNorm ?? 1, {
                nonNullable: true,
                validators: [Validators.required, Validators.min(0), Validators.max(1)],
            }),
            slotId: this.fb.control(initial?.slotId ?? null, { nonNullable: false }),
        });
    }

    startEdit(): void {
        this.mode.set('edit');
        this.activeLayoutSelection.set(null);
        this.resetLayoutForm();
    }

    cancelEdit(): void {
        this.endDrag();
        this.mode.set('view');
        this.displaced.set([]);
        this.activeLayoutSelection.set(null);
        this.resetLayoutForm();
    }

    addRow(): void {
        const margin = ShelfDetailPageComponent.DEFAULT_SLOT_MARGIN;
        this.rows.push(
            this.fb.group<LayoutRowGroup>({
                rowId: this.fb.control<string | null>(null),
                rowIndex: this.fb.control(0, { nonNullable: true }),
                columns: this.fb.array([
                    this.createColumnGroup(0, {
                        xStartNorm: margin,
                        xEndNorm: 1 - margin,
                        yStartNorm: margin,
                        yEndNorm: 1 - margin,
                    }),
                ]),
            })
        );
        this.reindexRows();
    }

    addColumn(rowIndex: number): void {
        const columns = this.rows.at(rowIndex).controls.columns;
        const lastColumn = columns.length ? columns.at(columns.length - 1) : null;
        const margin = ShelfDetailPageComponent.DEFAULT_SLOT_MARGIN;
        columns.push(
            this.createColumnGroup(columns.length, {
                xStartNorm: lastColumn?.controls.xStartNorm.value ?? margin,
                xEndNorm: lastColumn?.controls.xEndNorm.value ?? 1 - margin,
                yStartNorm: lastColumn?.controls.yStartNorm.value ?? margin,
                yEndNorm: lastColumn?.controls.yEndNorm.value ?? 1 - margin,
            })
        );
        this.reindexRows();
    }

    removeColumn(rowIndex: number, colIndex: number): void {
        const columns = this.rows.at(rowIndex).controls.columns;
        columns.removeAt(colIndex);
        this.reindexRows();
    }

    removeRow(rowIndex: number): void {
        this.rows.removeAt(rowIndex);
        this.reindexRows();
    }

    private reindexRows(): void {
        this.rows.controls.forEach((row, rowIndex) => {
            row.controls.rowIndex.setValue(rowIndex);
            row.controls.columns.controls.forEach((column, colIndex) => {
                column.controls.colIndex.setValue(colIndex);
            });
        });
        this.ensureActiveLayoutSelection();
    }

    saveLayout(): void {
        const shelf = this.shelf();
        if (!shelf) {
            return;
        }
        const slots: LayoutSlotInput[] = [];
        this.rows.controls.forEach((row) => {
            row.controls.columns.controls.forEach((col) => {
                slots.push({
                    slotId: col.controls.slotId.value ?? undefined,
                    rowIndex: row.controls.rowIndex.value,
                    colIndex: col.controls.colIndex.value,
                    xStartNorm: col.controls.xStartNorm.value,
                    xEndNorm: col.controls.xEndNorm.value,
                    yStartNorm: col.controls.yStartNorm.value,
                    yEndNorm: col.controls.yEndNorm.value,
                });
            });
        });

        this.savingLayout.set(true);
        this.shelfService
            .updateLayout(shelf.shelf.id, slots)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (response) => {
                    this.endDrag();
                    this.shelf.set(response.shelf);
                    this.displaced.set(response.displaced ?? []);
                    this.savingLayout.set(false);
                    this.mode.set('view');
                    this.resetLayoutForm();
                    this.snackBar.open('Layout updated', undefined, { duration: 2000 });
                },
                error: (err) => {
                    this.savingLayout.set(false);
                    const message = err?.error?.error ?? 'Could not save layout';
                    this.snackBar.open(message, 'Dismiss', { duration: 5000 });
                },
            });
    }

    selectSlot(slot: ShelfSlot): void {
        this.selectedSlot.set(slot);
    }

    selectLayoutSlot(rowIndex: number, columnIndex: number): void {
        if (this.mode() !== 'edit') {
            return;
        }
        this.activeLayoutSelection.set({ rowIndex, columnIndex });
    }

    slotStyle(slot: ShelfSlot): Record<string, string> {
        return {
            left: `${slot.xStartNorm * 100}%`,
            top: `${slot.yStartNorm * 100}%`,
            width: `${(slot.xEndNorm - slot.xStartNorm) * 100}%`,
            height: `${(slot.yEndNorm - slot.yStartNorm) * 100}%`,
        };
    }

    formSlotStyle(rowIndex: number, columnIndex: number): Record<string, string> {
        const column = this.rows.at(rowIndex)?.controls.columns.at(columnIndex);
        if (!column) {
            return {};
        }
        const yStart = column.controls.yStartNorm.value;
        const yEnd = column.controls.yEndNorm.value;
        const xStart = column.controls.xStartNorm.value;
        const xEnd = column.controls.xEndNorm.value;
        return {
            left: `${xStart * 100}%`,
            top: `${yStart * 100}%`,
            width: `${(xEnd - xStart) * 100}%`,
            height: `${(yEnd - yStart) * 100}%`,
        };
    }

    beginCornerDrag(rowIndex: number, columnIndex: number, corner: CornerPosition, event: PointerEvent): void {
        if (this.mode() !== 'edit' || !this.isLayoutSlotSelected(rowIndex, columnIndex)) {
            return;
        }
        this.startDrag({ kind: 'corner', rowIndex, columnIndex, corner }, event);
    }

    isSlotActive(rowIndex: number, columnIndex: number): boolean {
        const active = this.activeDrag;
        if (!!active && active.kind === 'corner' && active.rowIndex === rowIndex && active.columnIndex === columnIndex) {
            return true;
        }
        return this.isLayoutSlotSelected(rowIndex, columnIndex);
    }

    isLayoutSlotSelected(rowIndex: number, columnIndex: number): boolean {
        const selected = this.activeLayoutSelection();
        return !!selected && selected.rowIndex === rowIndex && selected.columnIndex === columnIndex;
    }

    assignedItems(slotId: string): PlacementWithItem[] {
        return (this.shelf()?.placements ?? []).filter((p) => p.placement.shelfSlotId === slotId);
    }

    handleSearchSelection(itemId: string): void {
        this.assignToSelected(itemId);
        this.itemSearchControl.setValue('', { emitEvent: false });
        this.itemSearchResults.set([]);
    }

    get itemSearchQuery(): string {
        return (this.itemSearchControl.value ?? '').trim();
    }

    assignToSelected(itemId: string): void {
        const slot = this.selectedSlot();
        const shelf = this.shelf();
        if (!slot || !shelf) {
            return;
        }
        this.shelfService
            .assignItem(shelf.shelf.id, slot.id, itemId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (updated) => this.shelf.set(updated),
                error: () => this.snackBar.open('Unable to assign item', 'Dismiss', { duration: 4000 }),
            });
    }

    removeFromSlot(itemId: string): void {
        const slot = this.selectedSlot();
        const shelf = this.shelf();
        if (!slot || !shelf) {
            return;
        }
        this.shelfService
            .removeItem(shelf.shelf.id, slot.id, itemId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (updated) => this.shelf.set(updated),
                error: () => this.snackBar.open('Unable to remove item', 'Dismiss', { duration: 4000 }),
            });
    }

    private startDrag(context: DragContext, event: PointerEvent): void {
        const win = this.windowRef;
        if (!win) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.endDrag();
        this.activeLayoutSelection.set({ rowIndex: context.rowIndex, columnIndex: context.columnIndex });
        this.activeDrag = context;
        this.overlayRect = this.canvasOverlay?.nativeElement.getBoundingClientRect() ?? null;
        this.dragLockedAxis = null;
        this.dragStartPoint = { x: event.clientX, y: event.clientY };
        win.addEventListener('pointermove', this.pointerMoveListener);
        win.addEventListener('pointerup', this.pointerUpListener);
        win.addEventListener('pointercancel', this.pointerUpListener);
    }

    private endDrag(): void {
        const win = this.windowRef;
        if (!this.activeDrag) {
            return;
        }
        this.activeDrag = null;
        if (win) {
            win.removeEventListener('pointermove', this.pointerMoveListener);
            win.removeEventListener('pointerup', this.pointerUpListener);
            win.removeEventListener('pointercancel', this.pointerUpListener);
        }
        this.overlayRect = null;
        this.dragStartPoint = null;
        this.dragLockedAxis = null;
    }

    private handlePointerMove(event: PointerEvent): void {
        if (!this.activeDrag) {
            return;
        }
        if (!this.overlayRect) {
            this.overlayRect = this.canvasOverlay?.nativeElement.getBoundingClientRect() ?? null;
        }
        const rect = this.overlayRect;
        if (!rect) {
            return;
        }
        if (this.activeDrag.kind === 'corner') {
            this.adjustCorner(event.clientX, event.clientY, rect);
        }
    }

    private adjustCorner(clientX: number, clientY: number, rect: DOMRect): void {
        if (!this.activeDrag || this.activeDrag.kind !== 'corner' || !this.dragStartPoint) {
            return;
        }
        const column = this.rows.at(this.activeDrag.rowIndex)?.controls.columns.at(this.activeDrag.columnIndex);
        if (!column) {
            return;
        }

        const dx = Math.abs(clientX - this.dragStartPoint.x);
        const dy = Math.abs(clientY - this.dragStartPoint.y);

        // Try to establish a lock if not already locked
        if (!this.dragLockedAxis && Math.max(dx, dy) >= ShelfDetailPageComponent.AXIS_LOCK_THRESHOLD_PX) {
            const AXIS_LOCK_DOMINANCE_RATIO = 2; // One axis must be 2x greater than other to lock
            if (dy > dx * AXIS_LOCK_DOMINANCE_RATIO) {
                this.dragLockedAxis = 'y';
            } else if (dx > dy * AXIS_LOCK_DOMINANCE_RATIO) {
                this.dragLockedAxis = 'x';
            }
        }

        // Determine allowed movement based on lock status
        // If locked to X, we allow X movement (and block Y)
        // If locked to Y, we allow Y movement (and block X)
        // If not locked, we allow both
        const allowX = this.dragLockedAxis === null || this.dragLockedAxis === 'x';
        const allowY = this.dragLockedAxis === null || this.dragLockedAxis === 'y';

        const normalizedX = this.clamp((clientX - rect.left) / rect.width, 0, 1);
        const normalizedY = this.clamp((clientY - rect.top) / rect.height, 0, 1);

        const isTop = this.activeDrag.corner === 'top-left' || this.activeDrag.corner === 'top-right';
        const isLeft = this.activeDrag.corner === 'top-left' || this.activeDrag.corner === 'bottom-left';

        this.ngZone.run(() => {
            if (allowY && isTop) {
                const max = column.controls.yEndNorm.value - ShelfDetailPageComponent.MIN_SEGMENT;
                column.controls.yStartNorm.setValue(this.clamp(normalizedY, 0, max));
            } else if (allowY && !isTop) {
                const min = column.controls.yStartNorm.value + ShelfDetailPageComponent.MIN_SEGMENT;
                column.controls.yEndNorm.setValue(this.clamp(normalizedY, min, 1));
            }

            if (allowX && isLeft) {
                const max = column.controls.xEndNorm.value - ShelfDetailPageComponent.MIN_SEGMENT;
                column.controls.xStartNorm.setValue(this.clamp(normalizedX, 0, max));
            } else if (allowX && !isLeft) {
                const min = column.controls.xStartNorm.value + ShelfDetailPageComponent.MIN_SEGMENT;
                column.controls.xEndNorm.setValue(this.clamp(normalizedX, min, 1));
            }
            this.cdr.detectChanges();
        });

        if (
            clientX < rect.left ||
            clientX > rect.right ||
            clientY < rect.top ||
            clientY > rect.bottom
        ) {
            this.overlayRect = this.canvasOverlay?.nativeElement.getBoundingClientRect() ?? null;
        }
    }



    private clamp(value: number, min: number, max: number): number {
        if (Number.isNaN(value)) {
            return min;
        }
        if (max < min) {
            return min;
        }
        return Math.min(Math.max(value, min), max);
    }

    private ensureActiveLayoutSelection(): void {
        const selection = this.activeLayoutSelection();
        if (!selection) {
            return;
        }
        const row = this.rows.at(selection.rowIndex);
        if (!row || selection.columnIndex >= row.controls.columns.length) {
            this.activeLayoutSelection.set(null);
        }
    }

    private get windowRef(): Window | null {
        return typeof window === 'undefined' ? null : window;
    }
}
