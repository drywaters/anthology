import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { environment } from '../config/environment';

export interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl: string;
}

export interface SessionStatus {
    authenticated: boolean;
    user?: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly http = inject(HttpClient);
    private readonly sessionUrl = `${environment.apiUrl}/session`;
    private readonly authUrl = `${environment.apiUrl}/auth`;

    private readonly sessionState = new BehaviorSubject<SessionStatus | null>(null);
    private readonly currentUser = new BehaviorSubject<User | null>(null);

    sessionChanges(): Observable<SessionStatus | null> {
        return this.sessionState.asObservable();
    }

    userChanges(): Observable<User | null> {
        return this.currentUser.asObservable();
    }

    isAuthenticated(): boolean {
        return this.sessionState.value?.authenticated === true;
    }

    getUser(): User | null {
        return this.currentUser.value;
    }

    ensureSession(): Observable<boolean> {
        const current = this.sessionState.value;
        if (current !== null) {
            return of(current.authenticated);
        }
        return this.checkSession().pipe(map((status) => status.authenticated));
    }

    loginWithGoogle(redirectTo?: string): void {
        const params = new URLSearchParams();
        if (redirectTo && redirectTo !== '/login') {
            params.set('redirectTo', redirectTo);
        }
        const url = `${this.authUrl}/google${params.toString() ? '?' + params.toString() : ''}`;
        this.redirectTo(url);
    }

    logout(): Observable<void> {
        return this.http.delete<void>(this.sessionUrl, { withCredentials: true }).pipe(
            tap(() => {
                this.sessionState.next({ authenticated: false });
                this.currentUser.next(null);
            }),
            catchError((error: HttpErrorResponse) => {
                this.sessionState.next({ authenticated: false });
                this.currentUser.next(null);
                if (error.status === 401) {
                    return of(void 0);
                }
                return throwError(() => error);
            }),
        );
    }

    markUnauthenticated(): void {
        this.sessionState.next({ authenticated: false });
        this.currentUser.next(null);
    }

    private checkSession(): Observable<SessionStatus> {
        return this.http.get<SessionStatus>(this.sessionUrl, { withCredentials: true }).pipe(
            tap((status) => {
                this.sessionState.next(status);
                this.currentUser.next(status.user ?? null);
            }),
            catchError((error: HttpErrorResponse) => {
                const status: SessionStatus = { authenticated: false };
                this.sessionState.next(status);
                this.currentUser.next(null);
                if (error.status === 401 || error.status === 0) {
                    return of(status);
                }
                return throwError(() => error);
            }),
        );
    }

    private redirectTo(url: string): void {
        window.location.href = url;
    }
}
