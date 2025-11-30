import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { SidebarSection } from '../sidebar/sidebar.component';

export interface ActionButton {
  id: string;
  label: string;
  icon?: string;
  route?: string;
}

@Component({
  selector: 'app-subpanel',
  standalone: true,
  imports: [NgFor, NgIf, MatIconModule],
  templateUrl: './subpanel.component.html',
  styleUrl: './subpanel.component.scss',
})
export class SubpanelComponent {
  @Input() section: SidebarSection | null = null;
  @Input() actions: ActionButton[] = [];
  @Output() back = new EventEmitter<void>();
  @Output() actionTriggered = new EventEmitter<string>();

  get sectionTitle(): string {
    return this.section === 'shelves' ? 'Shelves' : 'Library';
  }

  handleBack(): void {
    this.back.emit();
  }

  handleAction(action: ActionButton): void {
    this.actionTriggered.emit(action.id);
  }
}
