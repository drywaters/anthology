import { Item } from './item';

export type SeriesStatus = 'complete' | 'incomplete' | 'unknown';

export interface SeriesSummary {
    seriesName: string;
    ownedCount: number;
    totalVolumes?: number | null;
    missingCount?: number | null;
    status: SeriesStatus;
    items?: Item[];
    missingVolumes?: number[];
}

export interface MissingVolume {
    seriesName: string;
    volumeNumber: number;
}

export const SERIES_STATUS_LABELS: Record<SeriesStatus, string> = {
    complete: 'Complete',
    incomplete: 'Incomplete',
    unknown: 'Unknown',
};

export const SERIES_STATUS_COLORS: Record<SeriesStatus, string> = {
    complete: 'primary',
    incomplete: 'warn',
    unknown: 'accent',
};
