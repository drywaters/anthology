import { CommonModule } from '@angular/common';
import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    Output,
    ViewChild,
    signal,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
    selector: 'app-barcode-scanner',
    standalone: true,
    imports: [CommonModule, MatProgressSpinnerModule],
    templateUrl: './barcode-scanner.component.html',
    styleUrl: './barcode-scanner.component.scss',
})
export class BarcodeScannerComponent implements AfterViewInit {
    @Input() scannerActive = false;
    @Input() scannerReady = false;
    @Input() scannerStatus: string | null = null;
    @Input() scannerError: string | null = null;
    @Input() scannerProcessing = false;
    @Input() scannerFlash = false;

    @Output() videoElementReady = new EventEmitter<HTMLVideoElement>();

    @ViewChild('scanVideo') scanVideo?: ElementRef<HTMLVideoElement>;

    readonly videoVisible = signal(false);

    ngAfterViewInit(): void {
        if (this.scanVideo?.nativeElement) {
            this.videoElementReady.emit(this.scanVideo.nativeElement);
        }
    }

    getVideoElement(): HTMLVideoElement | null {
        return this.scanVideo?.nativeElement ?? null;
    }
}
