import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppHeaderComponent } from './app-header.component';

describe(AppHeaderComponent.name, () => {
    let fixture: ComponentFixture<AppHeaderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AppHeaderComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(AppHeaderComponent);
        fixture.detectChanges();
    });

    it('renders the brand and menu button', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('button[mat-icon-button]')).not.toBeNull();
        expect(compiled.querySelector('.brand-title')?.textContent?.trim()).toBe('Anthology');
    });
});
