export interface CsvImportSummary {
    totalRows: number;
    imported: number;
    skippedDuplicates: CsvImportDuplicate[];
    failed: CsvImportFailure[];
}

export interface CsvImportDuplicate {
    row: number;
    title?: string;
    identifier?: string;
    reason: string;
}

export interface CsvImportFailure {
    row: number;
    title?: string;
    identifier?: string;
    error: string;
}
