import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { Item, ItemForm, ItemType, ITEM_TYPE_LABELS } from '../../models/item';

@Component({
    selector: 'app-item-form',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        ReactiveFormsModule,
    ],
    templateUrl: './item-form.component.html',
    styleUrl: './item-form.component.scss',
})
export class ItemFormComponent implements OnChanges {
    private readonly fb = inject(FormBuilder);

    @Input() item: Item | null = null;
    @Input() draft: Partial<ItemForm> | null = null;
    @Input() mode: 'create' | 'edit' = 'create';
    @Input() busy = false;

    @Output() readonly save = new EventEmitter<ItemForm>();
    @Output() readonly cancelled = new EventEmitter<void>();

    readonly itemTypeOptions = Object.entries(ITEM_TYPE_LABELS) as [ItemType, string][];

    readonly form: FormGroup = this.fb.group({
        title: ['', [Validators.required, Validators.maxLength(120)]],
        creator: ['', [Validators.maxLength(120)]],
        itemType: ['book' as ItemType, Validators.required],
        releaseYear: [null, [Validators.min(0)]],
        notes: ['', [Validators.maxLength(500)]],
    });

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['item'] || changes['draft']) {
            const next: ItemForm = {
                title: '',
                creator: '',
                itemType: 'book',
                releaseYear: null,
                notes: '',
            };

            if (this.draft) {
                next.title = this.draft.title ?? next.title;
                next.creator = this.draft.creator ?? next.creator;
                next.itemType = this.draft.itemType ?? next.itemType;

                const draftReleaseYear = this.draft.releaseYear;
                if (draftReleaseYear === undefined || draftReleaseYear === null) {
                    next.releaseYear = null;
                } else if (typeof draftReleaseYear === 'string') {
                    const parsed = Number.parseInt(draftReleaseYear, 10);
                    next.releaseYear = Number.isNaN(parsed) ? null : parsed;
                } else {
                    next.releaseYear = draftReleaseYear;
                }

                next.notes = this.draft.notes ?? next.notes;
            }

            if (this.item) {
                next.title = this.item.title;
                next.creator = this.item.creator;
                next.itemType = this.item.itemType;
                next.releaseYear = this.item.releaseYear ?? null;
                next.notes = this.item.notes;
            }

            this.form.reset(next);
        }
    }

    submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const value = this.form.value as ItemForm;
        this.save.emit({
            ...value,
            releaseYear: value.releaseYear === null || value.releaseYear === undefined ? null : value.releaseYear,
        });
    }

    clearReleaseYear(): void {
        this.form.patchValue({ releaseYear: null });
    }
}
