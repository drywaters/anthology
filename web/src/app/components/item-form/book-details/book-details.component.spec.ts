import { TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { BookDetailsComponent } from './book-details.component';
import { BookStatus, Formats } from '../../../models/item';

describe(BookDetailsComponent.name, () => {
    let form: FormGroup;

    beforeEach(async () => {
        const fb = new FormBuilder();
        form = fb.group({
            title: ['', [Validators.required]],
            pageCount: [null, [Validators.min(1)]],
            currentPage: [null, [Validators.min(0)]],
            isbn13: [''],
            isbn10: [''],
            description: [''],
            format: [Formats.Unknown],
            genre: [''],
            rating: [null],
            retailPriceUsd: [null],
            googleVolumeId: [''],
            readingStatus: [BookStatus.None],
            readAt: [null],
        });

        await TestBed.configureTestingModule({
            imports: [BookDetailsComponent, NoopAnimationsModule],
        }).compileComponents();
    });

    function createComponent() {
        const fixture = TestBed.createComponent(BookDetailsComponent);
        fixture.componentInstance.form = form;
        fixture.componentInstance.bookStatusOptions = [
            { value: BookStatus.None, label: 'Not set' },
            { value: BookStatus.Read, label: 'Read' },
            { value: BookStatus.Reading, label: 'Currently reading' },
        ];
        fixture.componentInstance.formatOptions = [];
        fixture.componentInstance.genreOptions = [];
        fixture.detectChanges();
        return fixture;
    }

    it('clears the page count when requested', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        form.patchValue({ pageCount: 400 });

        component.clearPageCount();

        expect(form.get('pageCount')?.value).toBeNull();
    });

    it('clears the current page when requested', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        form.patchValue({ currentPage: 50 });

        component.clearCurrentPage();

        expect(form.get('currentPage')?.value).toBeNull();
    });

    it('clears the rating when requested', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        form.patchValue({ rating: 8 });

        component.clearRating();

        expect(form.get('rating')?.value).toBeNull();
    });

    it('clears the retail price when requested', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        form.patchValue({ retailPriceUsd: 19.99 });

        component.clearRetailPrice();

        expect(form.get('retailPriceUsd')?.value).toBeNull();
    });

    it('clears readAt when status changes from Read', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        form.patchValue({ readingStatus: BookStatus.Read, readAt: new Date() });

        component.onStatusChange(BookStatus.None);

        expect(form.get('readAt')?.value).toBeNull();
    });

    it('clears currentPage when status changes from Reading', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        form.patchValue({ readingStatus: BookStatus.Reading, currentPage: 50 });

        component.onStatusChange(BookStatus.Read);

        expect(form.get('currentPage')?.value).toBeNull();
    });

    it('returns true for isReadStatus when reading status is Read', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        form.patchValue({ readingStatus: BookStatus.Read });

        expect(component.isReadStatus).toBeTrue();
    });

    it('returns true for isReadingStatus when reading status is Reading', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        form.patchValue({ readingStatus: BookStatus.Reading });

        expect(component.isReadingStatus).toBeTrue();
    });
});
