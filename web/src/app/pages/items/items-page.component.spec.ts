import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ItemsPageComponent } from './items-page.component';
import { ItemService } from '../../services/item.service';
import { NotificationService } from '../../services/notification.service';
import { LibraryActionsService } from '../../services/library-actions.service';
import { SeriesService } from '../../services/series.service';
import { BookStatusFilters, ItemTypes, ShelfStatusFilters } from '../../models';

class IntersectionObserverStub {
    constructor(_: IntersectionObserverCallback) {}

    observe(): void {}

    unobserve(): void {}

    disconnect(): void {}

    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
}

describe(ItemsPageComponent.name, () => {
    let fixture: ComponentFixture<ItemsPageComponent>;
    let itemServiceSpy: jasmine.SpyObj<ItemService>;
    let notificationSpy: jasmine.SpyObj<NotificationService>;
    let libraryActions: LibraryActionsService;

    beforeEach(async () => {
        (window as any).IntersectionObserver = IntersectionObserverStub;

        itemServiceSpy = jasmine.createSpyObj<ItemService>('ItemService', [
            'list',
            'getHistogram',
            'exportCsv',
        ]);
        itemServiceSpy.list.and.returnValue(of([]));
        itemServiceSpy.getHistogram.and.returnValue(of({}));
        itemServiceSpy.exportCsv.and.returnValue(of(new Blob(['test'])));

        notificationSpy = jasmine.createSpyObj<NotificationService>('NotificationService', [
            'info',
            'error',
        ]);

        const seriesServiceStub = {
            list: () => of({ series: [], standaloneItems: [] }),
        };

        await TestBed.configureTestingModule({
            imports: [ItemsPageComponent],
            providers: [
                provideNoopAnimations(),
                { provide: ItemService, useValue: itemServiceSpy },
                { provide: NotificationService, useValue: notificationSpy },
                { provide: SeriesService, useValue: seriesServiceStub },
                provideRouter([], withDisabledInitialNavigation()),
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ItemsPageComponent);
        libraryActions = TestBed.inject(LibraryActionsService);
        fixture.detectChanges();
    });

    it('exports with current filters when export is requested', () => {
        const component = fixture.componentInstance;
        const downloadSpy = spyOn(component as any, 'downloadBlob');

        component.setTypeFilter(ItemTypes.Book);
        component.setStatusFilter(BookStatusFilters.Reading);
        component.setShelfStatusFilter(ShelfStatusFilters.On);
        fixture.detectChanges();

        libraryActions.requestExport();

        expect(itemServiceSpy.exportCsv).toHaveBeenCalledWith({
            itemType: ItemTypes.Book,
            status: BookStatusFilters.Reading,
            shelfStatus: ShelfStatusFilters.On,
        });
        expect(downloadSpy).toHaveBeenCalled();
        expect(notificationSpy.info).toHaveBeenCalledWith('Library exported successfully');
    });

    it('shows an error when export fails', () => {
        itemServiceSpy.exportCsv.and.returnValue(throwError(() => new Error('fail')));
        const component = fixture.componentInstance;
        const downloadSpy = spyOn(component as any, 'downloadBlob');

        libraryActions.requestExport();

        expect(notificationSpy.error).toHaveBeenCalledWith('Failed to export library');
        expect(downloadSpy).not.toHaveBeenCalled();
    });
});
