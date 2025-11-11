import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { map, Observable } from 'rxjs';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state): Observable<boolean | UrlTree> => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.ensureSession().pipe(
        map((isAuthed) => {
            if (isAuthed) {
                return true;
            }
            return router.createUrlTree(['/login'], {
                queryParams: state.url ? { redirectTo: state.url } : undefined,
            });
        })
    );
};
