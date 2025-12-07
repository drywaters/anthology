import { HttpErrorResponse } from '@angular/common/http';
import { fakeAsync, flush, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { AddItemPageComponent } from './add-item-page.component';
import { ItemService } from '../../services/item.service';
import { Item, ItemForm } from '../../models/item';
import { CsvImportSummary } from '../../models/import';
import { ItemLookupService } from '../../services/item-lookup.service';

describe(AddItemPageComponent.name, () => {
    let itemServiceSpy: jasmine.SpyObj<ItemService>;
    let snackBarSpy: jasmine.SpyObj<MatSnackBar>;
    let itemLookupServiceSpy: jasmine.SpyObj<ItemLookupService>;
    let dialogSpy: jasmine.SpyObj<MatDialog>;

    beforeEach(async () => {
        itemServiceSpy = jasmine.createSpyObj<ItemService>('ItemService', ['create', 'importCsv', 'checkDuplicates']);
        itemServiceSpy.checkDuplicates.and.returnValue(of([])); // Default: no duplicates
        snackBarSpy = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
        itemLookupServiceSpy = jasmine.createSpyObj<ItemLookupService>('ItemLookupService', ['lookup']);
        dialogSpy = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);

        await TestBed.configureTestingModule({
            imports: [AddItemPageComponent],
            providers: [
                provideNoopAnimations(),
                { provide: ItemService, useValue: itemServiceSpy },
                { provide: ItemLookupService, useValue: itemLookupServiceSpy },
                provideRouter([], withDisabledInitialNavigation()),
                { provide: MatSnackBar, useValue: snackBarSpy },
                { provide: MatDialog, useValue: dialogSpy },
            ],
        })
            .overrideProvider(MatSnackBar, { useValue: snackBarSpy })
            .overrideProvider(MatDialog, { useValue: dialogSpy })
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

    it('prompts for duplicates and only creates when confirmed', fakeAsync(() => {
        const mockDuplicate = {
            id: 'dup-1',
            title: 'Test',
            primaryIdentifier: '',
            identifierType: '',
            updatedAt: new Date().toISOString(),
        };
        itemServiceSpy.checkDuplicates.and.returnValue(of([mockDuplicate]));

        const dialogRefSpy = {
            afterClosed: () => of<'add' | 'cancel'>('add'),
        } as unknown as jasmine.SpyObj<unknown>;
        dialogSpy.open.and.returnValue(dialogRefSpy as any);

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

        const fixture = createComponent();
        const router = TestBed.inject(Router);
        const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

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

        expect(dialogSpy.open).toHaveBeenCalled();
        expect(itemServiceSpy.create).toHaveBeenCalled();
        expect(navigateSpy).toHaveBeenCalledWith(['/']);
    }));

    it('does not create when duplicate dialog is cancelled', fakeAsync(() => {
        const mockDuplicate = {
            id: 'dup-1',
            title: 'Test',
            primaryIdentifier: '',
            identifierType: '',
            updatedAt: new Date().toISOString(),
        };
        itemServiceSpy.checkDuplicates.and.returnValue(of([mockDuplicate]));

        const dialogRefSpy = {
            afterClosed: () => of<'add' | 'cancel'>('cancel'),
        } as unknown as jasmine.SpyObj<unknown>;
        dialogSpy.open.and.returnValue(dialogRefSpy as any);

        const fixture = createComponent();
        const router = TestBed.inject(Router);
        const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

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

        expect(dialogSpy.open).toHaveBeenCalled();
        expect(itemServiceSpy.create).not.toHaveBeenCalled();
        expect(navigateSpy).not.toHaveBeenCalled();
    }));

    it('triggers a lookup when a barcode is detected', fakeAsync(() => {
        itemLookupServiceSpy.lookup.and.returnValue(of([]));
        const fixture = createComponent();
        const submitSpy = spyOn(fixture.componentInstance, 'handleLookupSubmit').and.callThrough();

        fixture.componentInstance.handleDetectedBarcode('9781234567890');
        flush();

        expect(fixture.componentInstance.searchForm.get('query')?.value).toBe('9781234567890');
        expect(submitSpy).toHaveBeenCalled();
        expect(itemLookupServiceSpy.lookup).toHaveBeenCalledWith('9781234567890', 'book');
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
of([
{
title: 'Metadata Title',
creator: 'Someone',
releaseYear: 2001,
pageCount: 320,
isbn13: '9780000000002',
isbn10: '0000000002',
description: 'From lookup',
},
])
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
expect(fixture.componentInstance.lookupResults().length).toBe(1);
expect(fixture.componentInstance.lookupResults()[0]?.isbn13).toBe('9780000000002');
        expect(fixture.componentInstance.selectedTab()).toBe(0);
        expect(fixture.componentInstance.manualDraftSource()).toEqual({ query: '9780000000002', label: 'Book' });
    }));

    it('switches to the manual entry tab when using a lookup result manually', () => {
        const fixture = createComponent();
        const preview: ItemForm = {
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

        fixture.componentInstance.manualDraftSource.set({ query: '9780000000002', label: 'Book' });
        fixture.componentInstance.handleUseForManual(preview);

        expect(fixture.componentInstance.manualDraft()).toEqual(preview);
        expect(fixture.componentInstance.selectedTab()).toBe(1);
        expect(fixture.componentInstance.manualDraftSource()).toEqual({
            query: '9780000000002',
            label: 'Book',
        });
    });

it('adds a lookup result directly to the collection', fakeAsync(() => {
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
        const router = TestBed.inject(Router);
        const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
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

fixture.componentInstance.handleQuickAdd(draft);
        flush();

        expect(itemServiceSpy.create).toHaveBeenCalledWith(draft);
        expect(navigateSpy).toHaveBeenCalledWith(['/']);
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
expect(fixture.componentInstance.lookupResults().length).toBe(0);
    }));

    it('clears the lookup preview when starting fresh', fakeAsync(() => {
itemLookupServiceSpy.lookup.and.returnValue(
of([{ title: 'Metadata Title', creator: 'Someone', releaseYear: 2001 }])
);

        const fixture = createComponent();
        fixture.componentInstance.searchForm.setValue({ category: 'book', query: 'test' });
        fixture.componentInstance.handleLookupSubmit();
        flush();

expect(fixture.componentInstance.lookupResults().length).toBe(1);

        fixture.componentInstance.clearManualDraft();

expect(fixture.componentInstance.lookupResults().length).toBe(0);
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

    it('uploads a CSV file and stores the summary', fakeAsync(() => {
        const summary = {
            totalRows: 2,
            imported: 2,
            skippedDuplicates: [],
            failed: [],
        } satisfies CsvImportSummary;
        itemServiceSpy.importCsv.and.returnValue(of(summary));
        const fixture = createComponent();
        fixture.componentInstance.selectedCsvFile.set(new File(['title'], 'import.csv', { type: 'text/csv' }));
        fixture.componentInstance.handleImportSubmit();
        flush();

        expect(itemServiceSpy.importCsv).toHaveBeenCalled();
        expect(fixture.componentInstance.importSummary()).toEqual(summary);
    }));

    it('captures CSV import errors from the server', fakeAsync(() => {
        itemServiceSpy.importCsv.and.returnValue(
            throwError(
                () => new HttpErrorResponse({ status: 400, error: { error: 'missing required columns' } })
            )
        );
        const fixture = createComponent();
        fixture.componentInstance.selectedCsvFile.set(new File(['title'], 'import.csv', { type: 'text/csv' }));
        fixture.componentInstance.handleImportSubmit();
        flush();

        expect(fixture.componentInstance.importError()).toBe('missing required columns');
    }));

    it('keeps the CSV import tab active when attaching a file', () => {
        const fixture = createComponent();
        fixture.componentInstance.selectedTab.set(0);
        const file = new File(['data'], 'import.csv', { type: 'text/csv' });
        const event = { target: { files: [file] } } as unknown as Event;

        fixture.componentInstance.handleCsvFileChange(event);

        expect(fixture.componentInstance.selectedTab()).toBe(2);
    });

    it('exposes a status for each CSV import phase', () => {
        const fixture = createComponent();

        fixture.componentInstance.importBusy.set(true);
        expect(fixture.componentInstance.csvImportStatus()?.level).toBe('info');
        expect(fixture.componentInstance.csvImportStatus()?.message).toContain('Importing CSV');

        fixture.componentInstance.importBusy.set(false);
        fixture.componentInstance.importSummary.set({
            totalRows: 3,
            imported: 3,
            skippedDuplicates: [],
            failed: [],
        } satisfies CsvImportSummary);

        expect(fixture.componentInstance.csvImportStatus()?.level).toBe('success');
        expect(fixture.componentInstance.csvImportStatus()?.message).toContain('Imported 3 of 3 rows.');

        fixture.componentInstance.importSummary.set({
            totalRows: 4,
            imported: 2,
            skippedDuplicates: [{ row: 1, reason: 'duplicate' }],
            failed: [{ row: 3, error: 'bad row' }],
        } satisfies CsvImportSummary);

        const warningStatus = fixture.componentInstance.csvImportStatus();
        expect(warningStatus?.level).toBe('warning');
        expect(warningStatus?.message).toContain('Not imported 2 rows');

        fixture.componentInstance.importSummary.set(null);
        fixture.componentInstance.importError.set('bad csv');
        const errorStatus = fixture.componentInstance.csvImportStatus();
        expect(errorStatus?.level).toBe('error');
        expect(errorStatus?.message).toBe('bad csv');
    });
});
