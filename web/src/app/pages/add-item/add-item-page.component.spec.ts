import { HttpErrorResponse } from '@angular/common/http';
import { fakeAsync, flush, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';

import { AddItemPageComponent } from './add-item-page.component';
import { ItemService } from '../../services/item.service';
import { Item, ItemForm } from '../../models/item';
import { ItemLookupService } from '../../services/item-lookup.service';

describe(AddItemPageComponent.name, () => {
    let itemServiceSpy: jasmine.SpyObj<ItemService>;
    let snackBarSpy: jasmine.SpyObj<MatSnackBar>;
    let itemLookupServiceSpy: jasmine.SpyObj<ItemLookupService>;

    beforeEach(async () => {
        itemServiceSpy = jasmine.createSpyObj<ItemService>('ItemService', ['create']);
        snackBarSpy = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
        itemLookupServiceSpy = jasmine.createSpyObj<ItemLookupService>('ItemLookupService', ['lookup']);

        await TestBed.configureTestingModule({
            imports: [AddItemPageComponent],
            providers: [
                provideNoopAnimations(),
                { provide: ItemService, useValue: itemServiceSpy },
                { provide: ItemLookupService, useValue: itemLookupServiceSpy },
                provideRouter([], withDisabledInitialNavigation()),
                { provide: MatSnackBar, useValue: snackBarSpy },
            ],
        })
            .overrideProvider(MatSnackBar, { useValue: snackBarSpy })
            .compileComponents();
    });

    function createComponent() {
        const fixture = TestBed.createComponent(AddItemPageComponent);
        fixture.detectChanges();
        return fixture;
    }

    it('creates an item and routes back to the library on save', fakeAsync(() => {
        const mockItem = {
            id: 'id-123',
            title: 'Test',
            creator: 'Me',
            itemType: 'book',
            notes: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } satisfies Item;

        itemServiceSpy.create.and.returnValue(of(mockItem));
        snackBarSpy.open.calls.reset();
        const router = TestBed.inject(Router);
        const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
        const fixture = createComponent();
        fixture.componentInstance.handleSave({
            title: 'Test',
            creator: 'Me',
            itemType: 'book',
            releaseYear: null,
            pageCount: null,
            isbn13: '',
            isbn10: '',
            description: '',
            notes: '',
        });
        flush();
        expect(itemServiceSpy.create).toHaveBeenCalled();
        expect(snackBarSpy.open).toHaveBeenCalled();
        expect(navigateSpy).toHaveBeenCalledWith(['/']);
    }));

    it('shows a snack bar message on failure', fakeAsync(() => {
        snackBarSpy.open.calls.reset();
        itemServiceSpy.create.and.returnValue(throwError(() => new Error('fail')));
        const router = TestBed.inject(Router);
        const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
        const fixture = createComponent();
        fixture.componentInstance.handleSave({
            title: 'Test',
            creator: 'Me',
            itemType: 'book',
            releaseYear: null,
            pageCount: null,
            isbn13: '',
            isbn10: '',
            description: '',
            notes: '',
        });
        flush();

        expect(snackBarSpy.open).toHaveBeenCalled();
        expect(navigateSpy).not.toHaveBeenCalled();
    }));

    it('navigates back when cancel is invoked while idle', () => {
        const router = TestBed.inject(Router);
        const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
        const fixture = createComponent();
        fixture.componentInstance.handleCancel();
        expect(navigateSpy).toHaveBeenCalledWith(['/']);
    });

    it('does not navigate away when canceling while busy', () => {
        const router = TestBed.inject(Router);
        const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
        const fixture = createComponent();
        fixture.componentInstance.busy.set(true);
        fixture.componentInstance.handleCancel();
        expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('looks up metadata and pre-fills manual entry on success', fakeAsync(() => {
        itemLookupServiceSpy.lookup.and.returnValue(
            of({
                title: 'Metadata Title',
                creator: 'Someone',
                releaseYear: 2001,
                pageCount: 320,
                isbn13: '9780000000002',
                isbn10: '0000000002',
                description: 'From lookup',
                notes: 'From lookup',
            })
        );

        const fixture = createComponent();
        fixture.componentInstance.searchForm.setValue({ category: 'book', query: '9780000000002' });
        fixture.componentInstance.handleLookupSubmit();
        flush();

        expect(itemLookupServiceSpy.lookup).toHaveBeenCalledWith('9780000000002', 'book');
        expect(fixture.componentInstance.manualDraft()?.title).toBe('Metadata Title');
        expect(fixture.componentInstance.manualDraft()?.creator).toBe('Someone');
        expect(fixture.componentInstance.manualDraft()?.pageCount).toBe(320);
        expect(fixture.componentInstance.manualDraft()?.description).toBe('From lookup');
        expect(fixture.componentInstance.lookupPreview()?.isbn13).toBe('9780000000002');
        expect(fixture.componentInstance.selectedTab()).toBe(0);
        expect(fixture.componentInstance.manualDraftSource()).toEqual({ query: '9780000000002', label: 'Book' });
    }));

    it('adds a lookup preview directly to the collection', fakeAsync(() => {
        const mockItem = {
            id: 'item-1',
            title: 'Metadata Title',
            creator: 'Someone',
            itemType: 'book',
            notes: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } satisfies Item;

        itemServiceSpy.create.and.returnValue(of(mockItem));
        const fixture = createComponent();
        const draft: ItemForm = {
            title: 'Metadata Title',
            creator: 'Someone',
            itemType: 'book',
            releaseYear: 2001,
            pageCount: 320,
            isbn13: '9780000000002',
            isbn10: '0000000002',
            description: 'From lookup',
            notes: '',
        } satisfies ItemForm;

        fixture.componentInstance.lookupPreview.set(draft);
        fixture.componentInstance.handleQuickAdd();
        flush();

        expect(itemServiceSpy.create).toHaveBeenCalledWith(draft);
    }));

    it('stores an error when lookup fails', fakeAsync(() => {
        itemLookupServiceSpy.lookup.and.returnValue(throwError(() => new Error('network error')));

        const fixture = createComponent();
        fixture.componentInstance.searchForm.setValue({ category: 'book', query: 'bad' });
        fixture.componentInstance.handleLookupSubmit();
        flush();

        expect(itemLookupServiceSpy.lookup).toHaveBeenCalled();
        expect(fixture.componentInstance.lookupError()).toBeTruthy();
        expect(fixture.componentInstance.manualDraft()).toBeNull();
        expect(fixture.componentInstance.lookupPreview()).toBeNull();
    }));

    it('clears the lookup preview when starting fresh', fakeAsync(() => {
        itemLookupServiceSpy.lookup.and.returnValue(
            of({ title: 'Metadata Title', creator: 'Someone', releaseYear: 2001 })
        );

        const fixture = createComponent();
        fixture.componentInstance.searchForm.setValue({ category: 'book', query: 'test' });
        fixture.componentInstance.handleLookupSubmit();
        flush();

        expect(fixture.componentInstance.lookupPreview()).not.toBeNull();

        fixture.componentInstance.clearManualDraft();

        expect(fixture.componentInstance.lookupPreview()).toBeNull();
        expect(fixture.componentInstance.manualDraft()).toBeNull();
    }));

    it('uses the server-provided error message when available', fakeAsync(() => {
        itemLookupServiceSpy.lookup.and.returnValue(
            throwError(
                () =>
                    new HttpErrorResponse({
                        status: 400,
                        error: { error: 'metadata lookups for this category are not available yet' },
                    })
            )
        );

        const fixture = createComponent();
        fixture.componentInstance.searchForm.setValue({ category: 'game', query: '123456789' });
        fixture.componentInstance.handleLookupSubmit();
        flush();

        expect(fixture.componentInstance.lookupError()).toBe('metadata lookups for this category are not available yet');
        expect(fixture.componentInstance.manualDraft()).toBeNull();
    }));
});
