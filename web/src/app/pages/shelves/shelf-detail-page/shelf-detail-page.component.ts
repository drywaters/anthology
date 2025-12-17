import { Component, DestroyRef, computed, inject, signal, ViewChild } from '@angular/core';
import { NgIf, NgClass } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import {
    LayoutSlotInput,
    PlacementWithItem,
    ScanStatus,
    ShelfSlot,
    ShelfWithLayout,
} from '../../../models/shelf';
import { ShelfService } from '../../../services/shelf.service';
import {
    ShelfCanvasComponent,
    LayoutSlotData,
    SlotSelectionEvent,
    SlotPositionUpdate,
} from '../../../components/shelves/shelf-canvas/shelf-canvas.component';
import { SlotSidebarComponent } from '../../../components/shelves/slot-sidebar/slot-sidebar.component';
import {
    LayoutEditorComponent,
    LayoutRow,
} from '../../../components/shelves/layout-editor/layout-editor.component';

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

@Component({
    selector: 'app-shelf-detail-page',
    standalone: true,
    imports: [
        NgIf,
        NgClass,
        RouterModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatProgressBarModule,
        MatSnackBarModule,
        ShelfCanvasComponent,
        SlotSidebarComponent,
        LayoutEditorComponent,
    ],
    templateUrl: './shelf-detail-page.component.html',
    styleUrl: './shelf-detail-page.component.scss',
})
export class ShelfDetailPageComponent {
    private static readonly DEFAULT_SLOT_MARGIN = 0.02;
    private static readonly SCAN_DEBOUNCE_MS = 3000;

    private readonly route = inject(ActivatedRoute);
    private readonly shelfService = inject(ShelfService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly fb = inject(FormBuilder);
    private readonly destroyRef = inject(DestroyRef);

    private pendingSlotId: string | null = null;
    private lastScannedISBN: string | null = null;
    private lastScanTime: number = 0;
    private recentlyScannedItems = new Set<string>();

    @ViewChild(SlotSidebarComponent) sidebarComponent?: SlotSidebarComponent;

    readonly loading = signal(false);
    readonly savingLayout = signal(false);
    readonly shelf = signal<ShelfWithLayout | null>(null);
    readonly selectedSlot = signal<ShelfSlot | null>(null);
    readonly displaced = signal<PlacementWithItem[]>([]);
    readonly mode = signal<'view' | 'edit'>('view');
    readonly activeLayoutSelection = signal<SlotSelectionEvent | null>(null);

    readonly layoutForm = this.fb.array<FormGroup<LayoutRowGroup>>([]);
    readonly unplacedItems = computed(() => this.shelf()?.unplaced ?? []);
    readonly recentlyScannedIds = computed(() => this.recentlyScannedItems);

    // Computed properties for canvas
    readonly layoutSlots = computed<LayoutSlotData[]>(() => {
        const slots: LayoutSlotData[] = [];
        this.rows.controls.forEach((row) => {
            row.controls.columns.controls.forEach((col) => {
                slots.push({
                    rowIndex: row.controls.rowIndex.value,
                    colIndex: col.controls.colIndex.value,
                    position: {
                        xStartNorm: col.controls.xStartNorm.value,
                        xEndNorm: col.controls.xEndNorm.value,
                        yStartNorm: col.controls.yStartNorm.value,
                        yEndNorm: col.controls.yEndNorm.value,
                    },
                    slotId: col.controls.slotId.value ?? undefined,
                });
            });
        });
        return slots;
    });

    // Computed property for layout editor
    readonly layoutRows = computed<LayoutRow[]>(() => {
        return this.rows.controls.map((row, rowIndex) => ({
            rowIndex,
            columns: row.controls.columns.controls.map((_, colIndex) => ({ colIndex })),
        }));
    });

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
        (shelf.slots ?? []).forEach((slot) =>
            slotMap.set(`${slot.rowIndex}-${slot.colIndex}`, slot),
        );
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
                rowIndex: this.fb.control(row.rowIndex, {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
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

    private createColumnGroup(
        colIndex: number,
        initial?: Partial<{
            columnId: string | null;
            slotId: string | null;
            xStartNorm: number;
            xEndNorm: number;
            yStartNorm: number;
            yEndNorm: number;
        }>,
    ): FormGroup<LayoutColumnGroup> {
        return this.fb.group<LayoutColumnGroup>({
            columnId: this.fb.control(initial?.columnId ?? null, { nonNullable: false }),
            colIndex: this.fb.control(colIndex, {
                nonNullable: true,
                validators: [Validators.required],
            }),
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

    // Mode management
    startEdit(): void {
        this.mode.set('edit');
        this.activeLayoutSelection.set(null);
        this.resetLayoutForm();
    }

    cancelEdit(): void {
        this.mode.set('view');
        this.displaced.set([]);
        this.activeLayoutSelection.set(null);
        this.resetLayoutForm();
    }

    // Layout editing
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
            }),
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
            }),
        );
        this.reindexRows();
    }

    removeColumn(event: { rowIndex: number; colIndex: number }): void {
        const columns = this.rows.at(event.rowIndex).controls.columns;
        columns.removeAt(event.colIndex);
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

    // Canvas event handlers
    onSlotSelected(slot: ShelfSlot): void {
        this.selectedSlot.set(slot);
    }

    onLayoutSlotSelected(event: SlotSelectionEvent): void {
        this.activeLayoutSelection.set(event);
    }

    onSlotPositionChanged(update: SlotPositionUpdate): void {
        const column = this.rows.at(update.rowIndex)?.controls.columns.at(update.colIndex);
        if (!column) return;

        column.controls.xStartNorm.setValue(update.position.xStartNorm);
        column.controls.xEndNorm.setValue(update.position.xEndNorm);
        column.controls.yStartNorm.setValue(update.position.yStartNorm);
        column.controls.yEndNorm.setValue(update.position.yEndNorm);
    }

    // Sidebar event handlers
    assignedItems(slotId: string): PlacementWithItem[] {
        return (this.shelf()?.placements ?? [])
            .filter((p) => p.placement.shelfSlotId === slotId)
            .sort((a, b) =>
                a.item.title.localeCompare(b.item.title, undefined, { sensitivity: 'base' }),
            );
    }

    onItemRemoved(itemId: string): void {
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
                error: () =>
                    this.snackBar.open('Unable to remove item', 'Dismiss', { duration: 4000 }),
            });
    }

    onItemSelected(itemId: string): void {
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
                error: () =>
                    this.snackBar.open('Unable to assign item', 'Dismiss', { duration: 4000 }),
            });
    }

    onBarcodeScanned(isbn: string): void {
        const now = Date.now();

        if (
            isbn === this.lastScannedISBN &&
            now - this.lastScanTime < ShelfDetailPageComponent.SCAN_DEBOUNCE_MS
        ) {
            this.snackBar.open(
                'Item already scanned. Wait a moment before scanning again.',
                'Dismiss',
                { duration: 2000 },
            );
            this.sidebarComponent?.reportScanComplete();
            return;
        }

        this.lastScannedISBN = isbn;
        this.lastScanTime = now;

        const shelf = this.shelf();
        const slot = this.selectedSlot();

        if (!shelf || !slot) {
            this.snackBar.open('No slot selected', 'Dismiss', { duration: 3000 });
            this.sidebarComponent?.reportScanComplete();
            return;
        }

        this.shelfService
            .scanAndAssign(shelf.shelf.id, slot.id, isbn)
            .pipe(
                takeUntilDestroyed(this.destroyRef),
                finalize(() => this.sidebarComponent?.reportScanComplete()),
            )
            .subscribe({
                next: (result) => {
                    this.handleScanSuccess(result.item.id, result.item.title, result.status);
                    this.loadShelf(shelf.shelf.id);
                },
                error: (err) => {
                    console.error('Scan failed', err);
                    const message = err.error?.error || 'Could not scan item. Please try again.';
                    this.snackBar.open(message, 'Dismiss', { duration: 5000 });
                },
            });
    }

    private handleScanSuccess(itemId: string, title: string, status: ScanStatus): void {
        this.recentlyScannedItems.add(itemId);

        setTimeout(() => {
            this.recentlyScannedItems.delete(itemId);
        }, 5000);

        const slot = this.selectedSlot();
        if (!slot) {
            return;
        }

        if (status === 'created') {
            this.snackBar.open(`Added: ${title}`, 'Dismiss', { duration: 5000 });
        } else if (status === 'moved') {
            this.snackBar.open(
                `Moved: ${title} → Slot ${slot.rowIndex + 1}·${slot.colIndex + 1}`,
                'Dismiss',
                { duration: 5000 },
            );
        } else if (status === 'present') {
            this.snackBar.open(`Already here: ${title}`, 'Dismiss', { duration: 4000 });
        }
    }

    onUnplacedItemAssigned(itemId: string): void {
        this.onItemSelected(itemId);
    }

    private ensureActiveLayoutSelection(): void {
        const selection = this.activeLayoutSelection();
        if (!selection) {
            return;
        }
        const row = this.rows.at(selection.rowIndex);
        if (!row || selection.colIndex >= row.controls.columns.length) {
            this.activeLayoutSelection.set(null);
        }
    }
}
