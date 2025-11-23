import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { NgClass, NgFor, NgIf, NgStyle } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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

import { Item, ITEM_TYPE_LABELS } from '../../models/item';
import {
    LayoutColumnInput,
    LayoutRowInput,
    PlacementWithItem,
    ShelfSlot,
    ShelfWithLayout,
} from '../../models/shelf';
import { ShelfService } from '../../services/shelf.service';
import { ItemService } from '../../services/item.service';

interface LayoutRowGroup {
    rowId: FormControl<string | null>;
    rowIndex: FormControl<number>;
    yStartNorm: FormControl<number>;
    yEndNorm: FormControl<number>;
    columns: FormArray<FormGroup<LayoutColumnGroup>>;
}

interface LayoutColumnGroup {
    columnId: FormControl<string | null>;
    colIndex: FormControl<number>;
    xStartNorm: FormControl<number>;
    xEndNorm: FormControl<number>;
}

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
        MatSelectModule,
        MatSnackBarModule,
    ],
    templateUrl: './shelf-detail-page.component.html',
    styleUrl: './shelf-detail-page.component.scss',
})
export class ShelfDetailPageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly shelfService = inject(ShelfService);
    private readonly itemService = inject(ItemService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly fb = inject(FormBuilder);
    private readonly destroyRef = inject(DestroyRef);

    readonly loading = signal(false);
    readonly savingLayout = signal(false);
    readonly shelf = signal<ShelfWithLayout | null>(null);
    readonly items = signal<Item[]>([]);
    readonly selectedSlot = signal<ShelfSlot | null>(null);
    readonly displaced = signal<PlacementWithItem[]>([]);
    readonly mode = signal<'view' | 'edit'>('view');

    readonly itemTypeLabels = ITEM_TYPE_LABELS;

    readonly layoutForm = this.fb.array<FormGroup<LayoutRowGroup>>([]);
    readonly unplacedItems = computed(() => this.shelf()?.unplaced ?? []);

    constructor() {
        effect(() => {
            const id = this.route.snapshot.paramMap.get('id');
            if (id) {
                this.loadShelf(id);
                this.loadItems();
            }
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
                    if (!this.selectedSlot()) {
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

    loadItems(): void {
        this.itemService
            .list()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (items) => this.items.set(items),
                error: () => this.snackBar.open('Unable to load items', 'Dismiss', { duration: 4000 }),
            });
    }

    resetLayoutForm(): void {
        this.layoutForm.clear();
        const shelf = this.shelf();
        if (!shelf) {
            return;
        }
        shelf.rows.forEach((row) => {
            const group = this.fb.group<LayoutRowGroup>({
                rowId: this.fb.control(row.id, { nonNullable: false }),
                rowIndex: this.fb.control(row.rowIndex, { nonNullable: true, validators: [Validators.required] }),
                yStartNorm: this.fb.control(row.yStartNorm, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(1)] }),
                yEndNorm: this.fb.control(row.yEndNorm, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(1)] }),
                columns: this.fb.array(
                    (row.columns ?? []).map((col) =>
                        this.fb.group<LayoutColumnGroup>({
                            columnId: this.fb.control(col.id, { nonNullable: false }),
                            colIndex: this.fb.control(col.colIndex, { nonNullable: true, validators: [Validators.required] }),
                            xStartNorm: this.fb.control(col.xStartNorm, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(1)] }),
                            xEndNorm: this.fb.control(col.xEndNorm, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(1)] }),
                        })
                    )
                ),
            });
            this.rows.push(group);
        });
    }

    startEdit(): void {
        this.mode.set('edit');
        this.resetLayoutForm();
    }

    cancelEdit(): void {
        this.mode.set('view');
        this.displaced.set([]);
        this.resetLayoutForm();
    }

    addRow(): void {
        this.rows.push(
            this.fb.group<LayoutRowGroup>({
                rowId: this.fb.control<string | null>(null),
                rowIndex: this.fb.control(0, { nonNullable: true }),
                yStartNorm: this.fb.control(0, { nonNullable: true }),
                yEndNorm: this.fb.control(1, { nonNullable: true }),
                columns: this.fb.array([
                    this.fb.group<LayoutColumnGroup>({
                        columnId: this.fb.control<string | null>(null),
                        colIndex: this.fb.control(0, { nonNullable: true }),
                        xStartNorm: this.fb.control(0, { nonNullable: true }),
                        xEndNorm: this.fb.control(1, { nonNullable: true }),
                    }),
                ]),
            })
        );
        this.reindexRows();
    }

    addColumn(rowIndex: number): void {
        const columns = this.rows.at(rowIndex).controls.columns;
        columns.push(
            this.fb.group<LayoutColumnGroup>({
                columnId: this.fb.control<string | null>(null),
                colIndex: this.fb.control(columns.length, { nonNullable: true }),
                xStartNorm: this.fb.control(0, { nonNullable: true }),
                xEndNorm: this.fb.control(1, { nonNullable: true }),
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
    }

    saveLayout(): void {
        const shelf = this.shelf();
        if (!shelf) {
            return;
        }
        const rows: LayoutRowInput[] = this.rows.controls.map((row) => ({
            rowId: row.controls.rowId.value ?? undefined,
            rowIndex: row.controls.rowIndex.value,
            yStartNorm: row.controls.yStartNorm.value,
            yEndNorm: row.controls.yEndNorm.value,
            columns: row.controls.columns.controls.map((col) => ({
                columnId: col.controls.columnId.value ?? undefined,
                colIndex: col.controls.colIndex.value,
                xStartNorm: col.controls.xStartNorm.value,
                xEndNorm: col.controls.xEndNorm.value,
            } as LayoutColumnInput)),
        }));

        this.savingLayout.set(true);
        this.shelfService
            .updateLayout(shelf.shelf.id, rows)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (response) => {
                    this.shelf.set(response.shelf);
                    this.displaced.set(response.displaced);
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

    slotStyle(slot: ShelfSlot): Record<string, string> {
        return {
            left: `${slot.xStartNorm * 100}%`,
            top: `${slot.yStartNorm * 100}%`,
            width: `${(slot.xEndNorm - slot.xStartNorm) * 100}%`,
            height: `${(slot.yEndNorm - slot.yStartNorm) * 100}%`,
        };
    }

    assignedItems(slotId: string): PlacementWithItem[] {
        return (this.shelf()?.placements ?? []).filter((p) => p.placement.shelfSlotId === slotId);
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

    labelFor(itemId: string): string {
        const item = this.items().find((i) => i.id === itemId);
        if (!item) {
            return 'Unknown item';
        }
        return `${item.title} · ${this.itemTypeLabels[item.itemType]}`;
    }
}
