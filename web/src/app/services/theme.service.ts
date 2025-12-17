import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | null;

const STORAGE_KEY = 'anthology.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    private readonly document = inject(DOCUMENT);
    private readonly preference = signal<ThemePreference>(null);
    private readonly systemPrefersDark = signal(false);

    readonly effectiveTheme = computed<'light' | 'dark'>(() => {
        const preference = this.preference();
        if (preference) return preference;
        return this.systemPrefersDark() ? 'dark' : 'light';
    });

    constructor() {
        this.systemPrefersDark.set(this.querySystemPrefersDark());

        const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
        mediaQuery?.addEventListener?.('change', (event) =>
            this.systemPrefersDark.set(event.matches),
        );

        this.applySavedPreference();
    }

    setPreference(preference: ThemePreference): void {
        this.preference.set(preference);

        if (preference) {
            this.document.documentElement.dataset['theme'] = preference;
            localStorage.setItem(STORAGE_KEY, preference);
        } else {
            delete this.document.documentElement.dataset['theme'];
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    toggle(): void {
        const next = this.effectiveTheme() === 'dark' ? 'light' : 'dark';
        this.setPreference(next);
    }

    private applySavedPreference(): void {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'light' || saved === 'dark') {
                this.setPreference(saved);
            }
        } catch {
            // Ignore storage errors (private mode, blocked storage, etc).
        }
    }

    private querySystemPrefersDark(): boolean {
        try {
            return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
        } catch {
            return false;
        }
    }
}
