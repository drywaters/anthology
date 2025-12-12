import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, NgZone, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, of, switchMap, firstValueFrom } from 'rxjs';

import { ItemFormComponent } from '../../components/item-form/item-form.component';
import { DuplicateDialogComponent, DuplicateDialogData, DuplicateDialogResult } from '../../components/duplicate-dialog/duplicate-dialog.component';
import { DuplicateMatch, ItemForm } from '../../models/item';
import { ItemService } from '../../services/item.service';
import { ItemLookupCategory, ItemLookupService } from '../../services/item-lookup.service';
import { CsvImportSummary } from '../../models/import';
import { BarcodeScannerService } from '../../services/barcode-scanner.service';

type SearchCategoryValue = ItemLookupCategory;

type CsvImportStatusLevel = 'info' | 'success' | 'warning' | 'error';

interface CsvImportStatus {
    level: CsvImportStatusLevel;
    icon: string;
    message: string;
}

interface SearchCategoryConfig {
    value: SearchCategoryValue;
    label: string;
    description: string;
    inputLabel: string;
    placeholder: string;
    itemType: ItemForm['itemType'];
    disabled?: boolean;
}

const CSV_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB - matches server limit
const CSV_ALLOWED_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel'];
const CSV_ALLOWED_EXTENSIONS = ['.csv'];

@Component({
    selector: 'app-add-item-page',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatCardModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatRadioModule,
        MatSnackBarModule,
        MatTabsModule,
        ReactiveFormsModule,
        RouterModule,
        ItemFormComponent,
    ],
    templateUrl: './add-item-page.component.html',
    styleUrl: './add-item-page.component.scss',
})
export class AddItemPageComponent {
    private static readonly SEARCH_CATEGORIES: SearchCategoryConfig[] = [
        {
            value: 'book',
            label: 'Book',
            description: 'Search by ISBN or keyword to auto-fill book details.',
            inputLabel: 'Search for books',
            placeholder: 'ISBN or title keyword',
            itemType: 'book',
        },
        {
            value: 'game',
            label: 'Game',
            description: 'Look up tabletop or video releases by UPC or title.',
            inputLabel: 'Search for games',
            placeholder: 'UPC or title keyword',
            itemType: 'game',
            disabled: true,
        },
        {
            value: 'movie',
            label: 'Movie',
            description: 'Use UPC or keywords to find film metadata.',
            inputLabel: 'Search for movies',
            placeholder: 'UPC or title keyword',
            itemType: 'movie',
            disabled: true,
        },
        {
            value: 'music',
            label: 'Music',
            description: 'Find album details with UPC or artist keywords.',
            inputLabel: 'Search for music',
            placeholder: 'UPC or title keyword',
            itemType: 'music',
            disabled: true,
        },
    ];

    private static readonly MANUAL_ENTRY_TAB_INDEX = 1;
    private static readonly CSV_IMPORT_TAB_INDEX = 2;
    private static readonly CSV_FIELDS = [
        'title',
        'creator',
        'itemType',
        'releaseYear',
        'pageCount',
        'isbn13',
        'isbn10',
        'description',
        'coverImage',
        'notes',
        'platform',
        'ageGroup',
        'playerCount',
    ];

    private readonly itemService = inject(ItemService);
    private readonly itemLookupService = inject(ItemLookupService);
    private readonly router = inject(Router);
    private readonly snackBar = inject(MatSnackBar);
    private readonly dialog = inject(MatDialog);
    private readonly destroyRef = inject(DestroyRef);
    private readonly fb = inject(FormBuilder);
    private readonly barcodeScanner = inject(BarcodeScannerService);
    private readonly ngZone = inject(NgZone);

    @ViewChild('scanVideo') scanVideo?: ElementRef<HTMLVideoElement>;
    @ViewChild('csvInput') csvInput?: ElementRef<HTMLInputElement>;

    readonly busy = signal(false);
    readonly lookupBusy = signal(false);
    readonly lookupError = signal<string | null>(null);
    readonly lookupResults = signal<ItemForm[]>([]);
    readonly manualDraft = signal<ItemForm | null>(null);
    readonly manualDraftSource = signal<{ query: string; label: string } | null>(null);
    readonly lastLookupSummary = signal<string | null>(null);
    readonly selectedTab = signal(0);
    readonly importBusy = signal(false);
    readonly importError = signal<string | null>(null);
    readonly importSummary = signal<CsvImportSummary | null>(null);
    readonly selectedCsvFile = signal<File | null>(null);
    readonly scannerActive = computed(() => this.barcodeScanner.scannerActive());
    readonly scannerStatus = computed(() => this.barcodeScanner.scannerStatus());
    readonly scannerError = computed(() => this.barcodeScanner.scannerError());
    readonly scannerSupported = computed(() => this.barcodeScanner.scannerSupported());
    readonly scannerHint = computed(() => this.barcodeScanner.scannerHint());
    readonly scannerProcessing = computed(() => this.barcodeScanner.scannerProcessing());
    readonly scannerFlash = computed(() => this.barcodeScanner.scannerFlash());
    readonly scannerReady = computed(() => this.barcodeScanner.scannerReady());
    readonly csvImportStatus = computed<CsvImportStatus | null>(() => {
        if (this.importBusy()) {
            return {
                level: 'info',
                icon: 'autorenew',
                message: 'Importing CSV...',
            };
        }

        const error = this.importError();
        if (error) {
            return {
                level: 'error',
                icon: 'error',
                message: error,
            };
        }

        const summary = this.importSummary();
        if (summary) {
            const totalRows = summary.totalRows ?? 0;
            const imported = summary.imported ?? 0;
            const notImported = Math.max(totalRows - imported, 0);
            const baseMessage = `Imported ${imported} of ${totalRows} rows.`;

            if (notImported > 0) {
                return {
                    level: 'warning',
                    icon: 'error_outline',
                    message: `${baseMessage} Not imported ${notImported} rows.`,
                };
            }

            return {
                level: 'success',
                icon: 'check_circle',
                message: baseMessage,
            };
        }

        return null;
    });

    readonly searchCategories = AddItemPageComponent.SEARCH_CATEGORIES;
    readonly csvFields = AddItemPageComponent.CSV_FIELDS;
    readonly csvTemplateUrl = '/csv-import-template.csv';

    readonly searchForm = this.fb.group({
        category: [AddItemPageComponent.SEARCH_CATEGORIES[0].value as SearchCategoryValue, Validators.required],
        query: ['', [Validators.required, Validators.minLength(3)]],
    });

    constructor() {
        this.destroyRef.onDestroy(() => this.stopBarcodeScanner());
    }

    readonly activeCategory = computed(() => {
        const value = this.searchForm.get('category')?.value as SearchCategoryValue | null;
        return (
            AddItemPageComponent.SEARCH_CATEGORIES.find((category) => category.value === value) ??
            AddItemPageComponent.SEARCH_CATEGORIES[0]
        );
    });

    async startBarcodeScan(): Promise<void> {
        if (this.scannerActive()) {
            return;
        }

        const video = await this.waitForScanVideoElement();
        if (!video) {
            this.barcodeScanner.scannerError.set('Camera preview is not available.');
            return;
        }

        await this.barcodeScanner.startScanner(video, (result) => {
            this.ngZone.run(() => {
                this.handleDetectedBarcode(result.rawValue);
            });
        });
    }

    handleDetectedBarcode(rawValue: string): void {
        const value = rawValue.trim();
        if (!value) {
            return;
        }

        this.searchForm.get('query')?.setValue(value);
        this.handleLookupSubmit('scanner');
    }

    stopBarcodeScanner(): void {
        this.barcodeScanner.stopScanner();
    }

    private async waitForScanVideoElement(): Promise<HTMLVideoElement | null> {
        if (this.scanVideo?.nativeElement) {
            return this.scanVideo.nativeElement;
        }

        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return this.scanVideo?.nativeElement ?? null;
    }

    async handleSave(formValue: ItemForm): Promise<void> {
        if (this.busy()) {
            return;
        }

        this.busy.set(true);

        try {
            const duplicates = await firstValueFrom(
                this.itemService.checkDuplicates({
                    title: formValue.title,
                    isbn13: formValue.isbn13,
                    isbn10: formValue.isbn10,
                }).pipe(
                    takeUntilDestroyed(this.destroyRef),
                    catchError((error) => {
                        console.warn('Duplicate check failed', error);
                        this.snackBar.open('Duplicate check failed; proceeding may create duplicates.', 'Dismiss', {
                            duration: 4000,
                        });
                        return of([] as DuplicateMatch[]);
                    })
                )
            );

            if (duplicates.length > 0) {
                const dialogRef = this.dialog.open<
                    DuplicateDialogComponent,
                    DuplicateDialogData,
                    DuplicateDialogResult
                >(DuplicateDialogComponent, {
                    data: {
                        duplicates,
                        totalCount: duplicates.length,
                    },
                    width: '480px',
                    maxHeight: '90vh',
                });

                const decision = await firstValueFrom(dialogRef.afterClosed());
                if (decision !== 'add') {
                    return;
                }
            }

            const item = await firstValueFrom(
                this.itemService.create(formValue).pipe(takeUntilDestroyed(this.destroyRef))
            );
            if (item) {
                this.snackBar.open(`Saved "${item.title}"`, 'Dismiss', { duration: 4000 });
                await this.router.navigate(['/']);
            }
        } catch (error) {
            console.error('Failed to save item', error);
            this.snackBar.open('We could not save the item. Double-check required fields.', 'Dismiss', {
                duration: 5000,
            });
        } finally {
            this.busy.set(false);
        }
    }

    handleCancel(): void {
        if (!this.busy()) {
            this.router.navigate(['/']);
        }
    }

    handleLookupSubmit(source: 'manual' | 'scanner' = 'manual'): void {
        if (this.lookupBusy()) {
            return;
        }

        if (source === 'manual') {
            this.stopBarcodeScanner();
        }

        if (this.searchForm.invalid) {
            this.searchForm.markAllAsTouched();
            if (source === 'scanner') {
                this.barcodeScanner.reportScanFailure('That barcode was not valid. Try again or type the ISBN.');
            }
            return;
        }

        const rawCategory = this.searchForm.get('category')?.value as SearchCategoryValue | null;
        const rawQuery = this.searchForm.get('query')?.value ?? '';
        const query = rawQuery.trim();

        if (!rawCategory || !query) {
            this.searchForm.get('query')?.setErrors({ required: true });
            if (source === 'scanner') {
                this.barcodeScanner.reportScanFailure('That barcode was not valid. Try again or type the ISBN.');
            }
            return;
        }

        const category = this.getCategoryConfig(rawCategory);

        this.lookupBusy.set(true);
        this.lookupError.set(null);
        this.lookupResults.set([]);
        this.lastLookupSummary.set(null);

        this.itemLookupService
            .lookup(query, rawCategory)
            .pipe(
                takeUntilDestroyed(this.destroyRef),
                finalize(() => {
                    this.lookupBusy.set(false);
                    if (source === 'scanner') {
                        this.stopBarcodeScanner();
                    }
                })
            )
            .subscribe({
                next: (results) => {
                    const drafts = results.map((partial) => this.composeDraft(partial, category));
                    this.lookupResults.set(drafts);
                    if (drafts.length > 0) {
                        if (source === 'scanner') {
                            const title = drafts[0].title?.trim() ? drafts[0].title.trim() : query;
                            this.barcodeScanner.reportScanSuccess(title);
                        }
                        this.manualDraft.set({ ...drafts[0] });
                        this.manualDraftSource.set({
                            query,
                            label: category.label,
                        });
                        if (source !== 'scanner') {
                            const summary =
                                drafts.length > 1
                                    ? `Loaded ${drafts.length} matches for “${query}”. Choose one below.`
                                    : `Metadata loaded for “${query}”.`;
                            this.lastLookupSummary.set(summary);
                        }
                    } else {
                        this.manualDraft.set(null);
                        this.manualDraftSource.set(null);
                        this.lastLookupSummary.set(null);
                    }
                },
                error: (error) => {
                    this.manualDraft.set(null);
                    this.manualDraftSource.set(null);
                    this.lookupResults.set([]);

                    let message = 'We couldn\'t find a match. Try another ISBN.';
                    if (error instanceof HttpErrorResponse) {
                        const serverMessage = typeof error.error?.error === 'string' ? error.error.error.trim() : '';
                        if (serverMessage) {
                            message = serverMessage;
                        } else if (error.status === 404) {
                            message = 'We couldn\'t find a match. Try another ISBN.';
                        }
                    }

                    this.lookupError.set(message);
                },
            });
    }

    handleTabChange(index: number): void {
        this.selectedTab.set(index);
    }

    clearManualDraft(): void {
        this.manualDraft.set(null);
        this.manualDraftSource.set(null);
        this.lookupResults.set([]);
    }

    handleQuickAdd(preview: ItemForm): void {
        if (!preview || this.busy()) {
            return;
        }

        // handleSave already handles duplicate checking
        this.handleSave({ ...preview });
    }

    handleUseForManual(preview: ItemForm): void {
        if (!preview) {
            return;
        }

        const source = this.manualDraftSource();
        this.manualDraft.set({ ...preview });
        if (source) {
            this.manualDraftSource.set({ ...source });
        }
        this.selectedTab.set(AddItemPageComponent.MANUAL_ENTRY_TAB_INDEX);
    }

    handleCsvFileChange(event: Event): void {
        const input = event.target as HTMLInputElement | null;
        const file = input?.files?.[0] ?? null;

        this.importError.set(null);
        this.importSummary.set(null);

        const validationError = this.validateCsvFile(file);
        if (validationError) {
            this.selectedCsvFile.set(null);
            this.importError.set(validationError);
            this.resetCsvInput();
            this.activateCsvImportTab();
            return;
        }

        this.selectedCsvFile.set(file);
        this.activateCsvImportTab();
    }

    private validateCsvFile(file: File | null): string | null {
        if (!file) {
            return null;
        }

        const fileName = file.name.toLowerCase();
        const hasValidExtension = CSV_ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
        if (!hasValidExtension) {
            return 'Only CSV files are allowed.';
        }

        if (file.type && !CSV_ALLOWED_MIME_TYPES.includes(file.type)) {
            return 'Only CSV files are allowed.';
        }

        if (file.size > CSV_MAX_FILE_SIZE_BYTES) {
            const maxSizeMB = CSV_MAX_FILE_SIZE_BYTES / (1024 * 1024);
            return `File size exceeds ${maxSizeMB} MB limit.`;
        }

        return null;
    }

    handleImportSubmit(event?: Event): void {
        event?.preventDefault();
        event?.stopPropagation();

        const fileFromInput = this.csvInput?.nativeElement?.files?.[0] ?? null;
        const file = this.selectedCsvFile() ?? fileFromInput;
        if (!file || this.importBusy()) {
            return;
        }

        const validationError = this.validateCsvFile(file);
        if (validationError) {
            this.importError.set(validationError);
            this.activateCsvImportTab();
            return;
        }

        this.selectedCsvFile.set(file);

        this.activateCsvImportTab();

        this.importBusy.set(true);
        this.importError.set(null);
        this.importSummary.set(null);

        this.itemService
            .importCsv(file)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .pipe(finalize(() => this.importBusy.set(false)))
            .subscribe({
                next: (summary: CsvImportSummary) => {
                    const normalizedSummary: CsvImportSummary = {
                        ...summary,
                        skippedDuplicates: summary.skippedDuplicates ?? [],
                        failed: summary.failed ?? [],
                    };
                    this.importSummary.set(normalizedSummary);
                    this.selectedCsvFile.set(null);
                    this.resetCsvInput();
                    this.activateCsvImportTab();
                },
                error: (error) => {
                    let message = 'Import failed. Confirm the CSV matches the template.';
                    if (error instanceof HttpErrorResponse) {
                        const serverMessage =
                            typeof error.error?.error === 'string' ? error.error.error.trim() : '';
                        if (serverMessage) {
                            message = serverMessage;
                        }
                    }
                    this.importError.set(message);
                    this.activateCsvImportTab();
                },
            });
    }

    handleImportReset(): void {
        this.selectedCsvFile.set(null);
        this.importSummary.set(null);
        this.importError.set(null);
        this.resetCsvInput();
        this.activateCsvImportTab();
    }

    private resetCsvInput(): void {
        if (this.csvInput?.nativeElement) {
            this.csvInput.nativeElement.value = '';
        }
    }

    private activateCsvImportTab(): void {
        this.selectedTab.set(AddItemPageComponent.CSV_IMPORT_TAB_INDEX);
    }

    private getCategoryConfig(value: SearchCategoryValue): SearchCategoryConfig {
        return (
            AddItemPageComponent.SEARCH_CATEGORIES.find((category) => category.value === value) ??
            AddItemPageComponent.SEARCH_CATEGORIES[0]
        );
    }

    private composeDraft(partial: Partial<ItemForm>, category: SearchCategoryConfig): ItemForm {
        const releaseYear = partial.releaseYear;
        let normalizedReleaseYear: number | null = null;
        const pageCount = partial.pageCount;
        let normalizedPageCount: number | null = null;
        const retailPriceUsd = partial.retailPriceUsd;
        let normalizedRetailPriceUsd: number | null = null;

        if (typeof releaseYear === 'number') {
            normalizedReleaseYear = releaseYear;
        } else if (typeof releaseYear === 'string') {
            const parsed = Number.parseInt(releaseYear, 10);
            normalizedReleaseYear = Number.isNaN(parsed) ? null : parsed;
        }

        if (typeof pageCount === 'number') {
            normalizedPageCount = pageCount;
        } else if (typeof pageCount === 'string') {
            const parsed = Number.parseInt(pageCount, 10);
            normalizedPageCount = Number.isNaN(parsed) ? null : parsed;
        }

        if (typeof retailPriceUsd === 'number') {
            normalizedRetailPriceUsd = retailPriceUsd;
        } else if (typeof retailPriceUsd === 'string') {
            const parsed = Number.parseFloat(retailPriceUsd);
            normalizedRetailPriceUsd = Number.isNaN(parsed) ? null : parsed;
        }

        return {
            title: partial.title ?? '',
            creator: partial.creator ?? '',
            itemType: category.itemType,
            releaseYear: normalizedReleaseYear,
            pageCount: normalizedPageCount,
            isbn13: partial.isbn13 ?? '',
            isbn10: partial.isbn10 ?? '',
            description: partial.description ?? '',
            coverImage: partial.coverImage ?? '',
            genre: partial.genre,
            retailPriceUsd: normalizedRetailPriceUsd,
            googleVolumeId: partial.googleVolumeId ?? '',
            platform: partial.platform ?? '',
            ageGroup: partial.ageGroup ?? '',
            playerCount: partial.playerCount ?? '',
            notes: partial.notes ?? '',
        };
    }
}
