import { DatePipe, NgIf } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Item, ItemForm, ITEM_TYPE_LABELS } from '../../models/item';
import { AuthService } from '../../services/auth.service';
import { ItemService } from '../../services/item.service';
import { ItemFormComponent } from '../../components/item-form/item-form.component';

interface FormContextBase {
  mode: 'create' | 'edit';
}

interface CreateFormContext extends FormContextBase {
  mode: 'create';
  item: null;
}

interface EditFormContext extends FormContextBase {
  mode: 'edit';
  item: Item;
}

type FormContext = CreateFormContext | EditFormContext;

@Component({
  selector: 'app-items-page',
  standalone: true,
  imports: [
    DatePipe,
    NgIf,
    ItemFormComponent,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTableModule,
    MatToolbarModule,
    RouterModule,
  ],
  templateUrl: './items-page.component.html',
  styleUrl: './items-page.component.scss',
})
export class ItemsPageComponent {
  private readonly itemService = inject(ItemService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly displayedColumns = ['title', 'creator', 'itemType', 'releaseYear', 'updatedAt', 'actions'] as const;
  readonly items = signal<Item[]>([]);
  readonly loading = signal(false);
  readonly mutationInFlight = signal(false);
  readonly formContext = signal<FormContext | null>(null);

  readonly hasItems = computed(() => this.items().length > 0);
  readonly typeLabels = ITEM_TYPE_LABELS;

  constructor() {
    this.refresh();
  }

  logout(): void {
    this.authService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.set([]);
          this.router.navigate(['/login']);
        },
        error: () => {
          this.snackBar.open('We could not clear your session; please try again.', 'Dismiss', { duration: 5000 });
        },
      });
  }

  refresh(): void {
    this.loading.set(true);
    this.itemService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set(items);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open('Unable to load your anthology right now.', 'Dismiss', { duration: 5000 });
        },
      });
  }

  startCreate(): void {
    this.formContext.set({ mode: 'create', item: null } satisfies CreateFormContext);
  }

  startEdit(item: Item): void {
    this.formContext.set({ mode: 'edit', item } satisfies EditFormContext);
  }

  closeForm(): void {
    this.formContext.set(null);
  }

  handleSave(formValue: ItemForm): void {
    const ctx = this.formContext();
    if (!ctx) {
      return;
    }

    this.mutationInFlight.set(true);
    const operation =
      ctx.mode === 'create'
        ? this.itemService.create(formValue)
        : this.itemService.update(ctx.item.id, formValue);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (item) => {
        this.upsertItem(item);
        this.mutationInFlight.set(false);
        this.snackBar.open(`Saved “${item.title}”`, 'Dismiss', { duration: 4000 });
        this.closeForm();
      },
      error: () => {
        this.mutationInFlight.set(false);
        this.snackBar.open('We could not save the item. Double-check required fields.', 'Dismiss', {
          duration: 5000,
        });
      },
    });
  }

  deleteItem(item: Item): void {
    if (this.mutationInFlight()) {
      return;
    }

    this.mutationInFlight.set(true);
    this.itemService
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update((items) => items.filter((existing) => existing.id !== item.id));
          this.mutationInFlight.set(false);
          this.snackBar.open(`Removed “${item.title}”`, 'Dismiss', { duration: 4000 });
          this.closeForm();
        },
        error: () => {
          this.mutationInFlight.set(false);
          this.snackBar.open('Unable to delete this entry right now.', 'Dismiss', { duration: 5000 });
        },
      });
  }

  trackById(_: number, item: Item): string {
    return item.id;
  }

  labelFor(item: Item): string {
    return this.typeLabels[item.itemType];
  }

  private upsertItem(item: Item): void {
    this.items.update((items) => {
      const next = items.filter((existing) => existing.id !== item.id);
      return [item, ...next].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }
}
