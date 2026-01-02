import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDeleteDialogData {
    title: string;
    message: string;
    itemCount: number;
    confirmLabel?: string;
}

export type ConfirmDeleteDialogResult = 'confirm' | 'cancel';

@Component({
    selector: 'app-confirm-delete-dialog',
    standalone: true,
    imports: [CommonModule, A11yModule, MatButtonModule, MatDialogModule, MatIconModule],
    templateUrl: './confirm-delete-dialog.component.html',
    styleUrl: './confirm-delete-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDeleteDialogComponent {
    private readonly dialogRef = inject(
        MatDialogRef<ConfirmDeleteDialogComponent, ConfirmDeleteDialogResult>,
    );
    readonly data = inject<ConfirmDeleteDialogData>(MAT_DIALOG_DATA);

    get confirmLabel(): string {
        return this.data.confirmLabel ?? 'Delete';
    }

    handleConfirm(): void {
        this.dialogRef.close('confirm');
    }

    handleCancel(): void {
        this.dialogRef.close('cancel');
    }
}
