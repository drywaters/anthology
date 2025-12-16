import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { ItemsFilterPanelComponent } from './items-filter-panel.component';
import { BookStatusFilters, ItemTypes, ShelfStatusFilters } from '../../../models/item';

describe('ItemsFilterPanelComponent', () => {
    let component: ItemsFilterPanelComponent;
    let fixture: ComponentFixture<ItemsFilterPanelComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ItemsFilterPanelComponent, NoopAnimationsModule],
        }).compileComponents();

        fixture = TestBed.createComponent(ItemsFilterPanelComponent);
        component = fixture.componentInstance;
        component.typeFilter = signal('all');
        component.statusFilter = signal(BookStatusFilters.All);
        component.shelfStatusFilter = signal(ShelfStatusFilters.All);
        component.showStatusFilter = signal(true);
        component.isGridView = signal(false);
        component.typeOptions = [
            { value: 'all', label: 'All items' },
            { value: ItemTypes.Book, label: 'Book' },
        ];
        component.statusOptions = [{ value: BookStatusFilters.All, label: 'All' }];
        component.shelfStatusOptions = [{ value: ShelfStatusFilters.All, label: 'All' }];
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should emit typeFilterChange when type is selected', () => {
        const spy = spyOn(component.typeFilterChange, 'emit');
        component.onTypeChange(ItemTypes.Book);
        expect(spy).toHaveBeenCalledWith(ItemTypes.Book);
    });

    it('should emit statusFilterChange when status is selected', () => {
        const spy = spyOn(component.statusFilterChange, 'emit');
        component.onStatusChange(BookStatusFilters.Reading);
        expect(spy).toHaveBeenCalledWith(BookStatusFilters.Reading);
    });

    it('should emit shelfStatusFilterChange when shelf status is selected', () => {
        const spy = spyOn(component.shelfStatusFilterChange, 'emit');
        component.onShelfStatusChange(ShelfStatusFilters.On);
        expect(spy).toHaveBeenCalledWith(ShelfStatusFilters.On);
    });

    it('should emit viewModeChange when view toggle is clicked', () => {
        const spy = spyOn(component.viewModeChange, 'emit');
        component.onViewModeChange('grid');
        expect(spy).toHaveBeenCalledWith('grid');
    });

    it('should hide status filter when showStatusFilter is false', () => {
        component.showStatusFilter = signal(false);
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('.status-select')).toBeFalsy();
    });

    it('should show active class on table button when not grid view', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const buttons = compiled.querySelectorAll('.view-toggle button');
        expect(buttons[0].classList.contains('active')).toBeTrue();
        expect(buttons[1].classList.contains('active')).toBeFalse();
    });

    it('should show active class on grid button when grid view', () => {
        component.isGridView = signal(true);
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        const buttons = compiled.querySelectorAll('.view-toggle button');
        expect(buttons[0].classList.contains('active')).toBeFalse();
        expect(buttons[1].classList.contains('active')).toBeTrue();
    });
});
