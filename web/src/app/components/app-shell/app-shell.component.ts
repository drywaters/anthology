import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SidebarChildItem, SidebarComponent, SidebarNavSection, SidebarSection, SIDEBAR_SECTIONS } from '../sidebar/sidebar.component';
import { ActionButton, SubpanelComponent } from '../subpanel/subpanel.component';
import { MatIconModule } from '@angular/material/icon';

export type SidebarPanel = 'main' | SidebarSection;

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, SubpanelComponent, NgIf, MatIconModule],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly activePanel = signal<SidebarPanel>('main');
  readonly sidebarOpen = signal(true);
  readonly isMobile = signal(false);

  readonly sections: SidebarNavSection[] = SIDEBAR_SECTIONS;

  readonly libraryActions: ActionButton[] = this.sections
    .find((section) => section.id === 'library')
    ?.children.filter((child) => child.isAction)
    .map((child) => ({ id: child.id, label: child.label, icon: child.icon, route: child.route })) ?? [];

  readonly shelfActions: ActionButton[] = this.sections
    .find((section) => section.id === 'shelves')
    ?.children.filter((child) => child.isAction)
    .map((child) => ({ id: child.id, label: child.label, icon: child.icon, route: child.route })) ?? [];

  readonly subpanelVisible = computed(() => this.activePanel() !== 'main');
  readonly currentSection = computed<SidebarSection | null>(() => {
    const panel = this.activePanel();
    return panel === 'main' ? null : panel;
  });

  constructor() {
    this.breakpointObserver
      .observe(['(max-width: 959px)'])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ matches }) => {
        this.isMobile.set(matches);
        if (matches) {
          this.sidebarOpen.set(false);
          this.activePanel.set('main');
        } else {
          this.sidebarOpen.set(true);
        }
      });
  }

  openSidebar(): void {
    this.sidebarOpen.set(true);
    this.activePanel.set('main');
  }

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
    if (!this.sidebarOpen()) {
      this.activePanel.set('main');
    }
  }

  closeAllPanels(): void {
    this.sidebarOpen.set(false);
    this.activePanel.set('main');
  }

  handleSelectSection(section: SidebarSection): void {
    this.activePanel.set(section);
    if (section === 'library') {
      this.router.navigate(['/']);
    } else {
      this.router.navigate(['/shelves']);
    }

    if (this.isMobile()) {
      this.sidebarOpen.set(true);
    }
  }

  handleBack(): void {
    this.activePanel.set('main');
    this.sidebarOpen.set(!this.isMobile());
  }

  handleActionTriggered(actionId: string): void {
    const actions = this.activePanel() === 'library' ? this.libraryActions : this.shelfActions;
    const target = actions.find((action) => action.id === actionId);

    if (target?.route) {
      this.router.navigate([target.route]);
    }

    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }

    this.activePanel.set('main');
  }

  panelActions(section: SidebarPanel): ActionButton[] {
    if (section === 'library') {
      return this.libraryActions;
    }

    if (section === 'shelves') {
      return this.shelfActions;
    }

    return [];
  }

  panelLinks(section: SidebarPanel): SidebarChildItem[] {
    const target = this.sections.find((candidate) => candidate.id === section);
    return target?.children ?? [];
  }

  handleLinkSelected(link: SidebarChildItem): void {
    if (link.route) {
      this.router.navigate([link.route]);
    }

    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }

    this.activePanel.set('main');
  }
}
