import { NgFor, NgIf } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
    Signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import { BookStatusFilter, ItemType, ShelfStatusFilter } from '../../../models';

export type ItemTypeFilter = ItemType | 'all';
export type ViewMode = 'table' | 'grid' | 'series';

@Component({
    selector: 'app-items-filter-panel',
    standalone: true,
    imports: [NgFor, NgIf, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule],
    templateUrl: './items-filter-panel.component.html',
    styleUrl: './items-filter-panel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemsFilterPanelComponent {
    @Input({ required: true }) typeFilter!: Signal<ItemTypeFilter>;
    @Input({ required: true }) statusFilter!: Signal<BookStatusFilter>;
    @Input({ required: true }) shelfStatusFilter!: Signal<ShelfStatusFilter>;
    @Input({ required: true }) showStatusFilter!: Signal<boolean>;
    @Input({ required: true }) viewMode!: Signal<ViewMode>;
    @Input() typeOptions: Array<{ value: ItemTypeFilter; label: string }> = [];
    @Input() statusOptions: Array<{ value: BookStatusFilter; label: string }> = [];
    @Input() shelfStatusOptions: Array<{ value: ShelfStatusFilter; label: string }> = [];

    @Output() typeFilterChange = new EventEmitter<ItemTypeFilter>();
    @Output() statusFilterChange = new EventEmitter<BookStatusFilter>();
    @Output() shelfStatusFilterChange = new EventEmitter<ShelfStatusFilter>();
    @Output() viewModeChange = new EventEmitter<ViewMode>();

    onTypeChange(value: ItemTypeFilter): void {
        this.typeFilterChange.emit(value);
    }

    onStatusChange(value: BookStatusFilter): void {
        this.statusFilterChange.emit(value);
    }

    onShelfStatusChange(value: ShelfStatusFilter): void {
        this.shelfStatusFilterChange.emit(value);
    }

    onViewModeChange(mode: ViewMode): void {
        this.viewModeChange.emit(mode);
    }

    isTableView(): boolean {
        return this.viewMode() === 'table';
    }

    isGridView(): boolean {
        return this.viewMode() === 'grid';
    }

    isSeriesView(): boolean {
        return this.viewMode() === 'series';
    }
}
