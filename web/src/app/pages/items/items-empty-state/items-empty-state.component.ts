import { NgIf } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
    Signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-items-empty-state',
    standalone: true,
    imports: [NgIf, MatButtonModule, MatIconModule],
    templateUrl: './items-empty-state.component.html',
    styleUrl: './items-empty-state.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemsEmptyStateComponent {
    @Input({ required: true }) isUnfiltered!: Signal<boolean>;
    @Input({ required: true }) loading!: Signal<boolean>;

    @Output() createRequested = new EventEmitter<void>();

    onCreate(): void {
        this.createRequested.emit();
    }
}
