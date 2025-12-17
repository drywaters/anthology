import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ShelfService } from '../../../services/shelf.service';
import {
    PhotoUploadComponent,
    PhotoUploadResult,
} from '../../../components/shelves/photo-upload/photo-upload.component';

@Component({
    selector: 'app-add-shelf-page',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        NgIf,
        RouterModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSnackBarModule,
        PhotoUploadComponent,
    ],
    templateUrl: './add-shelf-page.component.html',
    styleUrl: './add-shelf-page.component.scss',
})
export class AddShelfPageComponent {
    private readonly shelfService = inject(ShelfService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly router = inject(Router);
    private readonly fb = inject(FormBuilder);
    private readonly destroyRef = inject(DestroyRef);

    readonly creating = signal(false);
    readonly photoTouched = signal(false);

    readonly form = this.fb.group({
        name: ['', [Validators.required]],
        photoUrl: ['', [Validators.required]],
        description: [''],
    });

    createShelf(): void {
        this.photoTouched.set(true);
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.creating.set(true);
        const payload = this.form.value as { name: string; photoUrl: string; description?: string };
        this.shelfService
            .create(payload)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (shelf) => {
                    this.creating.set(false);
                    this.snackBar.open('Shelf created', undefined, { duration: 2000 });
                    this.resetForm();
                    this.router.navigate(['/shelves', shelf.shelf.id]);
                },
                error: () => {
                    this.creating.set(false);
                    this.snackBar.open('Could not create shelf', 'Dismiss', { duration: 4000 });
                },
            });
    }

    handlePhotoSelected(result: PhotoUploadResult): void {
        this.form.patchValue({ photoUrl: result.dataUrl });
        this.photoTouched.set(true);
    }

    handlePhotoCleared(): void {
        this.form.patchValue({ photoUrl: '' });
    }

    private resetForm(): void {
        this.form.reset({ name: '', photoUrl: '', description: '' });
        this.photoTouched.set(false);
    }
}
