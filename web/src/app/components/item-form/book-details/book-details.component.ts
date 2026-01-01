import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { BookStatus, Format, Genre } from '../../../models';

@Component({
    selector: 'app-book-details',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatNativeDateModule,
        MatSelectModule,
        ReactiveFormsModule,
    ],
    templateUrl: './book-details.component.html',
    styleUrl: './book-details.component.scss',
})
export class BookDetailsComponent {
    @Input({ required: true }) form!: FormGroup;
    @Input() bookStatusOptions: Array<{ value: BookStatus; label: string }> = [];
    @Input() formatOptions: Array<{ value: Format; label: string }> = [];
    @Input() genreOptions: Array<{ value: Genre | ''; label: string }> = [];

    get isReadStatus(): boolean {
        return this.form.get('readingStatus')?.value === BookStatus.Read;
    }

    get isReadingStatus(): boolean {
        return this.form.get('readingStatus')?.value === BookStatus.Reading;
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

    clearRating(): void {
        this.form.patchValue({ rating: null });
    }

    clearRetailPrice(): void {
        this.form.patchValue({ retailPriceUsd: null });
    }

    clearSeriesName(): void {
        this.form.patchValue({ seriesName: '' });
    }

    clearVolumeNumber(): void {
        this.form.patchValue({ volumeNumber: null });
        this.form.get('volumeNumber')?.setErrors(null);
    }

    clearTotalVolumes(): void {
        this.form.patchValue({ totalVolumes: null });
        this.form.get('totalVolumes')?.setErrors(null);
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

    private ensureCurrentPageWithinTotal(
        totalPages: number | null,
        currentPage: number | null,
    ): boolean {
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
}
