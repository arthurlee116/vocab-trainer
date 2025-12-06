

class TTS {
  private synth: SpeechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private listeners: Array<(status: 'playing' | 'stopped' | 'disabled') => void> = [];
  private _status: 'playing' | 'stopped' | 'disabled' = 'stopped';

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
      this._status = 'stopped';
      
      // Load voices (async in some browsers)
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => {
          this.setVoiceByLang('en-US');
        };
      }
      this.setVoiceByLang('en-US');
    } else {
      // Fallback/Mock for environments without speech synthesis
      this.synth = {
        speak: () => {},
        cancel: () => {},
        getVoices: () => [],
        pause: () => {},
        resume: () => {},
        paused: false,
        pending: false,
        speaking: false,
        onvoiceschanged: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as unknown as SpeechSynthesis;
      this._status = 'disabled';
    }
  }

  public canSpeak(): boolean {
    return this._status !== 'disabled';
  }

  public setVoiceByLang(lang: string): void {
    if (!this.canSpeak()) return;
    const voices = this.synth.getVoices();
    // Try to match exact lang, then region, then 'en' default
    this.voice =
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => v.lang.startsWith(lang.split('-')[0])) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      null;
  }

  public speak(text: string): Promise<void> {
    if (!this.canSpeak() || !text) return Promise.resolve();

    this.cancel(); // Stop any current playback

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) {
        utterance.voice = this.voice;
      }
      utterance.rate = 0.9; // Slightly slower for clarity

      utterance.onstart = () => {
        this.updateStatus('playing');
      };

      utterance.onend = () => {
        this.updateStatus('stopped');
        resolve();
      };

      utterance.onerror = () => {
        this.updateStatus('stopped');
        // Don't reject on simple cancellations or minor errors to avoid UI breakage\n        resolve();
      };

      try {
        this.synth.speak(utterance);
      } catch {
        this.updateStatus('stopped');
        resolve();
      }
    });
  }

  public cancel(): void {
    if (this.canSpeak()) {
      this.synth.cancel();
      this.updateStatus('stopped');
    }
  }

  public subscribe(listener: (status: 'playing' | 'stopped' | 'disabled') => void): () => void {
    this.listeners.push(listener);
    listener(this._status);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private updateStatus(status: 'playing' | 'stopped' | 'disabled') {
    this._status = status;
    this.listeners.forEach((l) => l(status));
  }
  
  // For testing/mocking
  public _forceStatus(status: 'playing' | 'stopped' | 'disabled') {
     this.updateStatus(status);
  }
}

export const tts = new TTS();
