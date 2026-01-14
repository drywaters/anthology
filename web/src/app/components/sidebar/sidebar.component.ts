import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { RouterLinkActive, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { ActionButton, NavigationItem } from '../../models/navigation';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [RouterModule, RouterLinkActive, MatIconModule, MatButtonModule],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
    @Input() navItems: NavigationItem[] = [];
    @Input() actionItems: ActionButton[] = [];
    @Input() open = false;

    @Output() readonly closed = new EventEmitter<void>();
    @Output() readonly navigate = new EventEmitter<string>();
    @Output() readonly actionTriggered = new EventEmitter<string>();

    readonly exactOptions = { exact: true } as const;

    handleNavigate(route: string): void {
        this.navigate.emit(route);
    }

    handleAction(actionId: string): void {
        this.actionTriggered.emit(actionId);
    }
}
