import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock window.speechSynthesis before importing tts
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
const mockGetVoices = vi.fn().mockReturnValue([
  { lang: 'en-US', name: 'US English' },
  { lang: 'zh-CN', name: 'Chinese' },
]);

const mockSpeechSynthesis = {
  speak: mockSpeak,
  cancel: mockCancel,
  getVoices: mockGetVoices,
  onvoiceschanged: null,
  paused: false,
  pending: false,
  speaking: false,
};

// Mock SpeechSynthesisUtterance
class MockUtterance {
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  rate: number = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: SpeechSynthesisErrorEvent) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

describe('TTS Library', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      speechSynthesis: mockSpeechSynthesis,
      SpeechSynthesisUtterance: MockUtterance,
    });
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize correctly when supported', async () => {
    const { tts } = await import('../tts');
    expect(tts.canSpeak()).toBe(true);
  });

  it('should speak text', async () => {
    // We need to re-import to ensure the singleton is re-instantiated with the mock
    vi.resetModules();
    const { tts } = await import('../tts');
    
    // Trigger voice loading
    if (mockSpeechSynthesis.onvoiceschanged) {
      (mockSpeechSynthesis.onvoiceschanged as EventListener)(new Event('voiceschanged'));
    }
    
    const promise = tts.speak('Hello');
    
    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalled();
    
    // Simulate async completion
    const utterance = mockSpeak.mock.calls[0][0];
    if (utterance.onstart) utterance.onstart();
    if (utterance.onend) utterance.onend();
    
    await promise;
  });

  it('should handle unsupported browser', async () => {
    vi.resetModules();
    vi.stubGlobal('window', {}); // No speechSynthesis
    
    const { tts } = await import('../tts');
    expect(tts.canSpeak()).toBe(false);
    
    await tts.speak('Test'); // Should not throw
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('should update status subscribers', async () => {
    vi.resetModules();
    const { tts } = await import('../tts');
    
    const listener = vi.fn();
    tts.subscribe(listener);
    
    expect(listener).toHaveBeenCalledWith('stopped'); // Initial
    
    const speakPromise = tts.speak('Test');
    const utterance = mockSpeak.mock.calls[0][0];
    
    utterance.onstart();
    expect(listener).toHaveBeenCalledWith('playing');
    
    utterance.onend();
    expect(listener).toHaveBeenCalledWith('stopped');
    
    await speakPromise;
  });
});
