import { Injectable, signal, DestroyRef, inject, ElementRef } from '@angular/core';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, Exception, NotFoundException, Result } from '@zxing/library';

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

  readonly scannerActive = signal(false);
  readonly scannerStatus = signal<string | null>(null);
  readonly scannerError = signal<string | null>(null);
  readonly scannerSupported = signal<boolean | null>(null);

  async startScanner(
    videoElement: HTMLVideoElement,
    onScan: (result: BarcodeScanResult) => void
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

      if (!this.scannerActive()) {
        this.stopScannerStream();
        this.videoElement.pause();
        this.videoElement.srcObject = null;
        return;
      }

      this.scannerMode = scannerMode;
      this.scannerStatus.set('Align an ISBN barcode within the frame.');

      if (scannerMode === 'native') {
        this.scheduleNextScan();
      } else {
        this.startZxingDetection();
      }
    } catch (error) {
      console.error('Unable to start barcode scanner', error);
      this.scannerError.set('Camera access failed. Confirm permissions and try again.');
      this.scannerStatus.set(null);
      this.stopScanner();
    }
  }

  stopScanner(): void {
    this.scannerActive.set(false);
    this.scannerStatus.set(null);
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
      const found = codes.find((code: BarcodeDetectionResult) => (code.rawValue ?? '').trim());

      if (found?.rawValue) {
        this.scannerStatus.set(`Found ${found.rawValue}. Processing...`);
        this.handleDetectedBarcode(found.rawValue);
        return;
      }
    } catch (error) {
      console.error('Barcode detection failed', error);
      this.scannerError.set('Unable to read the barcode. Try adjusting lighting or typing the code.');
      this.stopScanner();
      return;
    }

    this.scheduleNextScan();
  }

  private startZxingDetection(): void {
    if (!this.zxingReader || !this.videoElement) {
      this.scannerError.set('Barcode scanning is not available on this device.');
      this.stopScanner();
      return;
    }

    this.zxingReader
      .decodeFromVideoElement(
        this.videoElement,
        (result: Result | null | undefined, error: Exception | null | undefined, controls) => {
          this.zxingControls = controls;

          if (result?.getText()) {
            this.scannerStatus.set(`Found ${result.getText()}. Processing...`);
            this.handleDetectedBarcode(result.getText());
            return;
          }

          if (error && !(error instanceof NotFoundException)) {
            console.error('Barcode detection failed', error);
            this.scannerError.set('Unable to read the barcode. Try adjusting lighting or typing the code.');
            this.stopScanner();
          }
        }
      )
      .catch((error: unknown) => {
        console.error('Barcode detection failed', error);
        this.scannerError.set('Unable to read the barcode. Try adjusting lighting or typing the code.');
        this.stopScanner();
      });
  }

  private handleDetectedBarcode(rawValue: string): void {
    const value = rawValue.trim();
    if (!value || !this.onScanCallback) {
      return;
    }

    this.onScanCallback({ rawValue: value });
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
          supportedFormats.includes(format)
        );

        if (availableFormats.length) {
          this.barcodeDetector = new BarcodeDetector({ formats: availableFormats });
          this.scannerSupported.set(true);
          return 'native';
        }
      } catch (error) {
        console.warn('Native barcode detector unavailable, falling back to library.', error);
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
