import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../../services/auth.service';

describe(LoginPageComponent.name, () => {
    let authServiceSpy: jasmine.SpyObj<AuthService>;
    let routerSpy: jasmine.SpyObj<Router>;

    beforeEach(async () => {
        authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'logout']);
        routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);

        await TestBed.configureTestingModule({
            imports: [LoginPageComponent],
            providers: [
                { provide: AuthService, useValue: authServiceSpy },
                { provide: Router, useValue: routerSpy },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: { queryParamMap: convertToParamMap({ redirectTo: '/items' }) },
                    },
                },
            ],
        }).compileComponents();
    });

    function createComponent() {
        const fixture = TestBed.createComponent(LoginPageComponent);
        fixture.detectChanges();
        return fixture;
    }

    it('submits a trimmed token and navigates to the redirect destination', () => {
        authServiceSpy.login.and.returnValue(of(void 0));
        const fixture = createComponent();
        const component = fixture.componentInstance;
        component.form.setValue({ token: '  local-dev-token  ' });

        component.submit();

        expect(authServiceSpy.login).toHaveBeenCalledWith('local-dev-token');
        expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/items');
        expect(component.submitting()).toBeFalse();
    });

    it('marks token control invalid when submitting empty tokens', () => {
        const fixture = createComponent();
        const component = fixture.componentInstance;
        component.form.setValue({ token: '   ' });

        component.submit();

        expect(authServiceSpy.login).not.toHaveBeenCalled();
        expect(component.tokenControl.hasError('required')).toBeTrue();
    });

    it('disables the form while submitting and re-enables on completion', () => {
        const loginSubject = new Subject<void>();
        authServiceSpy.login.and.returnValue(loginSubject.asObservable());
        const fixture = createComponent();
        const component = fixture.componentInstance;
        component.form.setValue({ token: 'local-dev-token' });

        component.submit();

        expect(component.form.disabled).toBeTrue();

        loginSubject.next();
        loginSubject.complete();

        expect(component.form.enabled).toBeTrue();
    });

    it('shows an error message when login returns 401', () => {
        authServiceSpy.login.and.returnValue(throwError(() => ({ status: 401 })));
        const fixture = createComponent();
        const component = fixture.componentInstance;
        component.form.setValue({ token: 'bad-token' });

        component.submit();

        expect(component.errorMessage()).toContain('Invalid token');
        expect(component.tokenControl.hasError('invalid')).toBeTrue();
    });

    it('clears the session and resets the form when logout succeeds', () => {
        authServiceSpy.logout.and.returnValue(of(void 0));
        const fixture = createComponent();
        const component = fixture.componentInstance;
        component.form.setValue({ token: 'something' });

        component.clearSession();

        expect(authServiceSpy.logout).toHaveBeenCalled();
        expect(component.form.value.token).toBe('');
        expect(component.errorMessage()).toBeNull();
    });
});
