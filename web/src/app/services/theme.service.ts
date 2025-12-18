import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | null;
export type DensityPreference = 'default' | 'compact';

const THEME_STORAGE_KEY = 'anthology.theme';
const DENSITY_STORAGE_KEY = 'anthology.density';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    private readonly document = inject(DOCUMENT);
    private readonly preference = signal<ThemePreference>(null);
    private readonly systemPrefersDark = signal(false);
    private readonly densityPreference = signal<DensityPreference>('default');

    readonly effectiveTheme = computed<'light' | 'dark'>(() => {
        const preference = this.preference();
        if (preference) return preference;
        return this.systemPrefersDark() ? 'dark' : 'light';
    });

    readonly density = computed(() => this.densityPreference());

    constructor() {
        this.systemPrefersDark.set(this.querySystemPrefersDark());

        const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
        mediaQuery?.addEventListener?.('change', (event) =>
            this.systemPrefersDark.set(event.matches),
        );

        this.applySavedPreferences();
    }

    setPreference(preference: ThemePreference): void {
        this.preference.set(preference);

        if (preference) {
            this.document.documentElement.dataset['theme'] = preference;
            localStorage.setItem(THEME_STORAGE_KEY, preference);
        } else {
            delete this.document.documentElement.dataset['theme'];
            localStorage.removeItem(THEME_STORAGE_KEY);
        }
    }

    setDensity(density: DensityPreference): void {
        this.densityPreference.set(density);

        if (density === 'compact') {
            this.document.documentElement.dataset['density'] = density;
            localStorage.setItem(DENSITY_STORAGE_KEY, density);
        } else {
            delete this.document.documentElement.dataset['density'];
            localStorage.removeItem(DENSITY_STORAGE_KEY);
        }
    }

    toggle(): void {
        const next = this.effectiveTheme() === 'dark' ? 'light' : 'dark';
        this.setPreference(next);
    }

    toggleDensity(): void {
        const next = this.densityPreference() === 'compact' ? 'default' : 'compact';
        this.setDensity(next);
    }

    private applySavedPreferences(): void {
        try {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme === 'light' || savedTheme === 'dark') {
                this.setPreference(savedTheme);
            }

            const savedDensity = localStorage.getItem(DENSITY_STORAGE_KEY);
            if (savedDensity === 'compact') {
                this.setDensity(savedDensity);
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
