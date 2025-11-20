import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs/operators';

import { ItemFormComponent } from '../../components/item-form/item-form.component';
import { ItemForm } from '../../models/item';
import { ItemService } from '../../services/item.service';
import { ItemLookupCategory, ItemLookupService } from '../../services/item-lookup.service';
import { CsvImportSummary } from '../../models/import';

type SearchCategoryValue = ItemLookupCategory;

type CsvImportStatusLevel = 'info' | 'success' | 'warning' | 'error';

type SupportedBarcodeFormat = 'ean_13' | 'ean_8' | 'code_128' | 'upc_a' | 'upc_e';

interface BarcodeDetectionResult {
    rawValue?: string;
}

interface BarcodeDetectorOptions {
    formats?: SupportedBarcodeFormat[];
}

interface BarcodeDetector {
    detect(source: ImageBitmapSource): Promise<BarcodeDetectionResult[]>;
}

interface BarcodeDetectorConstructor {
    new (options?: BarcodeDetectorOptions): BarcodeDetector;
    getSupportedFormats(): Promise<SupportedBarcodeFormat[]>;
}

declare const BarcodeDetector: BarcodeDetectorConstructor;

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

@Component({
    selector: 'app-add-item-page',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatCardModule,
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
            placeholder: 'ISBN, UPC, or title keyword',
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
    ];

    private readonly itemService = inject(ItemService);
    private readonly itemLookupService = inject(ItemLookupService);
    private readonly router = inject(Router);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);
    private readonly fb = inject(FormBuilder);

    private readonly preferredBarcodeFormats: SupportedBarcodeFormat[] = [
        'ean_13',
        'ean_8',
        'code_128',
        'upc_a',
        'upc_e',
    ];
    private barcodeDetector: BarcodeDetector | null = null;
    private scanStream: MediaStream | null = null;
    private scanFrameId: number | null = null;

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
    readonly scannerActive = signal(false);
    readonly scannerStatus = signal<string | null>(null);
    readonly scannerError = signal<string | null>(null);
    readonly scannerSupported = signal<boolean | null>(null);
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

        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            this.scannerSupported.set(false);
            this.scannerError.set('Camera access is not available in this browser.');
            return;
        }

        this.scannerError.set(null);
        this.scannerStatus.set('Checking camera support...');

        const detector = await this.resolveBarcodeDetector();
        if (!detector) {
            return;
        }

        const video = this.scanVideo?.nativeElement;
        if (!video) {
            this.scannerError.set('Camera preview is not available.');
            return;
        }

        try {
            this.scanStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false,
            });

            video.srcObject = this.scanStream;
            await video.play();

            this.barcodeDetector = detector;
            this.scannerActive.set(true);
            this.scannerStatus.set('Align a UPC or ISBN barcode within the frame.');
            this.scheduleNextScan();
        } catch (error) {
            console.error('Unable to start barcode scanner', error);
            this.scannerError.set('Camera access failed. Confirm permissions and try again.');
            this.scannerStatus.set(null);
            this.stopScannerStream();
        }
    }

    private scheduleNextScan(): void {
        this.scanFrameId = requestAnimationFrame(() => {
            void this.detectBarcodeFrame();
        });
    }

    private async detectBarcodeFrame(): Promise<void> {
        if (!this.scannerActive() || !this.barcodeDetector) {
            return;
        }

        const video = this.scanVideo?.nativeElement;
        if (!video) {
            this.stopBarcodeScanner();
            return;
        }

        if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
            this.scheduleNextScan();
            return;
        }

        try {
            const codes = await this.barcodeDetector.detect(video);
            const found = codes.find((code: BarcodeDetectionResult) => (code.rawValue ?? '').trim());

            if (found?.rawValue) {
                this.scannerStatus.set(`Found ${found.rawValue}. Searching...`);
                this.handleDetectedBarcode(found.rawValue);
                return;
            }
        } catch (error) {
            console.error('Barcode detection failed', error);
            this.scannerError.set('Unable to read the barcode. Try adjusting lighting or typing the code.');
            this.stopBarcodeScanner();
            return;
        }

        this.scheduleNextScan();
    }

    handleDetectedBarcode(rawValue: string): void {
        const value = rawValue.trim();
        if (!value) {
            return;
        }

        this.searchForm.get('query')?.setValue(value);
        this.stopBarcodeScanner();
        this.handleLookupSubmit();
    }

    stopBarcodeScanner(): void {
        this.scannerActive.set(false);
        this.scannerStatus.set(null);
        this.clearScannerAnimation();
        this.stopScannerStream();

        const video = this.scanVideo?.nativeElement;
        if (video) {
            video.pause();
            video.srcObject = null;
        }
    }

    private stopScannerStream(): void {
        if (this.scanStream) {
            this.scanStream.getTracks().forEach((track) => track.stop());
            this.scanStream = null;
        }
    }

    private clearScannerAnimation(): void {
        if (this.scanFrameId !== null) {
            cancelAnimationFrame(this.scanFrameId);
            this.scanFrameId = null;
        }
    }

    private async resolveBarcodeDetector(): Promise<BarcodeDetector | null> {
        if (typeof window === 'undefined' || typeof BarcodeDetector === 'undefined') {
            this.scannerSupported.set(false);
            this.scannerError.set('Barcode scanning is not supported in this browser.');
            this.scannerStatus.set(null);
            return null;
        }

        try {
            const supportedFormats = await BarcodeDetector.getSupportedFormats();
            const availableFormats = this.preferredBarcodeFormats.filter((format) =>
                supportedFormats.includes(format)
            );

            if (!availableFormats.length) {
                this.scannerSupported.set(false);
                this.scannerError.set('No compatible barcode formats are supported by this camera.');
                this.scannerStatus.set(null);
                return null;
            }

            this.scannerSupported.set(true);
            return new BarcodeDetector({ formats: availableFormats });
        } catch (error) {
            console.error('Barcode detector unavailable', error);
            this.scannerSupported.set(false);
            this.scannerError.set('Barcode scanning is not available on this device.');
            this.scannerStatus.set(null);
            return null;
        }
    }

    handleSave(formValue: ItemForm): void {
        if (this.busy()) {
            return;
        }

        this.busy.set(true);
        this.itemService
            .create(formValue)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (item) => {
                    this.busy.set(false);
                    this.snackBar.open(`Saved “${item.title}”`, 'Dismiss', { duration: 4000 });
                    this.router.navigate(['/']);
                },
                error: () => {
                    this.busy.set(false);
                    this.snackBar.open('We could not save the item. Double-check required fields.', 'Dismiss', {
                        duration: 5000,
                    });
                },
            });
    }

    handleCancel(): void {
        if (!this.busy()) {
            this.router.navigate(['/']);
        }
    }

    handleLookupSubmit(): void {
        if (this.lookupBusy()) {
            return;
        }

        this.stopBarcodeScanner();

        if (this.searchForm.invalid) {
            this.searchForm.markAllAsTouched();
            return;
        }

        const rawCategory = this.searchForm.get('category')?.value as SearchCategoryValue | null;
        const rawQuery = this.searchForm.get('query')?.value ?? '';
        const query = rawQuery.trim();

        if (!rawCategory || !query) {
            this.searchForm.get('query')?.setErrors({ required: true });
            return;
        }

        const category = this.getCategoryConfig(rawCategory);

        this.lookupBusy.set(true);
        this.lookupError.set(null);
        this.lookupResults.set([]);
        this.lastLookupSummary.set(null);

        this.itemLookupService
            .lookup(query, rawCategory)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (results) => {
                    this.lookupBusy.set(false);
                    const drafts = results.map((partial) => this.composeDraft(partial, category));
                    this.lookupResults.set(drafts);
                    if (drafts.length > 0) {
                        this.manualDraft.set({ ...drafts[0] });
                        this.manualDraftSource.set({
                            query,
                            label: category.label,
                        });
                        const summary =
                            drafts.length > 1
                                ? `Loaded ${drafts.length} matches for “${query}”. Choose one below.`
                                : `Metadata loaded for “${query}”.`;
                        this.lastLookupSummary.set(summary);
                    } else {
                        this.manualDraft.set(null);
                        this.manualDraftSource.set(null);
                        this.lastLookupSummary.set(null);
                    }
                },
                error: (error) => {
                    this.lookupBusy.set(false);
                    this.manualDraft.set(null);
                    this.manualDraftSource.set(null);
                    this.lookupResults.set([]);

                    let message = 'We couldn’t find a match. Try another ISBN or UPC.';
                    if (error instanceof HttpErrorResponse) {
                        const serverMessage = typeof error.error?.error === 'string' ? error.error.error.trim() : '';
                        if (serverMessage) {
                            message = serverMessage;
                        } else if (error.status === 404) {
                            message = 'We couldn’t find a match. Try another ISBN or UPC.';
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
        if (!preview) {
            return;
        }

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
        this.selectedCsvFile.set(file);
        this.importError.set(null);
        this.importSummary.set(null);
        this.activateCsvImportTab();
    }

    handleImportSubmit(event?: Event): void {
        event?.preventDefault();
        event?.stopPropagation();

        const fileFromInput = this.csvInput?.nativeElement?.files?.[0] ?? null;
        const file = this.selectedCsvFile() ?? fileFromInput;
        if (!file || this.importBusy()) {
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
            notes: partial.notes ?? '',
        };
    }
}
