import { fakeAsync, flush, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';

import { AddItemPageComponent } from './add-item-page.component';
import { ItemService } from '../../services/item.service';
import { Item } from '../../models/item';

describe(AddItemPageComponent.name, () => {
    let itemServiceSpy: jasmine.SpyObj<ItemService>;
    let snackBarSpy: jasmine.SpyObj<MatSnackBar>;

    beforeEach(async () => {
        itemServiceSpy = jasmine.createSpyObj<ItemService>('ItemService', ['create']);
        snackBarSpy = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);

        await TestBed.configureTestingModule({
            imports: [AddItemPageComponent],
            providers: [
                provideNoopAnimations(),
                { provide: ItemService, useValue: itemServiceSpy },
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
});
