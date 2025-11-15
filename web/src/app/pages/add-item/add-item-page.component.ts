import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ItemFormComponent } from '../../components/item-form/item-form.component';
import { ItemForm } from '../../models/item';
import { ItemService } from '../../services/item.service';
import { ItemLookupCategory, ItemLookupService } from '../../services/item-lookup.service';

type SearchCategoryValue = ItemLookupCategory;

interface SearchCategoryConfig {
    value: SearchCategoryValue;
    label: string;
    description: string;
    inputLabel: string;
    placeholder: string;
    itemType: ItemForm['itemType'];
}

@Component({
    selector: 'app-add-item-page',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatRadioModule,
        MatSnackBarModule,
        MatTabsModule,
        ReactiveFormsModule,
        RouterModule,
        ItemFormComponent,
    ],
    templateUrl: './add-item-page.component.html',
    styleUrl: './add-item-page.component.scss',
})
export class AddItemPageComponent {
    private static readonly SEARCH_CATEGORIES: SearchCategoryConfig[] = [
        {
            value: 'book',
            label: 'Books',
            description: 'Search by ISBN or keyword to auto-fill book details.',
            inputLabel: 'Search for books',
            placeholder: 'ISBN, UPC, or title keyword',
            itemType: 'book',
        },
        {
            value: 'board-game',
            label: 'Board Games',
            description: 'Look up tabletop editions by UPC or name.',
            inputLabel: 'Search for board games',
            placeholder: 'UPC or title keyword',
            itemType: 'game',
        },
        {
            value: 'video-game',
            label: 'Video Games',
            description: 'Search console and PC releases by UPC or title.',
            inputLabel: 'Search for video games',
            placeholder: 'UPC or title keyword',
            itemType: 'game',
        },
        {
            value: 'movie',
            label: 'Movies',
            description: 'Use UPC or keywords to find film metadata.',
            inputLabel: 'Search for movies',
            placeholder: 'UPC or title keyword',
            itemType: 'movie',
        },
        {
            value: 'music',
            label: 'Music',
            description: 'Find album details with UPC or artist keywords.',
            inputLabel: 'Search for music',
            placeholder: 'UPC or title keyword',
            itemType: 'music',
        },
    ];

    private readonly itemService = inject(ItemService);
    private readonly itemLookupService = inject(ItemLookupService);
    private readonly router = inject(Router);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);
    private readonly fb = inject(FormBuilder);

    readonly busy = signal(false);
    readonly lookupBusy = signal(false);
    readonly lookupError = signal<string | null>(null);
    readonly manualDraft = signal<ItemForm | null>(null);
    readonly manualDraftSource = signal<{ query: string; label: string } | null>(null);
    readonly lastLookupSummary = signal<string | null>(null);
    readonly selectedTab = signal(0);

    readonly searchCategories = AddItemPageComponent.SEARCH_CATEGORIES;

    readonly searchForm = this.fb.group({
        category: [AddItemPageComponent.SEARCH_CATEGORIES[0].value as SearchCategoryValue, Validators.required],
        query: ['', [Validators.required, Validators.minLength(3)]],
    });

    readonly activeCategory = computed(() => {
        const value = this.searchForm.get('category')?.value as SearchCategoryValue | null;
        return (
            AddItemPageComponent.SEARCH_CATEGORIES.find((category) => category.value === value) ??
            AddItemPageComponent.SEARCH_CATEGORIES[0]
        );
    });

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

    handleLookupSubmit(): void {
        if (this.lookupBusy()) {
            return;
        }

        if (this.searchForm.invalid) {
            this.searchForm.markAllAsTouched();
            return;
        }

        const rawCategory = this.searchForm.get('category')?.value as SearchCategoryValue | null;
        const rawQuery = this.searchForm.get('query')?.value ?? '';
        const query = rawQuery.trim();

        if (!rawCategory || !query) {
            this.searchForm.get('query')?.setErrors({ required: true });
            return;
        }

        const category = this.getCategoryConfig(rawCategory);

        this.lookupBusy.set(true);
        this.lookupError.set(null);
        this.lastLookupSummary.set(null);

        this.itemLookupService
            .lookup(query, rawCategory)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (result) => {
                    this.lookupBusy.set(false);
                    const draft = this.composeDraft(result, category);
                    this.manualDraft.set({ ...draft });
                    this.manualDraftSource.set({
                        query,
                        label: category.label,
                    });
                    this.lastLookupSummary.set(`Metadata loaded for “${query}”. Review and save from the Manual Entry tab.`);
                    this.selectedTab.set(1);
                },
                error: (error) => {
                    this.lookupBusy.set(false);
                    this.manualDraft.set(null);
                    this.manualDraftSource.set(null);

                    let message = 'We couldn’t find a match. Try another ISBN or UPC.';
                    if (error instanceof HttpErrorResponse) {
                        const serverMessage = typeof error.error?.error === 'string' ? error.error.error.trim() : '';
                        if (serverMessage) {
                            message = serverMessage;
                        } else if (error.status === 404) {
                            message = 'We couldn’t find a match. Try another ISBN or UPC.';
                        }
                    }

                    this.lookupError.set(message);
                },
            });
    }

    handleTabChange(index: number): void {
        this.selectedTab.set(index);
    }

    clearManualDraft(): void {
        this.manualDraft.set(null);
        this.manualDraftSource.set(null);
    }

    private getCategoryConfig(value: SearchCategoryValue): SearchCategoryConfig {
        return (
            AddItemPageComponent.SEARCH_CATEGORIES.find((category) => category.value === value) ??
            AddItemPageComponent.SEARCH_CATEGORIES[0]
        );
    }

    private composeDraft(partial: Partial<ItemForm>, category: SearchCategoryConfig): ItemForm {
        const releaseYear = partial.releaseYear;
        let normalizedReleaseYear: number | null = null;

        if (typeof releaseYear === 'number') {
            normalizedReleaseYear = releaseYear;
        } else if (typeof releaseYear === 'string') {
            const parsed = Number.parseInt(releaseYear, 10);
            normalizedReleaseYear = Number.isNaN(parsed) ? null : parsed;
        }

        return {
            title: partial.title ?? '',
            creator: partial.creator ?? '',
            itemType: category.itemType,
            releaseYear: normalizedReleaseYear,
            notes: partial.notes ?? '',
        };
    }
}
