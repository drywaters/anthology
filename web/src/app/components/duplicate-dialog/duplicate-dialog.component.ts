import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { DuplicateMatch } from '../../models/item';

export interface DuplicateDialogData {
    duplicates: DuplicateMatch[];
    totalCount: number;
}

export type DuplicateDialogResult = 'add' | 'cancel';

@Component({
    selector: 'app-duplicate-dialog',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
    templateUrl: './duplicate-dialog.component.html',
    styleUrl: './duplicate-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuplicateDialogComponent {
    private readonly dialogRef = inject(MatDialogRef<DuplicateDialogComponent, DuplicateDialogResult>);
    readonly data = inject<DuplicateDialogData>(MAT_DIALOG_DATA);

    get hasMoreDuplicates(): boolean {
        return this.data.totalCount > this.data.duplicates.length;
    }

    get additionalCount(): number {
        return this.data.totalCount - this.data.duplicates.length;
    }

    handleAddAnyway(): void {
        this.dialogRef.close('add');
    }

    handleCancel(): void {
        this.dialogRef.close('cancel');
    }

    handleOpenExisting(duplicate: DuplicateMatch): void {
        window.open(`/items/${duplicate.id}`, '_blank');
    }

    formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }
}
