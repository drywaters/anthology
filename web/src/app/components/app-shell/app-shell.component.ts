import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgIf } from '@angular/common';

import { SidebarComponent } from '../sidebar/sidebar.component';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { NavigationItem, ActionButton } from '../../models/navigation';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-shell',
    standalone: true,
    imports: [RouterOutlet, SidebarComponent, AppHeaderComponent, NgIf],
    templateUrl: './app-shell.component.html',
    styleUrl: './app-shell.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    readonly sidebarOpen = signal(false);

    readonly navItems: NavigationItem[] = [
        { id: 'library', label: 'Library', icon: 'menu_book', route: '/' },
        { id: 'shelves', label: 'Shelves', icon: 'grid_on', route: '/shelves' },
    ];

    readonly actionItems: ActionButton[] = [
        { id: 'add-item', label: 'Add Item', icon: 'library_add', route: '/items/add' },
        { id: 'add-shelf', label: 'Add Shelf', icon: 'add_photo_alternate', route: '/shelves/add' },
        { id: 'logout', label: 'Log out', icon: 'logout' },
    ];

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

        const action = this.actionItems.find((item) => item.id === actionId);
        if (action?.route) {
            this.router.navigateByUrl(action.route);
        }

        this.closeSidebar();
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
                    this.snackBar.open('We could not clear your session; please try again.', 'Dismiss', { duration: 5000 });
                    this.closeSidebar();
                    this.router.navigate(['/login']);
                },
            });
    }
}
