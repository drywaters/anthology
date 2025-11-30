import { Component, DestroyRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { NgFor } from '@angular/common';
import { Router, RouterLinkActive, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';

export type SidebarSection = 'library' | 'shelves';

export interface SidebarChildItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
  isAction?: boolean;
  hint?: string;
}

export interface SidebarNavSection {
  id: SidebarSection;
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
  children: SidebarChildItem[];
}

export const SIDEBAR_SECTIONS: SidebarNavSection[] = [
  {
    id: 'library',
    label: 'Library',
    icon: 'menu_book',
    route: '/',
    exact: true,
    children: [
      {
        id: 'library-home',
        label: 'All Items',
        icon: 'collections_bookmark',
        route: '/',
        exact: true,
        hint: 'Browse your entire collection',
      },
      {
        id: 'add-item',
        label: 'Add Item',
        icon: 'library_add',
        route: '/items/add',
        exact: true,
        isAction: true,
        hint: 'Capture a new title',
      },
    ],
  },
  {
    id: 'shelves',
    label: 'Shelves',
    icon: 'grid_on',
    route: '/shelves',
    children: [
      { id: 'shelf-list', label: 'All Shelves', icon: 'view_list', route: '/shelves', hint: 'Arrange your collection' },
      {
        id: 'add-shelf',
        label: 'Add Shelf',
        icon: 'add_photo_alternate',
        route: '/shelves/add',
        exact: true,
        isAction: true,
        hint: 'Create a new shelf',
      },
    ],
  },
];

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
  @Input() sections: SidebarNavSection[] = SIDEBAR_SECTIONS;
  @Output() selectSection = new EventEmitter<SidebarSection>();

  readonly exactOptions = { exact: true } as const;
  readonly defaultOptions = { exact: false } as const;

  handleSectionClick(item: SidebarNavSection): void {
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
