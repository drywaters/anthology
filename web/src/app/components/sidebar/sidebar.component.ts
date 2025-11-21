import { Component, DestroyRef, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';

interface SidebarNavItem {
    label: string;
    icon: string;
    route?: string;
    disabled?: boolean;
}

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [NgFor, NgIf, RouterModule, MatIconModule, MatSnackBarModule],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    readonly navItems: SidebarNavItem[] = [
        { label: 'Library', icon: 'menu_book', route: '/' },
        { label: 'Add Item', icon: 'library_add', route: '/items/add' },
    ];

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
