import { TestBed } from '@angular/core/testing';

import { BarcodeScannerService } from './barcode-scanner.service';
import { ScanFeedbackService } from './scan-feedback.service';

describe('BarcodeScannerService', () => {
  const originalBarcodeDetector = (globalThis as any).BarcodeDetector;
  const originalMediaDevices = navigator.mediaDevices;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BarcodeScannerService,
        {
          provide: ScanFeedbackService,
          useValue: {
            playScanSuccess: () => undefined,
            playScanFailure: () => undefined,
          },
        },
      ],
    });

    (globalThis as any).BarcodeDetector = class MockBarcodeDetector {
      static async getSupportedFormats(): Promise<string[]> {
        return ['ean_13'];
      }

      detect(): Promise<Array<{ rawValue?: string }>> {
        return Promise.resolve([]);
      }
    };

    (navigator as any).mediaDevices = {
      getUserMedia: async () =>
        ({
          getTracks: () => [{ stop: () => undefined }],
        }) as MediaStream,
    };

    globalThis.requestAnimationFrame = () => 1;
  });

  afterEach(() => {
    (globalThis as any).BarcodeDetector = originalBarcodeDetector;
    (navigator as any).mediaDevices = originalMediaDevices;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('clears initial support status after camera starts', async () => {
    const service = TestBed.inject(BarcodeScannerService);
    const video = document.createElement('video');

    Object.defineProperty(video, 'srcObject', {
      configurable: true,
      writable: true,
      value: null,
    });

    spyOn(video, 'play').and.resolveTo();
    if (!video.pause) {
      (video as any).pause = () => undefined;
    }
    spyOn(video, 'pause').and.callFake(() => undefined);

    await service.startScanner(video, () => undefined);

    expect(service.scannerActive()).toBeTrue();
    expect(service.scannerSupported()).toBeTrue();
    expect(service.scannerStatus()).toBeNull();
    expect(service.scannerHint()).toContain('Align an ISBN barcode');
  });
});
