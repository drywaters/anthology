import { Injectable, signal, inject } from '@angular/core';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import {
    BarcodeFormat,
    DecodeHintType,
    Exception,
    NotFoundException,
    Result,
} from '@zxing/library';
import { ScanFeedbackService } from './scan-feedback.service';

type SupportedBarcodeFormat = 'ean_13' | 'ean_8' | 'code_128' | 'upc_a' | 'upc_e';

interface BarcodeDetectionResult {
    rawValue?: string;
}

interface BarcodeDetectorOptions {
    formats?: SupportedBarcodeFormat[];
}

interface BarcodeDetector {
    detect(source: ImageBitmapSource): Promise<BarcodeDetectionResult[]>;
}

interface BarcodeDetectorConstructor {
    new (options?: BarcodeDetectorOptions): BarcodeDetector;
    getSupportedFormats(): Promise<SupportedBarcodeFormat[]>;
}

declare const BarcodeDetector: BarcodeDetectorConstructor;

export interface BarcodeScanResult {
    rawValue: string;
}

export type ScannerMode = 'native' | 'zxing';

@Injectable({
    providedIn: 'root',
})
export class BarcodeScannerService {
    private static readonly DETECTION_DEBOUNCE_MS = 3000;
    private static readonly FLASH_DURATION_MS = 640;
    private static readonly VIDEO_READY_TIMEOUT_MS = 3000;

    private readonly preferredBarcodeFormats: SupportedBarcodeFormat[] = [
        'ean_13',
        'ean_8',
        'code_128',
        'upc_a',
        'upc_e',
    ];

    private barcodeDetector: BarcodeDetector | null = null;
    private scanStream: MediaStream | null = null;
    private scanFrameId: number | null = null;
    private scannerMode: ScannerMode | null = null;
    private zxingReader: BrowserMultiFormatReader | null = null;
    private zxingControls: IScannerControls | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private onScanCallback: ((result: BarcodeScanResult) => void) | null = null;
    private processingDetection = false;
    private lastDetectedValue: string | null = null;
    private lastDetectedAt = 0;
    private statusClearTimer: number | null = null;
    private flashTimer: number | null = null;

    private readonly scanFeedback = inject(ScanFeedbackService);

    readonly scannerActive = signal(false);
    readonly scannerStatus = signal<string | null>(null);
    readonly scannerError = signal<string | null>(null);
    readonly scannerSupported = signal<boolean | null>(null);
    readonly scannerHint = signal<string | null>(null);
    readonly scannerProcessing = signal(false);
    readonly scannerFlash = signal(false);
    readonly scannerReady = signal(false);

    async startScanner(
        videoElement: HTMLVideoElement,
        onScan: (result: BarcodeScanResult) => void,
    ): Promise<void> {
        if (this.scannerActive()) {
            return;
        }

        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            this.scannerSupported.set(false);
            this.scannerError.set('Camera access is not available in this browser.');
            return;
        }

        this.videoElement = videoElement;
        this.onScanCallback = onScan;
        this.processingDetection = false;
        this.scannerProcessing.set(false);
        this.scannerReady.set(false);
        this.clearTransientMessages();
        this.scannerError.set(null);
        this.scannerStatus.set('Checking camera support...');
        this.scannerActive.set(true);

        const scannerMode = await this.resolveBarcodeScanner();
        if (!this.scannerActive()) {
            return;
        }

        if (!scannerMode) {
            this.scannerActive.set(false);
            this.scannerStatus.set(null);
            return;
        }

        try {
            if (!this.scannerActive()) {
                return;
            }

            this.scannerStatus.set('Starting camera...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false,
            });

            if (!this.scannerActive()) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }

            this.scanStream = stream;
            this.videoElement.srcObject = this.scanStream;
            await this.videoElement.play();
            await this.waitForVideoReady(this.videoElement);

            if (!this.scannerActive()) {
                this.stopScannerStream();
                this.videoElement.pause();
                this.videoElement.srcObject = null;
                return;
            }

            this.scannerMode = scannerMode;
            this.scannerReady.set(true);
            this.scannerHint.set('Align an ISBN barcode within the frame.');
            this.scannerStatus.set(null);

            if (scannerMode === 'native') {
                this.scheduleNextScan();
            } else {
                this.startZxingDetection();
            }
        } catch (error) {
            console.error('Unable to start barcode scanner', error);
            this.scannerError.set('Camera access failed. Confirm permissions and try again.');
            this.scannerStatus.set(null);
            this.stopScanner({ preserveError: true });
        }
    }

    stopScanner(
        options: { preserveError?: boolean; preserveHint?: boolean; preserveStatus?: boolean } = {},
    ): void {
        const preservedError = options.preserveError ? this.scannerError() : null;
        const preservedHint = options.preserveHint ? this.scannerHint() : null;
        const preservedStatus = options.preserveStatus ? this.scannerStatus() : null;

        this.scannerActive.set(false);
        this.processingDetection = false;
        this.scannerProcessing.set(false);
        this.scannerReady.set(false);
        this.clearStatusTimer();
        this.clearFlashTimer();
        this.scannerStatus.set(null);
        this.scannerError.set(null);
        this.scannerHint.set(null);
        this.clearScannerAnimation();
        this.stopZxingControls();
        this.stopScannerStream();
        this.scannerMode = null;
        this.onScanCallback = null;

        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.srcObject = null;
            this.videoElement = null;
        }

        if (preservedStatus) {
            this.scannerStatus.set(preservedStatus);
        }
        if (preservedHint) {
            this.scannerHint.set(preservedHint);
        }
        if (preservedError) {
            this.scannerError.set(preservedError);
        }
    }

    private scheduleNextScan(): void {
        this.scanFrameId = requestAnimationFrame(() => {
            void this.detectBarcodeFrame();
        });
    }

    private async detectBarcodeFrame(): Promise<void> {
        if (!this.scannerActive() || !this.barcodeDetector || !this.videoElement) {
            return;
        }

        if (this.videoElement.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
            this.scheduleNextScan();
            return;
        }

        try {
            const codes = await this.barcodeDetector.detect(this.videoElement);
            const found = codes.find((code: BarcodeDetectionResult) =>
                (code.rawValue ?? '').trim(),
            );

            if (found?.rawValue) {
                const value = found.rawValue.trim();
                if (this.beginProcessing(value)) {
                    this.handleDetectedBarcode(value);
                }
                this.scheduleNextScan();
                return;
            }
        } catch (error) {
            console.error('Barcode detection failed', error);
            this.scannerError.set(
                'Unable to read the barcode. Try adjusting lighting or typing the code.',
            );
            this.stopScanner({ preserveError: true });
            return;
        }

        this.scheduleNextScan();
    }

    private startZxingDetection(): void {
        if (!this.zxingReader || !this.videoElement) {
            this.scannerError.set('Barcode scanning is not available on this device.');
            this.stopScanner({ preserveError: true });
            return;
        }

        this.zxingReader
            .decodeFromVideoElement(
                this.videoElement,
                (
                    result: Result | null | undefined,
                    error: Exception | null | undefined,
                    controls,
                ) => {
                    this.zxingControls = controls;

                    if (result?.getText()) {
                        const value = result.getText().trim();
                        if (this.beginProcessing(value)) {
                            this.handleDetectedBarcode(value);
                        }
                        return;
                    }

                    if (error && !(error instanceof NotFoundException)) {
                        console.error('Barcode detection failed', error);
                        this.scannerError.set(
                            'Unable to read the barcode. Try adjusting lighting or typing the code.',
                        );
                        this.stopScanner({ preserveError: true });
                    }
                },
            )
            .catch((error: unknown) => {
                console.error('Barcode detection failed', error);
                this.scannerError.set(
                    'Unable to read the barcode. Try adjusting lighting or typing the code.',
                );
                this.stopScanner({ preserveError: true });
            });
    }

    private handleDetectedBarcode(rawValue: string): void {
        const value = rawValue.trim();
        if (!value || !this.onScanCallback) {
            return;
        }

        this.onScanCallback({ rawValue: value });
    }

    reportScanSuccess(title: string, clearAfterMs = 2500): void {
        const safeTitle = title.trim();
        this.processingDetection = false;
        this.scannerProcessing.set(false);
        this.scannerError.set(null);
        this.scannerStatus.set(safeTitle ? `Found: ${safeTitle}` : 'Found item.');
        this.scheduleStatusClear(clearAfterMs, { clearError: true });
    }

    reportScanFailure(message: string, clearAfterMs = 4000): void {
        this.processingDetection = false;
        this.scannerProcessing.set(false);
        this.scannerError.set(message);
        this.scheduleStatusClear(clearAfterMs, { clearStatus: true, clearError: true });
    }

    reportScanComplete(): void {
        this.processingDetection = false;
        this.scannerProcessing.set(false);
        this.scannerError.set(null);
        this.scannerStatus.set(null);
        this.clearStatusTimer();
    }

    clearScanMessage(): void {
        this.clearTransientMessages();
    }

    private beginProcessing(value: string): boolean {
        if (!value) {
            return false;
        }

        const now = Date.now();
        if (
            this.lastDetectedValue === value &&
            now - this.lastDetectedAt < BarcodeScannerService.DETECTION_DEBOUNCE_MS
        ) {
            return false;
        }

        if (this.processingDetection) {
            return false;
        }

        this.lastDetectedValue = value;
        this.lastDetectedAt = now;
        this.processingDetection = true;
        this.scannerProcessing.set(true);
        this.triggerFlash();
        this.scannerError.set(null);
        this.scannerStatus.set(`Found ${value}. Processing...`);
        this.clearStatusTimer();
        this.scanFeedback.playScanSuccess();
        return true;
    }

    private scheduleStatusClear(
        ms: number,
        options: { clearStatus?: boolean; clearError?: boolean } = {
            clearStatus: true,
            clearError: false,
        },
    ): void {
        this.clearStatusTimer();

        const clearStatus = options.clearStatus ?? true;
        const clearError = options.clearError ?? false;

        if (ms <= 0) {
            if (clearStatus) {
                this.scannerStatus.set(null);
            }
            if (clearError) {
                this.scannerError.set(null);
            }
            return;
        }

        if (typeof window === 'undefined') {
            if (clearStatus) {
                this.scannerStatus.set(null);
            }
            if (clearError) {
                this.scannerError.set(null);
            }
            return;
        }

        this.statusClearTimer = window.setTimeout(() => {
            this.statusClearTimer = null;
            if (clearStatus) {
                this.scannerStatus.set(null);
            }
            if (clearError) {
                this.scannerError.set(null);
            }
        }, ms);
    }

    private clearStatusTimer(): void {
        if (this.statusClearTimer !== null) {
            window.clearTimeout(this.statusClearTimer);
            this.statusClearTimer = null;
        }
    }

    private triggerFlash(): void {
        this.clearFlashTimer();
        this.scannerFlash.set(true);

        if (typeof window === 'undefined') {
            this.scannerFlash.set(false);
            return;
        }

        this.flashTimer = window.setTimeout(() => {
            this.flashTimer = null;
            this.scannerFlash.set(false);
        }, BarcodeScannerService.FLASH_DURATION_MS);
    }

    private clearFlashTimer(): void {
        if (this.flashTimer !== null) {
            if (typeof window !== 'undefined') {
                window.clearTimeout(this.flashTimer);
            }
            this.flashTimer = null;
        }
        this.scannerFlash.set(false);
    }

    private clearTransientMessages(): void {
        this.clearStatusTimer();
        this.clearFlashTimer();
        this.scannerStatus.set(null);
        this.scannerError.set(null);
        this.scannerHint.set(null);
    }

    private async waitForVideoReady(video: HTMLVideoElement): Promise<void> {
        if (this.isVideoReady(video)) {
            return;
        }

        await new Promise<void>((resolve) => {
            if (typeof window === 'undefined') {
                resolve();
                return;
            }

            const onReady = () => {
                if (!this.isVideoReady(video)) {
                    return;
                }
                cleanup();
                resolve();
            };

            const timeout = window.setTimeout(() => {
                cleanup();
                resolve();
            }, BarcodeScannerService.VIDEO_READY_TIMEOUT_MS);

            const cleanup = () => {
                window.clearTimeout(timeout);
                video.removeEventListener('loadedmetadata', onReady);
                video.removeEventListener('loadeddata', onReady);
                video.removeEventListener('playing', onReady);
                video.removeEventListener('resize', onReady);
            };

            video.addEventListener('loadedmetadata', onReady, { passive: true });
            video.addEventListener('loadeddata', onReady, { passive: true });
            video.addEventListener('playing', onReady, { passive: true });
            video.addEventListener('resize', onReady, { passive: true });

            void Promise.resolve().then(onReady);
        });
    }

    private isVideoReady(video: HTMLVideoElement): boolean {
        return (
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
        );
    }

    private stopScannerStream(): void {
        if (this.scanStream) {
            this.scanStream.getTracks().forEach((track) => track.stop());
            this.scanStream = null;
        }
    }

    private stopZxingControls(): void {
        if (this.zxingControls) {
            this.zxingControls.stop();
            this.zxingControls = null;
        }

        this.zxingReader = null;
    }

    private clearScannerAnimation(): void {
        if (this.scanFrameId !== null) {
            cancelAnimationFrame(this.scanFrameId);
            this.scanFrameId = null;
        }
    }

    private async resolveBarcodeScanner(): Promise<ScannerMode | null> {
        if (typeof window === 'undefined') {
            this.scannerSupported.set(false);
            this.scannerError.set('Barcode scanning is not supported in this browser.');
            this.scannerStatus.set(null);
            return null;
        }

        if (typeof BarcodeDetector !== 'undefined') {
            try {
                const supportedFormats = await BarcodeDetector.getSupportedFormats();
                const availableFormats = this.preferredBarcodeFormats.filter((format) =>
                    supportedFormats.includes(format),
                );

                if (availableFormats.length) {
                    this.barcodeDetector = new BarcodeDetector({ formats: availableFormats });
                    this.scannerSupported.set(true);
                    return 'native';
                }
            } catch (error) {
                console.warn(
                    'Native barcode detector unavailable, falling back to library.',
                    error,
                );
            }
        }

        try {
            const hints = new Map();
            hints.set(DecodeHintType.POSSIBLE_FORMATS, [
                BarcodeFormat.EAN_13,
                BarcodeFormat.EAN_8,
                BarcodeFormat.CODE_128,
                BarcodeFormat.UPC_A,
                BarcodeFormat.UPC_E,
            ]);

            this.zxingReader = new BrowserMultiFormatReader(hints);
            this.scannerSupported.set(true);
            return 'zxing';
        } catch (error) {
            console.error('Barcode scanner unavailable', error);
            this.scannerSupported.set(false);
            this.scannerError.set('Barcode scanning is not available on this device.');
            this.scannerStatus.set(null);
            return null;
        }
    }
}
