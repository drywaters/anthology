import { CommonModule } from '@angular/common';
import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    OnInit,
    Output,
    SimpleChanges,
    ViewChild,
    inject,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { BookStatus, BOOK_STATUS_LABELS, Item, ItemForm, ItemType, ITEM_TYPE_LABELS } from '../../models/item';

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
        MatDatepickerModule,
        MatNativeDateModule,
        ReactiveFormsModule,
    ],
    templateUrl: './item-form.component.html',
    styleUrl: './item-form.component.scss',
})
export class ItemFormComponent implements OnChanges, OnInit {
    private readonly fb = inject(FormBuilder);
    private static readonly MAX_COVER_BYTES = 500 * 1024;
    private static readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    private static readonly ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

    @ViewChild('coverInput') coverInput?: ElementRef<HTMLInputElement>;

    @Input() item: Item | null = null;
    @Input() draft: Partial<ItemForm> | null = null;
    @Input() mode: 'create' | 'edit' = 'create';
    @Input() busy = false;

	@Output() readonly save = new EventEmitter<ItemForm>();
	@Output() readonly cancelled = new EventEmitter<void>();
	@Output() readonly deleteRequested = new EventEmitter<void>();

	readonly itemTypeOptions = Object.entries(ITEM_TYPE_LABELS) as [ItemType, string][];
	readonly bookStatusOptions: Array<{ value: BookStatus; label: string }> = (
		Object.entries(BOOK_STATUS_LABELS) as [BookStatus, string][]
	).map(([value, label]) => ({
		value,
		label,
	}));

    coverImageError: string | null = null;

    readonly form: FormGroup = this.fb.group({
        title: ['', [Validators.required, Validators.maxLength(120)]],
        creator: ['', [Validators.maxLength(120)]],
        itemType: ['book' as ItemType, Validators.required],
        releaseYear: [null, [Validators.min(0)]],
        pageCount: [null, [Validators.min(1)]],
        currentPage: [null, [Validators.min(0)]],
        isbn13: ['', [Validators.maxLength(20)]],
        isbn10: ['', [Validators.maxLength(20)]],
        description: ['', [Validators.maxLength(2000)]],
        coverImage: [''],
        platform: ['', [Validators.maxLength(200)]],
        ageGroup: ['', [Validators.maxLength(100)]],
        playerCount: ['', [Validators.maxLength(100)]],
		readingStatus: [BookStatus.None],
        readAt: [null],
        notes: ['', [Validators.maxLength(500)]],
    });

    get isBook(): boolean {
        return this.form.get('itemType')?.value === 'book';
    }

    get isGame(): boolean {
        return this.form.get('itemType')?.value === 'game';
    }

    get isReadStatus(): boolean {
        return this.form.get('readingStatus')?.value === BookStatus.Read;
    }

    get isReadingStatus(): boolean {
        return this.form.get('readingStatus')?.value === BookStatus.Reading;
    }

    ngOnInit(): void {
        this.form
            .get('itemType')
            ?.valueChanges.subscribe((type: ItemType) => this.handleItemTypeChange(type));
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['item'] || changes['draft']) {
            const next: ItemForm = {
                title: '',
                creator: '',
                itemType: 'book',
                releaseYear: null,
                pageCount: null,
                currentPage: null,
                isbn13: '',
                isbn10: '',
                description: '',
				coverImage: '',
                platform: '',
                ageGroup: '',
                playerCount: '',
				readingStatus: BookStatus.None,
                readAt: null,
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

                const draftCurrentPage = this.draft.currentPage;
                if (draftCurrentPage === undefined || draftCurrentPage === null) {
                    next.currentPage = null;
                } else if (typeof draftCurrentPage === 'string') {
                    const parsed = Number.parseInt(draftCurrentPage, 10);
                    next.currentPage = Number.isNaN(parsed) ? null : parsed;
                } else {
                    next.currentPage = draftCurrentPage;
                }

                next.notes = this.draft.notes ?? next.notes;
                next.isbn13 = this.draft.isbn13 ?? next.isbn13;
                next.isbn10 = this.draft.isbn10 ?? next.isbn10;
                next.description = this.draft.description ?? next.description;
                next.coverImage = this.draft.coverImage ?? next.coverImage;
                next.platform = this.draft.platform ?? next.platform;
                next.ageGroup = this.draft.ageGroup ?? next.ageGroup;
                next.playerCount = this.draft.playerCount ?? next.playerCount;
                next.readingStatus = this.normalizeStatus(this.draft.readingStatus) ?? next.readingStatus;
                next.readAt = this.normalizeDateInput(this.draft.readAt) ?? next.readAt;
            }

            if (this.item) {
                next.title = this.item.title;
                next.creator = this.item.creator;
                next.itemType = this.item.itemType;
                next.releaseYear = this.item.releaseYear ?? null;
                next.pageCount = this.item.pageCount ?? null;
                next.currentPage = this.item.currentPage ?? null;
                next.isbn13 = this.item.isbn13 ?? '';
                next.isbn10 = this.item.isbn10 ?? '';
                next.description = this.item.description ?? '';
                next.coverImage = this.item.coverImage ?? '';
                next.platform = this.item.platform ?? '';
                next.ageGroup = this.item.ageGroup ?? '';
                next.playerCount = this.item.playerCount ?? '';
                next.notes = this.item.notes;
                next.readingStatus = this.normalizeStatus(this.item.readingStatus) ?? next.readingStatus;
                next.readAt = this.normalizeDateInput(this.item.readAt) ?? next.readAt;
            }

            if (next.readingStatus !== BookStatus.Read) {
                next.readAt = null;
            }
            if (next.readingStatus !== BookStatus.Reading) {
                next.currentPage = null;
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

        // Validate cover image URL
        const coverImageError = this.validateCoverImageUrl(value.coverImage);
        if (coverImageError) {
            this.coverImageError = coverImageError;
            return;
        }

        if (value.itemType === 'book' && value.readingStatus === BookStatus.Read && !value.readAt) {
            this.form.get('readAt')?.setErrors({ required: true });
            this.form.get('readAt')?.markAsTouched();
            return;
        }

        if (value.itemType === 'book' && value.readingStatus === BookStatus.Reading) {
            const totalPages = this.parseInteger(value.pageCount);
            const currentPageValue = this.parseInteger(value.currentPage);
            if (!this.ensureCurrentPageWithinTotal(totalPages, currentPageValue)) {
                return;
            }
        } else {
            this.ensureCurrentPageWithinTotal(null, null);
        }

		const readingStatus = value.itemType === 'book' ? value.readingStatus ?? BookStatus.None : undefined;
        const readAt = value.itemType === 'book' ? this.normalizeDateOutput(value.readAt) : null;
        const currentPage = value.itemType === 'book'
            ? value.readingStatus === BookStatus.Reading
                ? this.parseInteger(value.currentPage)
                : null
            : undefined;

        this.save.emit({
            ...value,
            releaseYear: value.releaseYear === null || value.releaseYear === undefined ? null : value.releaseYear,
            pageCount: value.pageCount === null || value.pageCount === undefined ? null : value.pageCount,
            currentPage,
            description: value.description ?? '',
            isbn13: value.isbn13 ?? '',
            isbn10: value.isbn10 ?? '',
            coverImage: value.coverImage ?? '',
            platform: value.platform ?? '',
            ageGroup: value.ageGroup ?? '',
            playerCount: value.playerCount ?? '',
            readingStatus,
            readAt,
        });
    }

    clearReleaseYear(): void {
        this.form.patchValue({ releaseYear: null });
    }

    clearPageCount(): void {
        this.form.patchValue({ pageCount: null });
        const current = this.parseInteger(this.form.get('currentPage')?.value ?? null);
        this.ensureCurrentPageWithinTotal(null, current);
    }

    clearCurrentPage(): void {
        this.form.patchValue({ currentPage: null });
        const currentPageControl = this.form.get('currentPage');
        const errors = currentPageControl?.errors;
        if (errors) {
            const { maxPages, ...rest } = errors as Record<string, unknown>;
            if (Object.keys(rest).length === 0) {
                currentPageControl?.setErrors(null);
            } else {
                currentPageControl?.setErrors(rest);
            }
        }
    }

    clearCoverImage(): void {
        this.form.patchValue({ coverImage: '' });
        this.coverImageError = null;
        this.resetCoverInput();
    }

    clearCoverError(): void {
        this.coverImageError = null;
    }

    onStatusChange(status: BookStatus): void {
        if (status !== BookStatus.Read) {
            this.form.patchValue({ readAt: null });
            this.form.get('readAt')?.setErrors(null);
        }
        if (status !== BookStatus.Reading) {
            this.clearCurrentPage();
        }
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

        const validationError = this.validateImageFile(file, ItemFormComponent.MAX_COVER_BYTES, '500KB');
        if (validationError) {
            this.coverImageError = validationError;
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

    private validateImageFile(file: File, maxBytes: number, maxSizeLabel: string): string | null {
        const fileName = file.name.toLowerCase();
        const hasValidExtension = ItemFormComponent.ALLOWED_IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
        if (!hasValidExtension) {
            return 'Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed.';
        }

        if (file.type && !ItemFormComponent.ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return 'Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed.';
        }

        if (file.size > maxBytes) {
            return `Cover images must be under ${maxSizeLabel}.`;
        }

        return null;
    }

    private resetCoverInput(): void {
        if (this.coverInput?.nativeElement) {
            this.coverInput.nativeElement.value = '';
        }
    }

    private normalizeDateInput(value: string | Date | null | undefined): Date | null {
        if (!value) {
            return null;
        }
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value;
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date;
    }

	private handleItemTypeChange(type: ItemType): void {
		if (type !== 'book') {
			this.form.patchValue({ readingStatus: BookStatus.None, readAt: null });
			this.form.get('readAt')?.setErrors(null);
			this.clearCurrentPage();
		}
    }

	private normalizeStatus(value: unknown): BookStatus | null {
				return this.isValidStatus(value) ? (value as BookStatus) : null;
	}

	private isValidStatus(value: unknown): value is BookStatus {
		return Object.values(BookStatus).includes(value as BookStatus);
	}

    private parseInteger(value: unknown): number | null {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }
        const parsed = Number.parseInt(String(value), 10);
        return Number.isNaN(parsed) ? null : parsed;
    }

    private ensureCurrentPageWithinTotal(totalPages: number | null, currentPage: number | null): boolean {
        const control = this.form.get('currentPage');
        if (!control) {
            return true;
        }

        const errors = control.errors ?? {};
        if (totalPages !== null && currentPage !== null && currentPage > totalPages) {
            control.setErrors({ ...errors, maxPages: true });
            control.markAsTouched();
            return false;
        }

        if ('maxPages' in errors) {
            const { maxPages, ...rest } = errors as Record<string, unknown>;
            if (Object.keys(rest).length === 0) {
                control.setErrors(null);
            } else {
                control.setErrors(rest);
            }
        }

        return true;
    }

    private normalizeDateOutput(value: unknown): string | null {
        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value.toISOString();
        }

        const date = new Date(value as string);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    private validateCoverImageUrl(coverImage: string | null | undefined): string | null {
        if (!coverImage || coverImage.trim() === '') {
            return null;
        }

        const trimmed = coverImage.trim();

        // Allow data URIs - MIME type validated by handleCoverFileChange for uploads,
        // server-side validation handles manually entered data URIs
        if (trimmed.startsWith('data:')) {
            return null;
        }

        // Block dangerous schemes
        const lowerTrimmed = trimmed.toLowerCase();
        if (lowerTrimmed.startsWith('javascript:') || lowerTrimmed.startsWith('vbscript:')) {
            return 'Invalid image URL scheme.';
        }

        // Validate URL format and require HTTPS
        try {
            const url = new URL(trimmed);
            if (url.protocol !== 'https:') {
                return 'Cover image URL must use HTTPS.';
            }
        } catch {
            return 'Cover image must be a valid URL or data URI.';
        }

        return null;
    }
}
