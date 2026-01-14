import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface EditSeriesDialogData {
    seriesName: string;
}

export type EditSeriesDialogResult = { action: 'save'; newName: string } | { action: 'cancel' };

@Component({
    selector: 'app-edit-series-dialog',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        A11yModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
    ],
    templateUrl: './edit-series-dialog.component.html',
    styleUrl: './edit-series-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditSeriesDialogComponent {
    private readonly dialogRef = inject(
        MatDialogRef<EditSeriesDialogComponent, EditSeriesDialogResult>,
    );
    readonly data = inject<EditSeriesDialogData>(MAT_DIALOG_DATA);

    readonly nameControl = new FormControl(this.data.seriesName, {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(200)],
    });

    handleSave(): void {
        const trimmed = this.nameControl.value.trim();
        if (!trimmed) {
            this.nameControl.setErrors({ ...this.nameControl.errors, required: true });
            this.nameControl.markAsTouched();
            return;
        }
        if (this.nameControl.invalid) {
            this.nameControl.markAsTouched();
            return;
        }
        this.dialogRef.close({ action: 'save', newName: trimmed });
    }

    handleCancel(): void {
        this.dialogRef.close({ action: 'cancel' });
    }
}
