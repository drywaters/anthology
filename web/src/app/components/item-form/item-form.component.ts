import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
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
    private static readonly MAX_COVER_BYTES = 500 * 1024;

    @ViewChild('coverInput') coverInput?: ElementRef<HTMLInputElement>;

    @Input() item: Item | null = null;
    @Input() draft: Partial<ItemForm> | null = null;
    @Input() mode: 'create' | 'edit' = 'create';
    @Input() busy = false;

@Output() readonly save = new EventEmitter<ItemForm>();
@Output() readonly cancelled = new EventEmitter<void>();
@Output() readonly deleteRequested = new EventEmitter<void>();

    readonly itemTypeOptions = Object.entries(ITEM_TYPE_LABELS) as [ItemType, string][];

    coverImageError: string | null = null;

    readonly form: FormGroup = this.fb.group({
        title: ['', [Validators.required, Validators.maxLength(120)]],
        creator: ['', [Validators.maxLength(120)]],
        itemType: ['book' as ItemType, Validators.required],
        releaseYear: [null, [Validators.min(0)]],
        pageCount: [null, [Validators.min(1)]],
        isbn13: ['', [Validators.maxLength(20)]],
        isbn10: ['', [Validators.maxLength(20)]],
        description: ['', [Validators.maxLength(2000)]],
        coverImage: [''],
        notes: ['', [Validators.maxLength(500)]],
    });

    get isBook(): boolean {
        return this.form.get('itemType')?.value === 'book';
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['item'] || changes['draft']) {
            const next: ItemForm = {
                title: '',
                creator: '',
                itemType: 'book',
                releaseYear: null,
                pageCount: null,
                isbn13: '',
                isbn10: '',
                description: '',
                coverImage: '',
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

                const draftPageCount = this.draft.pageCount;
                if (draftPageCount === undefined || draftPageCount === null) {
                    next.pageCount = null;
                } else if (typeof draftPageCount === 'string') {
                    const parsed = Number.parseInt(draftPageCount, 10);
                    next.pageCount = Number.isNaN(parsed) ? null : parsed;
                } else {
                    next.pageCount = draftPageCount;
                }

                next.notes = this.draft.notes ?? next.notes;
                next.isbn13 = this.draft.isbn13 ?? next.isbn13;
                next.isbn10 = this.draft.isbn10 ?? next.isbn10;
                next.description = this.draft.description ?? next.description;
                next.coverImage = this.draft.coverImage ?? next.coverImage;
            }

            if (this.item) {
                next.title = this.item.title;
                next.creator = this.item.creator;
                next.itemType = this.item.itemType;
                next.releaseYear = this.item.releaseYear ?? null;
                next.pageCount = this.item.pageCount ?? null;
                next.isbn13 = this.item.isbn13 ?? '';
                next.isbn10 = this.item.isbn10 ?? '';
                next.description = this.item.description ?? '';
                next.coverImage = this.item.coverImage ?? '';
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
            pageCount: value.pageCount === null || value.pageCount === undefined ? null : value.pageCount,
            description: value.description ?? '',
            isbn13: value.isbn13 ?? '',
            isbn10: value.isbn10 ?? '',
            coverImage: value.coverImage ?? '',
        });
    }

    clearReleaseYear(): void {
        this.form.patchValue({ releaseYear: null });
    }

    clearPageCount(): void {
        this.form.patchValue({ pageCount: null });
    }

    clearCoverImage(): void {
        this.form.patchValue({ coverImage: '' });
        this.coverImageError = null;
        this.resetCoverInput();
    }

    clearCoverError(): void {
        this.coverImageError = null;
    }

    openCoverFilePicker(): void {
        this.coverImageError = null;
        this.coverInput?.nativeElement?.click();
    }

    handleCoverFileChange(event: Event): void {
        const input = event.target as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!file) {
            return;
        }

        if (file.size > ItemFormComponent.MAX_COVER_BYTES) {
            this.coverImageError = 'Cover images must be under 500KB.';
            this.resetCoverInput();
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            this.form.patchValue({ coverImage: result });
            this.coverImageError = null;
        };
        reader.readAsDataURL(file);
    }

    private resetCoverInput(): void {
        if (this.coverInput?.nativeElement) {
            this.coverInput.nativeElement.value = '';
        }
    }
}
