import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  request = request.clone({ withCredentials: true });

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        authService.markUnauthenticated();
        void router.navigate(['/login'], {
          queryParams: { redirectTo: router.url !== '/login' ? router.url : undefined },
        });
      }

      return throwError(() => error);
    })
  );
};
