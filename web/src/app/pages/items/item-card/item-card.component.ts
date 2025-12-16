import { DatePipe, NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { BookStatus, Item } from '../../../models';
import { ThumbnailPipe } from '../../../pipes/thumbnail.pipe';
import {
    chipClassFor,
    labelFor,
    readingProgress,
    readingStatusLabel,
    ReadingProgress,
} from '../items.utils';

@Component({
    selector: 'app-item-card',
    standalone: true,
    imports: [DatePipe, NgClass, NgIf, MatButtonModule, MatIconModule, ThumbnailPipe],
    templateUrl: './item-card.component.html',
    styleUrl: './item-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemCardComponent {
    @Input({ required: true }) item!: Item;

    @Output() cardClicked = new EventEmitter<Item>();
    @Output() shelfLocationClicked = new EventEmitter<{ item: Item; event: MouseEvent }>();

    readonly BookStatus = BookStatus;

    onCardClick(): void {
        this.cardClicked.emit(this.item);
    }

    onShelfLocationClick(event: MouseEvent): void {
        this.shelfLocationClicked.emit({ item: this.item, event });
    }

    handleCardKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.cardClicked.emit(this.item);
        }
    }

    labelFor(item: Item): string {
        return labelFor(item);
    }

    readingStatusLabel(item: Item): string | null {
        return readingStatusLabel(item);
    }

    readingProgress(item: Item): ReadingProgress | null {
        return readingProgress(item);
    }

    chipClassFor(item: Item): string {
        return chipClassFor(item.itemType);
    }
}
