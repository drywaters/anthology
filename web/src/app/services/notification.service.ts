import { Injectable, inject } from '@angular/core';
import {
    MatSnackBar,
    MatSnackBarConfig,
    MatSnackBarRef,
    TextOnlySnackBar,
} from '@angular/material/snack-bar';

export interface NotificationOptions {
    duration?: number;
    action?: string;
    panelClass?: string | string[];
}

const DEFAULT_CONFIG: MatSnackBarConfig = {
    duration: 4000,
    horizontalPosition: 'center',
    verticalPosition: 'bottom',
};

@Injectable({ providedIn: 'root' })
export class NotificationService {
    private readonly snackBar = inject(MatSnackBar);

    show(message: string, options: NotificationOptions = {}): MatSnackBarRef<TextOnlySnackBar> {
        const config: MatSnackBarConfig = {
            ...DEFAULT_CONFIG,
            duration: options.duration ?? DEFAULT_CONFIG.duration,
            panelClass: options.panelClass,
        };

        return this.snackBar.open(message, options.action ?? 'Dismiss', config);
    }

    success(message: string, options: NotificationOptions = {}): MatSnackBarRef<TextOnlySnackBar> {
        return this.show(message, {
            ...options,
            panelClass: this.combineClasses('notification-success', options.panelClass),
        });
    }

    error(message: string, options: NotificationOptions = {}): MatSnackBarRef<TextOnlySnackBar> {
        return this.show(message, {
            duration: options.duration ?? 5000,
            ...options,
            panelClass: this.combineClasses('notification-error', options.panelClass),
        });
    }

    info(message: string, options: NotificationOptions = {}): MatSnackBarRef<TextOnlySnackBar> {
        return this.show(message, options);
    }

    warn(message: string, options: NotificationOptions = {}): MatSnackBarRef<TextOnlySnackBar> {
        return this.show(message, {
            ...options,
            panelClass: this.combineClasses('notification-warn', options.panelClass),
        });
    }

    private combineClasses(baseClass: string, additional?: string | string[]): string[] {
        const classes = [baseClass];
        if (additional) {
            if (Array.isArray(additional)) {
                classes.push(...additional);
            } else {
                classes.push(additional);
            }
        }
        return classes;
    }
}
