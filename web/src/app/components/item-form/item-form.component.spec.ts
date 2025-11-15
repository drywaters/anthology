import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ItemFormComponent } from './item-form.component';
import { Item } from '../../models/item';

describe(ItemFormComponent.name, () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ItemFormComponent],
        }).compileComponents();
    });

    function createComponent() {
        const fixture = TestBed.createComponent(ItemFormComponent);
        fixture.detectChanges();
        return fixture;
    }

    it('populates form fields when an item input is provided', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        const existing: Item = {
            id: '1',
            title: 'Neuromancer',
            creator: 'William Gibson',
            itemType: 'book',
            releaseYear: 1984,
            pageCount: 271,
            isbn13: '9780441569595',
            isbn10: '0441569595',
            description: 'Cyberpunk classic',
            notes: 'Cyberpunk classic',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        component.item = existing;
        component.ngOnChanges({
            item: new SimpleChange(null, existing, false),
        });

        expect(component.form.value).toEqual(
            jasmine.objectContaining({
                title: 'Neuromancer',
                creator: 'William Gibson',
                itemType: 'book',
                releaseYear: 1984,
                pageCount: 271,
                isbn13: '9780441569595',
                isbn10: '0441569595',
                description: 'Cyberpunk classic',
                notes: 'Cyberpunk classic',
            })
        );
    });

    it('marks controls as touched when attempting to submit invalid form', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        component.form.patchValue({ title: '' });
        component.submit();

        expect(component.form.get('title')?.touched).toBeTrue();
        expect(component.form.valid).toBeFalse();
    });

    it('emits normalized form values on submit', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        const saveSpy = jasmine.createSpy('save');
        component.save.subscribe(saveSpy);

        component.form.setValue({
            title: 'Arrival',
            creator: 'Denis Villeneuve',
            itemType: 'movie',
            releaseYear: null,
            pageCount: null,
            isbn13: '',
            isbn10: '',
            description: '',
            notes: '',
        });

        component.submit();

        expect(saveSpy).toHaveBeenCalledWith(
            jasmine.objectContaining({
                title: 'Arrival',
                releaseYear: null,
                pageCount: null,
            })
        );
    });

    it('clears the release year field when requested', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        component.form.patchValue({ releaseYear: 2020 });

        component.clearReleaseYear();

        expect(component.form.get('releaseYear')?.value).toBeNull();
    });

    it('clears the page count when requested', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        component.form.patchValue({ pageCount: 400 });

        component.clearPageCount();

        expect(component.form.get('pageCount')?.value).toBeNull();
    });
});
