import { Component, DestroyRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { NgFor } from '@angular/common';
import { Router, RouterLinkActive, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';

export type SidebarSection = 'library' | 'shelves';

interface SidebarNavItem {
  id: SidebarSection;
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgFor, RouterModule, RouterLinkActive, MatIconModule, MatSnackBarModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  @Input() activeSection: SidebarSection | null = null;
  @Output() selectSection = new EventEmitter<SidebarSection>();

  readonly navItems: SidebarNavItem[] = [
    {
      id: 'library',
      label: 'Library',
      icon: 'menu_book',
      route: '/',
      exact: true,
    },
    {
      id: 'shelves',
      label: 'Shelves',
      icon: 'grid_on',
      route: '/shelves',
    },
  ];

  readonly exactOptions = { exact: true } as const;
  readonly defaultOptions = { exact: false } as const;

  handleSectionClick(item: SidebarNavItem): void {
    this.selectSection.emit(item.id);
    this.router.navigate([item.route]);
  }

  handleLogoutClick(event: Event): void {
    event.preventDefault();
    this.logout();
  }

  private logout(): void {
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
