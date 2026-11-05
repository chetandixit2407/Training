/**
 * Web Speech API text-to-speech service with Hindi (hi-IN) and English (en-US / en-IN) support.
 * Optimized for natural, polite, friendly conversational Hindi speech.
 */

type VoiceStatusListener = (state: { isSpeaking: boolean; currentTextId: string | null; lang: 'hi' | 'en' }) => void;

/**
 * Pre-processes Hindi text so speech synthesis sounds natural, fluid, and human-like:
 * - Converts technical abbreviations and symbols to smooth spoken Hindi
 * - Cleans parenthetical English notes
 * - Adds natural breathing pauses via punctuation
 */
function prepareHindiSpeechText(text: string): string {
  let cleaned = text.trim();

  // Strip English parentheticals often found in headers (e.g. "(WAITING AREA)", "(2 Sofas, 1 Table)")
  cleaned = cleaned.replace(/\([A-Za-z0-9\s,–-]+\)/g, '');

  // Conversational numbers and units
  cleaned = cleaned
    .replace(/23\s*°?\s*C/gi, 'तेईस डिग्री')
    .replace(/24\s*°?\s*C/gi, 'चौबीस डिग्री')
    .replace(/45\s*°/g, 'पैंतालीस डिग्री')
    .replace(/1\.5\s*फ़ीट|1\.5\s*फीट/gi, 'डेढ़ फीट')
    .replace(/8:30\s*AM/gi, 'सुबह साढ़े आठ बजे')
    .replace(/7:30\s*PM/gi, 'शाम साढ़े सात बजे')
    .replace(/6:30\s*PM/gi, 'शाम साढ़े छह बजे')
    .replace(/11:00\s*AM/gi, 'सुबह ग्यारह बजे')
    .replace(/1:30\s*PM|01:30\s*PM/gi, 'दोपहर डेढ़ बजे')
    .replace(/4:00\s*PM/gi, 'शाम चार बजे')
    .replace(/\bRO\b/gi, 'आर-ओ')
    .replace(/\bAC\b/gi, 'ए-सी')
    .replace(/\bHDMI\b/gi, 'एच-डी-एम-आई')
    .replace(/\bVIP\b/gi, 'वी-आई-पी')
    .replace(/\bHR\b/gi, 'एच-आर')
    .replace(/\bTV\b/gi, 'टी-वी')
    .replace(/\bSOP\b/gi, 'नियम');

  // Replace mechanical separators with natural pauses
  cleaned = cleaned
    .replace(/\s*•\s*/g, ', ')
    .replace(/\s*\|\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s*:\s*/g, ', ')
    .replace(/\s*-\s*/g, ', ')
    .replace(/\s+/g, ' ');

  return cleaned.trim();
}

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  // Keep strong reference to prevent Chromium garbage collection of active utterance
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private listeners: Set<VoiceStatusListener> = new Set();
  private currentTextId: string | null = null;
  private currentLang: 'hi' | 'en' = 'hi';
  private speakTimeoutId: number | null = null;
  private isNotifying = false;
  private pendingNotification = false;
  private isMuted = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      // Pre-fetch voices
      try {
        this.synth.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          this.synth?.getVoices();
        };
      } catch (e) {
        // Ignore initialization warning
      }
    }
  }

  public subscribe(listener: VoiceStatusListener): () => void {
    this.listeners.add(listener);
    // Defer initial subscription callback by a tick to avoid re-entrant setState in caller effect
    setTimeout(() => {
      if (this.listeners.has(listener)) {
        listener({
          isSpeaking: this.isSpeaking(),
          currentTextId: this.currentTextId,
          lang: this.currentLang,
        });
      }
    }, 0);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    if (this.isNotifying) {
      this.pendingNotification = true;
      return;
    }
    this.isNotifying = true;
    try {
      const state = {
        isSpeaking: this.isSpeaking(),
        currentTextId: this.currentTextId,
        lang: this.currentLang,
      };
      this.listeners.forEach((listener) => {
        try {
          listener(state);
        } catch (e) {
          console.error('Error in voice listener:', e);
        }
      });
    } finally {
      this.isNotifying = false;
      if (this.pendingNotification) {
        this.pendingNotification = false;
        this.notify();
      }
    }
  }

  private sentenceQueue: string[] = [];
  private isProcessingQueue = false;
  private isStreamEnded = true;
  private onPlaybackCompleteCallback: (() => void) | null = null;

  public isSpeaking(): boolean {
    return !!this.synth && (this.synth.speaking || this.synth.pending || this.isProcessingQueue || this.sentenceQueue.length > 0);
  }

  public stop(): void {
    if (this.speakTimeoutId !== null) {
      window.clearTimeout(this.speakTimeoutId);
      this.speakTimeoutId = null;
    }

    const wasSpeaking = this.isSpeaking() || this.activeUtterance !== null || this.currentTextId !== null;

    this.sentenceQueue = [];
    this.isProcessingQueue = false;
    this.isStreamEnded = true;
    this.onPlaybackCompleteCallback = null;

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {
        // Ignore
      }
    }
    this.activeUtterance = null;
    this.currentTextId = null;
    
    // Only notify if speaking state actually changed
    if (wasSpeaking) {
      this.notify();
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted && this.isSpeaking()) {
      this.stop();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  private configureUtterance(utterance: SpeechSynthesisUtterance, lang: 'hi' | 'en'): void {
    if (!this.synth) return;
    const voices = this.synth.getVoices() || [];

    if (lang === 'hi') {
      utterance.lang = 'hi-IN';
      const hindiVoices = voices.filter(
        (v) => v.lang.toLowerCase().includes('hi') || v.lang.toLowerCase().includes('hindi')
      );

      if (hindiVoices.length > 0) {
        const bestVoice =
          hindiVoices.find((v) => {
            const name = v.name.toLowerCase();
            return (
              name.includes('natural') ||
              name.includes('online') ||
              name.includes('hemant') ||
              name.includes('kalpana') ||
              name.includes('google') ||
              name.includes('swara') ||
              name.includes('lekha')
            );
          }) || hindiVoices[0];

        utterance.voice = bestVoice;
      }
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
    } else {
      utterance.lang = 'en-US';
      const enVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().includes('en-in') ||
          v.lang.toLowerCase().includes('en-us') ||
          v.lang.toLowerCase().startsWith('en')
      );
      if (enVoice) {
        utterance.voice = enVoice;
      }
      utterance.rate = 0.98;
      utterance.pitch = 1.0;
    }
  }

  /**
   * STREAMING TTS: Starts a continuous speech streaming session.
   * Clears old queues, sets up language, and readies the audio engine.
   */
  public startStreamingSession(lang: 'hi' | 'en' = 'hi', textId?: string): void {
    this.stop();
    this.sentenceQueue = [];
    this.isProcessingQueue = false;
    this.isStreamEnded = false;
    this.onPlaybackCompleteCallback = null;
    this.currentLang = lang;
    this.currentTextId = textId || 'stream';
    this.notify();
  }

  /**
   * STREAMING TTS: Enqueues a completed sentence for immediate speech synthesis.
   * If not currently speaking, begins playing this sentence in sub-second time!
   */
  public enqueueSentence(sentenceText: string): void {
    if (this.isMuted) return;

    const trimmed = sentenceText.trim();
    if (!trimmed) return;

    const clean = this.currentLang === 'hi' ? prepareHindiSpeechText(trimmed) : trimmed;
    if (!clean) return;

    this.sentenceQueue.push(clean);

    if (!this.isProcessingQueue) {
      this.playNextQueuedSentence();
    }
  }

  private playNextQueuedSentence(): void {
    if (this.isMuted) {
      this.sentenceQueue = [];
      this.isProcessingQueue = false;
      return;
    }

    if (!this.synth) return;

    if (this.sentenceQueue.length === 0) {
      this.isProcessingQueue = false;
      if (this.isStreamEnded) {
        this.activeUtterance = null;
        this.currentTextId = null;
        this.notify();
        if (this.onPlaybackCompleteCallback) {
          const cb = this.onPlaybackCompleteCallback;
          this.onPlaybackCompleteCallback = null;
          cb();
        }
      }
      return;
    }

    this.isProcessingQueue = true;
    const textToSpeak = this.sentenceQueue.shift()!;

    try {
      if (this.synth.paused) {
        this.synth.resume();
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      this.activeUtterance = utterance;
      this.configureUtterance(utterance, this.currentLang);

      utterance.onstart = () => {
        this.notify();
      };

      utterance.onend = () => {
        this.activeUtterance = null;
        this.playNextQueuedSentence();
      };

      utterance.onerror = (e) => {
        const errorType = (e as any).error;
        if (errorType !== 'canceled' && errorType !== 'interrupted') {
          console.warn('Utterance notice:', errorType);
        }
        this.activeUtterance = null;
        this.playNextQueuedSentence();
      };

      this.synth.speak(utterance);
    } catch (err) {
      console.warn('Failed to speak queued sentence:', err);
      this.activeUtterance = null;
      this.playNextQueuedSentence();
    }
  }

  /**
   * STREAMING TTS: Marks that the AI response stream has finished emitting chunks.
   * When the remaining sentence queue finishes speaking, the session cleanly concludes.
   */
  public endStreamingSession(onComplete?: () => void): void {
    this.isStreamEnded = true;
    if (onComplete) {
      this.onPlaybackCompleteCallback = onComplete;
    }

    if (!this.isProcessingQueue && this.sentenceQueue.length === 0) {
      this.activeUtterance = null;
      this.currentTextId = null;
      this.notify();
      if (this.onPlaybackCompleteCallback) {
        const cb = this.onPlaybackCompleteCallback;
        this.onPlaybackCompleteCallback = null;
        cb();
      }
    }
  }

  public speak(text: string, lang: 'hi' | 'en' = 'hi', textId?: string): void {
    if (this.isMuted) return;

    if (!this.synth) {
      console.warn('Speech synthesis not available in this environment.');
      return;
    }

    // If currently speaking this exact item, toggle off/stop
    if (this.isSpeaking() && textId && this.currentTextId === textId) {
      this.stop();
      return;
    }

    this.stop();

    const rawClean = text.trim();
    if (!rawClean) return;

    const spokenText = lang === 'hi' ? prepareHindiSpeechText(rawClean) : rawClean;
    if (!spokenText) return;

    this.currentTextId = textId || 'manual';
    this.currentLang = lang;
    this.notify();

    this.speakTimeoutId = window.setTimeout(() => {
      this.speakTimeoutId = null;
      if (!this.synth) return;

      try {
        if (this.synth.paused) {
          this.synth.resume();
        }

        const utterance = new SpeechSynthesisUtterance(spokenText);
        this.activeUtterance = utterance;
        this.configureUtterance(utterance, lang);

        utterance.onstart = () => {
          this.notify();
        };

        utterance.onend = () => {
          if (this.activeUtterance === utterance) {
            this.activeUtterance = null;
            this.currentTextId = null;
            this.notify();
          }
        };

        utterance.onerror = (e) => {
          const errorType = (e as any).error;
          if (errorType !== 'canceled' && errorType !== 'interrupted') {
            console.warn('Speech synthesis notice:', errorType);
          }
          if (this.activeUtterance === utterance) {
            this.activeUtterance = null;
            this.currentTextId = null;
            this.notify();
          }
        };

        this.synth.speak(utterance);
      } catch (err) {
        console.warn('Unable to play speech:', err);
        this.activeUtterance = null;
        this.currentTextId = null;
        this.notify();
      }
    }, 40);
  }
}

export const speechService = new SpeechService();
