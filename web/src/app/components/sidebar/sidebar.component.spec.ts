import { fakeAsync, flush, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';

import { SidebarComponent } from './sidebar.component';
import { AuthService } from '../../services/auth.service';

describe(SidebarComponent.name, () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let router: Router;
  let snackBarSpy: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['logout']);
    snackBarSpy = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
      ],
    })
      .overrideProvider(MatSnackBar, { useValue: snackBarSpy })
      .compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  function createComponent() {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the Anthology brand mark and title', () => {
    const fixture = createComponent();
    const compiled = fixture.nativeElement as HTMLElement;
    const brandMark = compiled.querySelector('.brand-mark') as HTMLImageElement | null;
    const brandTitle = compiled.querySelector('.brand-title');

    expect(brandMark).not.toBeNull();
    expect(brandMark?.getAttribute('alt')).toContain('Anthology');
    expect(brandTitle?.textContent?.trim()).toBe('Anthology');
  });

  it('renders nav links for every nav item', () => {
    const fixture = createComponent();
    const anchors = fixture.nativeElement.querySelectorAll('.nav a.nav-link');
    expect(anchors.length).toBe(fixture.componentInstance.navItems.length);
  });

  it('emits the selected section and navigates when a nav link is clicked', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    spyOn(component.selectSection, 'emit');
    const firstLink = fixture.nativeElement.querySelector('.nav a.nav-link') as HTMLAnchorElement;
    firstLink.click();

    const firstSection = component.navItems[0].id;
    expect(component.selectSection.emit).toHaveBeenCalledWith(firstSection);
    expect(router.navigate).toHaveBeenCalledWith([component.navItems[0].route]);
  });

  it('logs out and routes to login when the logout button is pressed', fakeAsync(() => {
    authServiceSpy.logout.and.returnValue(of(void 0));
    const fixture = createComponent();
    const logoutButton = fixture.nativeElement.querySelector('.sidebar-footer .logout') as HTMLAnchorElement;
    logoutButton.click();
    flush();
    expect(authServiceSpy.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  }));

  it('shows a snack bar message when logout fails but still navigates away', fakeAsync(() => {
    authServiceSpy.logout.and.returnValue(throwError(() => new Error('fail')));
    const fixture = createComponent();
    const logoutButton = fixture.nativeElement.querySelector('.sidebar-footer .logout') as HTMLAnchorElement;
    logoutButton.click();
    flush();
    expect(snackBarSpy.open).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  }));
});
