import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LibraryActionsService {
    private readonly exportRequests = new Subject<void>();
    readonly exportRequested$ = this.exportRequests.asObservable();

    requestExport(): void {
        this.exportRequests.next();
    }
}
