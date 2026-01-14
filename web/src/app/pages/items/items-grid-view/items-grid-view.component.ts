import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
    Signal,
} from '@angular/core';

import { Item } from '../../../models';
import { ItemCardComponent } from '../item-card/item-card.component';
import { LetterGroup } from '../items-page.component';

@Component({
    selector: 'app-items-grid-view',
    standalone: true,
    imports: [ItemCardComponent],
    templateUrl: './items-grid-view.component.html',
    styleUrl: './items-grid-view.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemsGridViewComponent {
    @Input({ required: true }) groupedItems!: Signal<LetterGroup[]>;

    @Output() itemSelected = new EventEmitter<Item>();
    @Output() shelfLocationRequested = new EventEmitter<{ item: Item; event: MouseEvent }>();
    @Output() seriesRequested = new EventEmitter<{ item: Item; event: MouseEvent }>();

    onItemSelected(item: Item): void {
        this.itemSelected.emit(item);
    }

    onShelfLocationRequested(data: { item: Item; event: MouseEvent }): void {
        this.shelfLocationRequested.emit(data);
    }

    onSeriesRequested(data: { item: Item; event: MouseEvent }): void {
        this.seriesRequested.emit(data);
    }

    trackByLetter(_: number, group: LetterGroup): string {
        return group.letter;
    }

    trackById(_: number, item: Item): string {
        return item.id;
    }
}
