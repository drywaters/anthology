import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ItemsTableViewComponent } from './items-table-view.component';
import { Item, ItemTypes } from '../../../models/item';
import { LetterGroup } from '../items-page.component';

describe('ItemsTableViewComponent', () => {
    let component: ItemsTableViewComponent;
    let fixture: ComponentFixture<ItemsTableViewComponent>;

    const mockItems: Item[] = [
        {
            id: '1',
            title: 'Alpha Book',
            creator: 'Author A',
            itemType: ItemTypes.Book,
            releaseYear: 2023,
            notes: '',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-06-15T00:00:00Z',
        },
        {
            id: '2',
            title: 'Beta Book',
            creator: 'Author B',
            itemType: ItemTypes.Game,
            releaseYear: 2022,
            notes: '',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-06-15T00:00:00Z',
        },
    ];

    const mockGroupedItems: LetterGroup[] = [
        { letter: 'A', items: [mockItems[0]] },
        { letter: 'B', items: [mockItems[1]] },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ItemsTableViewComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ItemsTableViewComponent);
        component = fixture.componentInstance;
        component.groupedItems = signal(mockGroupedItems);
        component.typeFilter = signal('all');
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render letter sections', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const sections = compiled.querySelectorAll('.letter-section');
        expect(sections.length).toBe(2);
    });

    it('should render letter headers', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const headers = compiled.querySelectorAll('.letter-header');
        expect(headers[0].textContent).toContain('A');
        expect(headers[1].textContent).toContain('B');
    });

    it('should render tables', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const tables = compiled.querySelectorAll('.items-table');
        expect(tables.length).toBe(2);
    });

    it('should emit itemSelected when row is clicked', () => {
        const spy = spyOn(component.itemSelected, 'emit');
        component.onItemSelected(mockItems[0]);
        expect(spy).toHaveBeenCalledWith(mockItems[0]);
    });

    it('should emit typeFilterRequested when type chip is clicked', () => {
        const spy = spyOn(component.typeFilterRequested, 'emit');
        const event = new MouseEvent('click');
        spyOn(event, 'stopPropagation');
        component.onTypeFilterRequested(ItemTypes.Book, event);
        expect(spy).toHaveBeenCalledWith(ItemTypes.Book);
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should emit shelfLocationRequested when shelf button clicked', () => {
        const spy = spyOn(component.shelfLocationRequested, 'emit');
        const event = new MouseEvent('click');
        component.onShelfLocationRequested(mockItems[0], event);
        expect(spy).toHaveBeenCalledWith({ item: mockItems[0], event });
    });

    it('should emit itemSelected on Enter key', () => {
        const spy = spyOn(component.itemSelected, 'emit');
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        component.handleRowKeydown(event, mockItems[0]);
        expect(spy).toHaveBeenCalledWith(mockItems[0]);
    });

    it('should emit itemSelected on Space key', () => {
        const spy = spyOn(component.itemSelected, 'emit');
        const event = new KeyboardEvent('keydown', { key: ' ' });
        component.handleRowKeydown(event, mockItems[0]);
        expect(spy).toHaveBeenCalledWith(mockItems[0]);
    });

    it('should have data-letter attribute on sections', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const sections = compiled.querySelectorAll('.letter-section');
        expect(sections[0].getAttribute('data-letter')).toBe('A');
        expect(sections[1].getAttribute('data-letter')).toBe('B');
    });
});
