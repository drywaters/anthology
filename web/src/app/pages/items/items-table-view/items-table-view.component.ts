import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
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
import { MatTableModule } from '@angular/material/table';

import { Item, ItemType } from '../../../models';
import { LetterGroup } from '../items-page.component';
import { ItemTypeFilter } from '../items-filter-panel/items-filter-panel.component';
import { chipClassFor, labelFor, readingProgress, ReadingProgress } from '../items.utils';

@Component({
    selector: 'app-items-table-view',
    standalone: true,
    imports: [DatePipe, NgClass, NgFor, NgIf, MatButtonModule, MatIconModule, MatTableModule],
    templateUrl: './items-table-view.component.html',
    styleUrl: './items-table-view.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemsTableViewComponent {
    @Input({ required: true }) groupedItems!: Signal<LetterGroup[]>;
    @Input({ required: true }) typeFilter!: Signal<ItemTypeFilter>;
    @Input() displayedColumns: readonly string[] = [
        'title',
        'creator',
        'itemType',
        'releaseYear',
        'updatedAt',
    ];

    @Output() itemSelected = new EventEmitter<Item>();
    @Output() shelfLocationRequested = new EventEmitter<{ item: Item; event: MouseEvent }>();
    @Output() typeFilterRequested = new EventEmitter<ItemType>();
    @Output() seriesRequested = new EventEmitter<{ item: Item; event: MouseEvent }>();

    onItemSelected(item: Item): void {
        this.itemSelected.emit(item);
    }

    onShelfLocationRequested(item: Item, event: MouseEvent): void {
        this.shelfLocationRequested.emit({ item, event });
    }

    onTypeFilterRequested(itemType: ItemType, event: MouseEvent): void {
        event.stopPropagation();
        this.typeFilterRequested.emit(itemType);
    }

    onSeriesRequested(item: Item, event: MouseEvent): void {
        event.stopPropagation();
        this.seriesRequested.emit({ item, event });
    }

    handleRowKeydown(event: KeyboardEvent, item: Item): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.itemSelected.emit(item);
        }
    }

    trackByLetter(_: number, group: LetterGroup): string {
        return group.letter;
    }

    trackById(_: number, item: Item): string {
        return item.id;
    }

    labelFor(item: Item): string {
        return labelFor(item);
    }

    readingProgress(item: Item): ReadingProgress | null {
        return readingProgress(item);
    }

    chipClassFor(itemType: ItemType): string {
        return chipClassFor(itemType);
    }
}
