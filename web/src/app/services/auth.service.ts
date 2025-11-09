import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'anthology.apiToken';
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly tokenSubject = new BehaviorSubject<string | null>(this.readToken());

  tokenChanges(): Observable<string | null> {
    return this.tokenSubject.asObservable();
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  isAuthenticated(): boolean {
    return this.tokenSubject.value !== null;
  }

  setToken(token: string): void {
    const normalized = token.trim();
    if (normalized === '') {
      this.clearToken();
      return;
    }

    this.tokenSubject.next(normalized);
    if (this.isBrowser) {
      window.localStorage.setItem(this.storageKey, normalized);
    }
  }

  clearToken(): void {
    this.tokenSubject.next(null);
    if (this.isBrowser) {
      window.localStorage.removeItem(this.storageKey);
    }
  }

  private readToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }

    const stored = window.localStorage.getItem(this.storageKey);
    if (!stored) {
      return null;
    }

    const normalized = stored.trim();
    return normalized === '' ? null : normalized;
  }
}
