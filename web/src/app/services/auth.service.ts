import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { environment } from '../config/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionUrl = `${environment.apiUrl}/session`;
  private readonly sessionState = new BehaviorSubject<boolean | null>(null);

  sessionChanges(): Observable<boolean | null> {
    return this.sessionState.asObservable();
  }

  isAuthenticated(): boolean {
    return this.sessionState.value === true;
  }

  ensureSession(): Observable<boolean> {
    const current = this.sessionState.value;
    if (current !== null) {
      return of(current);
    }
    return this.checkSession();
  }

  login(token: string): Observable<void> {
    return this.http
      .post<void>(
        this.sessionUrl,
        { token },
        { withCredentials: true }
      )
      .pipe(tap(() => this.sessionState.next(true)));
  }

  logout(): Observable<void> {
    return this.http.delete<void>(this.sessionUrl, { withCredentials: true }).pipe(
      tap(() => this.sessionState.next(false)),
      catchError((error: HttpErrorResponse) => {
        this.sessionState.next(false);
        if (error.status === 401) {
          return of(void 0);
        }
        return throwError(() => error);
      })
    );
  }

  markUnauthenticated(): void {
    this.sessionState.next(false);
  }

  private checkSession(): Observable<boolean> {
    return this.http.get<void>(this.sessionUrl, { withCredentials: true }).pipe(
      tap(() => this.sessionState.next(true)),
      map(() => true),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.sessionState.next(false);
          return of(false);
        }
        return throwError(() => error);
      })
    );
  }
}
