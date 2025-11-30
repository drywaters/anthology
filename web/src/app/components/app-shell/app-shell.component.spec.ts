import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { AppShellComponent } from './app-shell.component';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-test-page',
    standalone: true,
    template: '<p>Test Page</p>',
})
class TestPageComponent {}

describe(AppShellComponent.name, () => {
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let snackBarSpy: jasmine.SpyObj<MatSnackBar>;

    beforeEach(async () => {
        authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['logout']);
        snackBarSpy = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
        authServiceSpy.logout.and.returnValue(of(void 0));

        await TestBed.configureTestingModule({
            imports: [AppShellComponent],
            providers: [
                provideRouter(
                    [
                        {
                            path: '',
                            component: TestPageComponent,
                        },
                    ],
                    withDisabledInitialNavigation()
                ),
                { provide: AuthService, useValue: authServiceSpy },
                { provide: MatSnackBar, useValue: snackBarSpy },
            ],
        }).compileComponents();
    });

    it('renders the header, sidebar, and router outlet', () => {
        const fixture = TestBed.createComponent(AppShellComponent);
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;

        expect(compiled.querySelector('app-header')).not.toBeNull();
        expect(compiled.querySelector('app-sidebar')).not.toBeNull();
        expect(compiled.querySelector('router-outlet')).not.toBeNull();
    });

    it('opens the sidebar when the menu button is pressed', () => {
        const fixture = TestBed.createComponent(AppShellComponent);
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;

        const menuButton = compiled.querySelector('app-header button[mat-icon-button]') as HTMLButtonElement;
        menuButton.click();
        fixture.detectChanges();

        expect(compiled.querySelector('.backdrop')).not.toBeNull();
    });

    it('can toggle the sidebar closed and reopen it again', () => {
        const fixture = TestBed.createComponent(AppShellComponent);
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;

        const menuButton = compiled.querySelector('app-header button[mat-icon-button]') as HTMLButtonElement;

        menuButton.click();
        fixture.detectChanges();
        expect(compiled.querySelector('.backdrop')).not.toBeNull();

        menuButton.click();
        fixture.detectChanges();
        expect(compiled.querySelector('.backdrop')).toBeNull();

        menuButton.click();
        fixture.detectChanges();
        expect(compiled.querySelector('.backdrop')).not.toBeNull();
    });
});
