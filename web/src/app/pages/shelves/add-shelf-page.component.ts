import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ShelfService } from '../../services/shelf.service';

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
        MatIconModule,
        MatInputModule,
        MatSnackBarModule,
    ],
    templateUrl: './add-shelf-page.component.html',
    styleUrl: './add-shelf-page.component.scss',
})
export class AddShelfPageComponent {
    private static readonly MAX_PHOTO_BYTES = 500 * 1024;

    private readonly shelfService = inject(ShelfService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly router = inject(Router);
    private readonly fb = inject(FormBuilder);
    private readonly destroyRef = inject(DestroyRef);

    readonly creating = signal(false);
    readonly photoUploadError = signal<string | null>(null);
    readonly selectedPhotoName = signal<string | null>(null);

    readonly form = this.fb.group({
        name: ['', [Validators.required]],
        photoUrl: ['', [Validators.required]],
        description: [''],
    });

    createShelf(): void {
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

    openPhotoPicker(input: HTMLInputElement): void {
        this.photoUploadError.set(null);
        input.click();
    }

    handlePhotoFileChange(input: HTMLInputElement): void {
        const file = input.files?.[0];
        if (!file) {
            return;
        }

        if (file.size > AddShelfPageComponent.MAX_PHOTO_BYTES) {
            this.clearPhotoSelection(false, input);
            this.photoUploadError.set('Photos must be under 500KB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            this.form.patchValue({ photoUrl: result });
            this.photoUploadError.set(null);
            this.selectedPhotoName.set(file.name);
        };
        reader.readAsDataURL(file);
    }

    clearPhotoSelection(clearError = true, input?: HTMLInputElement): void {
        this.form.patchValue({ photoUrl: '' });
        if (clearError) {
            this.photoUploadError.set(null);
        }
        this.selectedPhotoName.set(null);
        if (input) {
            input.value = '';
        }
    }

    private resetForm(): void {
        this.form.reset({ name: '', photoUrl: '', description: '' });
        this.photoUploadError.set(null);
        this.selectedPhotoName.set(null);
    }
}
