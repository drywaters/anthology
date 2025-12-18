import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NgIf } from '@angular/common';

import { SidebarComponent } from '../sidebar/sidebar.component';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { NavigationItem, ActionButton } from '../../models/navigation';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
    selector: 'app-shell',
    standalone: true,
    imports: [RouterOutlet, SidebarComponent, AppHeaderComponent, NgIf, MatSnackBarModule],
    templateUrl: './app-shell.component.html',
    styleUrl: './app-shell.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly notification = inject(NotificationService);
    private readonly destroyRef = inject(DestroyRef);

    readonly sidebarOpen = signal(false);

    readonly navItems: NavigationItem[] = [
        {
            id: 'library',
            label: 'Library',
            icon: 'menu_book',
            route: '/',
            actions: [
                { id: 'add-item', label: 'Add Item', icon: 'library_add', route: '/items/add' },
            ],
        },
        {
            id: 'shelves',
            label: 'Shelves',
            icon: 'grid_on',
            route: '/shelves',
            actions: [
                {
                    id: 'add-shelf',
                    label: 'Add Shelf',
                    icon: 'add_photo_alternate',
                    route: '/shelves/add',
                },
            ],
        },
    ];

    readonly actionItems: ActionButton[] = [{ id: 'logout', label: 'Log out', icon: 'logout' }];

    toggleSidebar(): void {
        this.sidebarOpen.update((open) => !open);
    }

    closeSidebar(): void {
        this.sidebarOpen.set(false);
    }

    handleNavigate(route: string): void {
        this.router.navigateByUrl(route);
        this.closeSidebar();
    }

    handleAction(actionId: string): void {
        if (actionId === 'logout') {
            this.logout();
            return;
        }

        const action = this.findAction(actionId);
        if (action?.route) {
            this.router.navigateByUrl(action.route);
        }

        this.closeSidebar();
    }

    private findAction(actionId: string): ActionButton | undefined {
        for (const item of this.navItems) {
            const match = item.actions?.find((action) => action.id === actionId);
            if (match) {
                return match;
            }
        }

        return this.actionItems.find((action) => action.id === actionId);
    }

    private logout(): void {
        this.authService
            .logout()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.closeSidebar();
                    this.router.navigate(['/login']);
                },
                error: () => {
                    this.notification.error('We could not clear your session; please try again.');
                    this.closeSidebar();
                    this.router.navigate(['/login']);
                },
            });
    }
}
