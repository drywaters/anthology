import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ScanFeedbackService {
  private audioContext: AudioContext | null = null;

  playScanSuccess(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }

      if (!this.audioContext) {
        this.audioContext = new AudioContextCtor();
      }

      void this.audioContext.resume();

      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;

      const now = this.audioContext.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.13);

      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      // Ignore audio failures (autoplay policies, unsupported devices, etc.).
    }
  }
}

