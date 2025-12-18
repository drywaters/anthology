import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

import { DuplicateMatch } from '../../models';

export interface DuplicateDialogData {
    duplicates: DuplicateMatch[];
    totalCount: number;
}

export type DuplicateDialogResult = 'add' | 'cancel';

@Component({
    selector: 'app-duplicate-dialog',
    standalone: true,
    imports: [CommonModule, A11yModule, MatButtonModule, MatDialogModule, MatIconModule],
    templateUrl: './duplicate-dialog.component.html',
    styleUrl: './duplicate-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DuplicateDialogComponent {
    private readonly dialogRef = inject(
        MatDialogRef<DuplicateDialogComponent, DuplicateDialogResult>,
    );
    private readonly router = inject(Router);
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
        const editUrl = this.router.serializeUrl(
            this.router.createUrlTree(['/items', duplicate.id, 'edit']),
        );
        window.open(editUrl, '_blank');
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
