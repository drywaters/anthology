import { Component, DestroyRef, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router, RouterLinkActive, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';

interface SidebarNavItem {
    label: string;
    icon: string;
    route?: string;
    disabled?: boolean;
    exact?: boolean;
    children?: SidebarNavItem[];
}

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [NgFor, NgIf, RouterModule, RouterLinkActive, MatIconModule, MatSnackBarModule],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    readonly navItems: SidebarNavItem[] = [
        {
            label: 'Library',
            icon: 'menu_book',
            route: '/',
            exact: true,
            children: [{ label: 'Add Item', icon: 'library_add', route: '/items/add', exact: true }],
        },
        {
            label: 'Shelves',
            icon: 'grid_on',
            route: '/shelves',
            children: [{ label: 'Add Shelf', icon: 'add_photo_alternate', route: '/shelves/add', exact: true }],
        },
    ];

    readonly exactOptions = { exact: true } as const;
    readonly defaultOptions = { exact: false } as const;
    expandedSection: string | null = null;

    handleSectionClick(item: SidebarNavItem): void {
        if (!item.children?.length || !item.route) {
            return;
        }

        this.expandedSection = this.expandedSection === item.route ? null : item.route;
    }

    handleLogoutClick(event: Event): void {
        event.preventDefault();
        this.logout();
    }

    logout(): void {
        this.authService
            .logout()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.router.navigate(['/login']);
                },
                error: () => {
                    this.snackBar.open('We could not clear your session; please try again.', 'Dismiss', { duration: 5000 });
                    this.router.navigate(['/login']);
                },
            });
    }
}
