import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { environment } from '../config/environment';

/** Cached API origin for credential scoping. */
const apiOrigin = (() => {
    try {
        return new URL(environment.apiUrl).origin;
    } catch {
        return null;
    }
})();

/** Check if a request URL belongs to our API origin. */
function isApiRequest(url: string): boolean {
    if (!apiOrigin) {
        return false;
    }
    try {
        return new URL(url, window.location.origin).origin === apiOrigin;
    } catch {
        return false;
    }
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Only attach credentials to requests targeting our API origin
    if (isApiRequest(request.url)) {
        request = request.clone({ withCredentials: true });
    }

    return next(request).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
                authService.markUnauthenticated();
                void router.navigate(['/login'], {
                    queryParams: { redirectTo: router.url !== '/login' ? router.url : undefined },
                });
            }

            return throwError(() => error);
        }),
    );
};
