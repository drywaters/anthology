import { NgClass, NgFor, NgIf } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
    Signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import { Item, SeriesStatus, SeriesSummary, SERIES_STATUS_LABELS } from '../../../models';
import { ItemCardComponent } from '../item-card/item-card.component';

const STATUS_CLASS_MAP: Record<SeriesStatus, string> = {
    complete: 'status-complete',
    incomplete: 'status-incomplete',
    unknown: 'status-unknown',
};

@Component({
    selector: 'app-items-series-view',
    standalone: true,
    imports: [
        NgClass,
        NgFor,
        NgIf,
        MatButtonModule,
        MatExpansionModule,
        MatIconModule,
        MatChipsModule,
        ItemCardComponent,
    ],
    templateUrl: './items-series-view.component.html',
    styleUrl: './items-series-view.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemsSeriesViewComponent {
    @Input({ required: true }) seriesData!: Signal<SeriesSummary[]>;
    @Input({ required: true }) standaloneItems!: Signal<Item[]>;
    @Input({ required: true }) expandedSeries!: Signal<Set<string>>;

    @Output() seriesToggled = new EventEmitter<string>();
    @Output() itemSelected = new EventEmitter<Item>();
    @Output() addMissingVolume = new EventEmitter<{ seriesName: string; volumeNumber: number }>();
    @Output() viewSeriesDetail = new EventEmitter<string>();

    standaloneExpanded = false;

    isExpanded(seriesName: string): boolean {
        return this.expandedSeries().has(seriesName);
    }

    toggleStandaloneExpanded(): void {
        this.standaloneExpanded = !this.standaloneExpanded;
    }

    onPanelToggle(seriesName: string): void {
        this.seriesToggled.emit(seriesName);
    }

    onItemSelected(item: Item): void {
        this.itemSelected.emit(item);
    }

    onAddMissingVolume(seriesName: string, volumeNumber: number): void {
        this.addMissingVolume.emit({ seriesName, volumeNumber });
    }

    onViewSeriesDetail(seriesName: string): void {
        this.viewSeriesDetail.emit(seriesName);
    }

    getStatusClass(status: SeriesStatus): string {
        return STATUS_CLASS_MAP[status];
    }

    getStatusLabel(status: SeriesStatus): string {
        return SERIES_STATUS_LABELS[status];
    }

    trackBySeries(_: number, series: SeriesSummary): string {
        return series.seriesName;
    }

    trackById(_: number, item: Item): string {
        return item.id;
    }

    trackByVolume(_: number, volume: number): number {
        return volume;
    }
}
