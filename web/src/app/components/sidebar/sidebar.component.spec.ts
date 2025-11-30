import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';

import { SidebarComponent } from './sidebar.component';

describe(SidebarComponent.name, () => {
    let fixture: ComponentFixture<SidebarComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SidebarComponent],
            providers: [provideRouter([], withDisabledInitialNavigation())],
        }).compileComponents();

        fixture = TestBed.createComponent(SidebarComponent);
        fixture.componentInstance.navItems = [
            { id: 'library', label: 'Library', icon: 'menu_book', route: '/' },
            { id: 'shelves', label: 'Shelves', icon: 'grid_on', route: '/shelves' },
        ];
        fixture.componentInstance.actionItems = [
            { id: 'add-item', label: 'Add Item', icon: 'library_add', route: '/items/add' },
            { id: 'logout', label: 'Log out', icon: 'logout' },
        ];
        fixture.detectChanges();
    });

    it('renders the Anthology brand mark and title', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const brandMark = compiled.querySelector('.brand-mark') as HTMLImageElement | null;
        const brandTitle = compiled.querySelector('.brand-title');

        expect(brandMark).not.toBeNull();
        expect(brandMark?.getAttribute('alt')).toContain('Anthology');
        expect(brandTitle?.textContent?.trim()).toBe('Anthology');
    });

    it('shows nav links and actions for provided items', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const navLinks = compiled.querySelectorAll('.nav a.nav-link');
        const actionButtons = compiled.querySelectorAll('.actions .action-button');

        expect(navLinks.length).toBe(2);
        expect(actionButtons.length).toBe(2);
    });

    it('emits navigation and action events', () => {
        const navigateSpy = spyOn(fixture.componentInstance.navigate, 'emit');
        const actionSpy = spyOn(fixture.componentInstance.actionTriggered, 'emit');
        const compiled = fixture.nativeElement as HTMLElement;

        const firstNav = compiled.querySelector('.nav a.nav-link') as HTMLAnchorElement;
        firstNav.click();
        expect(navigateSpy).toHaveBeenCalledWith('/');

        const firstAction = compiled.querySelector('.actions .action-button') as HTMLButtonElement;
        firstAction.click();
        expect(actionSpy).toHaveBeenCalledWith('add-item');
    });

    it('applies the open class when visible', () => {
        fixture.componentInstance.open = true;
        fixture.detectChanges();
        const sidebar = fixture.nativeElement.querySelector('.sidebar');
        expect(sidebar?.classList.contains('sidebar--open')).toBeTrue();
    });
});
