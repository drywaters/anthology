import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    Output,
    ViewChild,
    computed,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { CsvImportSummary } from '../../../models/import';

const CSV_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB - matches server limit
const CSV_ALLOWED_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel'];
const CSV_ALLOWED_EXTENSIONS = ['.csv'];

type CsvImportStatusLevel = 'info' | 'success' | 'warning' | 'error';

interface CsvImportStatus {
    level: CsvImportStatusLevel;
    icon: string;
    message: string;
}

@Component({
    selector: 'app-csv-import',
    standalone: true,
    imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
    templateUrl: './csv-import.component.html',
    styleUrl: './csv-import.component.scss',
})
export class CsvImportComponent {
    @Input({ required: true }) csvFields: string[] = [];
    @Input({ required: true }) csvTemplateUrl = '';
    @Input() importBusy = false;
    @Input() importSummary: CsvImportSummary | null = null;
    @Input() importError: string | null = null;

    @Output() fileSelected = new EventEmitter<File>();
    @Output() importSubmit = new EventEmitter<void>();
    @Output() cleared = new EventEmitter<void>();

    @ViewChild('csvInput') csvInput?: ElementRef<HTMLInputElement>;

    readonly selectedFile = signal<File | null>(null);

    readonly csvImportStatus = computed<CsvImportStatus | null>(() => {
        if (this.importBusy) {
            return {
                level: 'info',
                icon: 'autorenew',
                message: 'Importing CSV...',
            };
        }

        if (this.importError) {
            return {
                level: 'error',
                icon: 'error',
                message: this.importError,
            };
        }

        const summary = this.importSummary;
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

    handleFileChange(event: Event): void {
        const input = event.target as HTMLInputElement | null;
        const file = input?.files?.[0] ?? null;

        const validationError = this.validateCsvFile(file);
        if (validationError) {
            this.selectedFile.set(null);
            this.resetInput();
            return;
        }

        this.selectedFile.set(file);
        if (file) {
            this.fileSelected.emit(file);
        }
    }

    handleSubmit(event?: Event): void {
        event?.preventDefault();
        event?.stopPropagation();

        const fileFromInput = this.csvInput?.nativeElement?.files?.[0] ?? null;
        const file = this.selectedFile() ?? fileFromInput;
        if (!file || this.importBusy) {
            return;
        }

        const validationError = this.validateCsvFile(file);
        if (validationError) {
            return;
        }

        this.selectedFile.set(file);
        this.importSubmit.emit();
    }

    handleReset(): void {
        this.selectedFile.set(null);
        this.resetInput();
        this.cleared.emit();
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

    private resetInput(): void {
        if (this.csvInput?.nativeElement) {
            this.csvInput.nativeElement.value = '';
        }
    }

    clearSelectedFile(): void {
        this.selectedFile.set(null);
        this.resetInput();
    }
}
