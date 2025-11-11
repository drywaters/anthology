import { Component, DestroyRef, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ItemFormComponent } from '../../components/item-form/item-form.component';
import { ItemForm } from '../../models/item';
import { ItemService } from '../../services/item.service';

@Component({
    selector: 'app-add-item-page',
    standalone: true,
    imports: [MatButtonModule, MatCardModule, MatIconModule, MatSnackBarModule, RouterModule, ItemFormComponent],
    templateUrl: './add-item-page.component.html',
    styleUrl: './add-item-page.component.scss',
})
export class AddItemPageComponent {
    private readonly itemService = inject(ItemService);
    private readonly router = inject(Router);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    readonly busy = signal(false);

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
}
