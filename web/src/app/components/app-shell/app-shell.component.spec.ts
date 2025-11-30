import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';

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

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['logout']);

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
      ],
    }).compileComponents();
  });

  it('renders the sidebar and a router outlet', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-sidebar')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('shows the subpanel when a section is selected', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    const component = fixture.componentInstance;
    component.handleSelectSection('library');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-subpanel')).not.toBeNull();
  });
});
