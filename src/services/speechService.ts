/**
 * Gemini Web Audio Engine & Live Speech Service
 *
 * Implements a high-fidelity Web Audio pipeline using browser AudioContext:
 * 1. Decodes incoming Gemini 24kHz audio (WAV and Raw 16-bit PCM little-endian).
 * 2. Gapless buffer scheduling via precise AudioContext clock (nextStartTime).
 * 3. Handles browser autoplay restrictions & suspended AudioContext states on user gestures.
 * 4. GainNode management for instant, reliable MUTE/UNMUTE.
 * 5. Real-time AnalyserNode measuring physical speaker sound levels.
 * 6. Accurate SPEAKING status emitted ONLY when audio physically begins playing.
 * 7. Sub-second streaming audio chunk enqueueing & instantaneous barge-in interruption.
 */

import { AITrainingService } from './aiTrainingService';

export type VoiceStatusListener = (state: {
  isSpeaking: boolean;
  currentTextId: string | null;
  lang: 'hi' | 'en';
  isMuted: boolean;
  audioLevel?: number;
}) => void;

class GeminiSpeechService {
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  // Active playing sources & scheduling clock
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime: number = 0;
  private isPlaybackActive: boolean = false;
  private isStreamEnded: boolean = true;
  private onPlaybackCompleteCallback: (() => void) | null = null;

  // Audio state
  private isMuted: boolean = false;
  private currentTextId: string | null = null;
  private currentLang: 'hi' | 'en' = 'hi';
  private listeners: Set<VoiceStatusListener> = new Set();
  private isUnlocking: boolean = false;
  private startTimeoutId: number | null = null;

  constructor() {
    this.registerGlobalUnlock();
  }

  /**
   * Unlock AudioContext on the very first user click / touch / key anywhere in the app
   * to satisfy strict browser autoplay policies.
   */
  private registerGlobalUnlock(): void {
    if (typeof window === 'undefined') return;

    const unlockHandler = async () => {
      try {
        await this.ensureAudioContext();
      } catch (e) {
        // will unlock on next interaction
      }
    };

    window.addEventListener('click', unlockHandler, { passive: true });
    window.addEventListener('touchstart', unlockHandler, { passive: true });
    window.addEventListener('pointerdown', unlockHandler, { passive: true });
    window.addEventListener('keydown', unlockHandler, { passive: true });
  }

  /**
   * Initialize and resume browser AudioContext
   */
  public async ensureAudioContext(): Promise<AudioContext> {
    if (typeof window === 'undefined') {
      throw new Error('Web Audio not supported in non-browser environment');
    }

    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        throw new Error('AudioContext not supported in this browser');
      }

      // Initialize with 24kHz target or hardware sample rate
      try {
        this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
      } catch (e) {
        // Fall back to default system sample rate
        this.audioCtx = new AudioCtxClass();
      }

      // Construct master Web Audio graph: Source -> GainNode -> AnalyserNode -> Destination
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : 1.0, this.audioCtx.currentTime);

      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.analyserNode.smoothingTimeConstant = 0.3;

      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);
    }

    // Fix browser suspended state / autoplay restriction
    if (this.audioCtx.state === 'suspended' && !this.isUnlocking) {
      this.isUnlocking = true;
      try {
        await this.audioCtx.resume();
      } catch (err) {
        console.warn('AudioContext resume notice:', err);
      } finally {
        this.isUnlocking = false;
      }
    }

    return this.audioCtx;
  }

  public subscribe(listener: VoiceStatusListener): () => void {
    this.listeners.add(listener);
    setTimeout(() => {
      if (this.listeners.has(listener)) {
        listener({
          isSpeaking: this.isSpeaking(),
          currentTextId: this.currentTextId,
          lang: this.currentLang,
          isMuted: this.isMuted,
        });
      }
    }, 0);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = {
      isSpeaking: this.isSpeaking(),
      currentTextId: this.currentTextId,
      lang: this.currentLang,
      isMuted: this.isMuted,
    };
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.error('Error in voice listener:', e);
      }
    });
  }

  /**
   * ACCURATE SPEAKING STATE (Requirement 10)
   * Returns true ONLY when audio is actively outputting to user's speakers, not merely during text generation.
   */
  public isSpeaking(): boolean {
    return this.isPlaybackActive && !this.isMuted && this.activeSources.size > 0;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * MUTE / UNMUTE (Requirement 9)
   * Instantly mutes AudioContext gain and stops playback if active.
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.gainNode && this.audioCtx) {
      try {
        this.gainNode.gain.setValueAtTime(muted ? 0 : 1.0, this.audioCtx.currentTime);
      } catch (e) {
        this.gainNode.gain.value = muted ? 0 : 1.0;
      }
    }

    if (muted && this.isSpeaking()) {
      this.stop();
    } else {
      this.notify();
    }
  }

  /**
   * REAL-TIME PHYSICAL AUDIO LEVEL (Requirement 6)
   * Reads actual frequency/time-domain data reaching the speakers
   */
  public getAudioLevel(): number {
    if (!this.analyserNode || !this.isSpeaking()) {
      return 0;
    }
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / (dataArray.length || 1);
    return Math.min(100, Math.round((avg / 255) * 100));
  }

  /**
   * BARGE-IN & INTERRUPTION (Requirement 8)
   * Instantly halts all active AudioBufferSourceNodes and resets the scheduling clock.
   */
  public stop(): void {
    if (this.startTimeoutId !== null) {
      window.clearTimeout(this.startTimeoutId);
      this.startTimeoutId = null;
    }

    for (const source of this.activeSources) {
      try {
        source.stop(0);
        source.disconnect();
      } catch (e) {
        // Source already ended or stopped
      }
    }
    this.activeSources.clear();

    const wasSpeaking = this.isPlaybackActive;
    this.nextStartTime = 0;
    this.isPlaybackActive = false;
    this.isStreamEnded = true;
    this.currentTextId = null;
    this.onPlaybackCompleteCallback = null;

    if (wasSpeaking) {
      this.notify();
    }
  }

  /**
   * Base64 to ArrayBuffer helper
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const clean = base64.replace(/^data:audio\/[a-zA-Z0-9]+;base64,/, '');
    const binaryString = window.atob(clean);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * DECODE INCOMING AUDIO (Requirement 2 & 5)
   * Decodes WAV or Raw 16-bit PCM little-endian audio buffers into Web Audio AudioBuffers.
   */
  private async decodeAudioBuffer(
    base64Data: string,
    mimeType?: string,
    sampleRate = 24000
  ): Promise<AudioBuffer | null> {
    if (!base64Data || base64Data.length < 10) return null;

    const ctx = await this.ensureAudioContext();
    const arrayBuffer = this.base64ToArrayBuffer(base64Data);

    if (arrayBuffer.byteLength < 4) return null;

    // Check if buffer is a WAV file (starts with "RIFF")
    const headerCheck = new Uint8Array(arrayBuffer, 0, 4);
    const isWav =
      mimeType?.includes('wav') ||
      (headerCheck[0] === 0x52 &&
        headerCheck[1] === 0x49 &&
        headerCheck[2] === 0x46 &&
        headerCheck[3] === 0x46);

    if (isWav) {
      try {
        // Clone arrayBuffer because decodeAudioData detaches the input
        const clonedBuffer = arrayBuffer.slice(0);
        const decoded = await ctx.decodeAudioData(clonedBuffer);
        if (decoded && decoded.length > 0 && decoded.duration > 0) {
          return decoded;
        }
      } catch (decodeErr) {
        console.warn('Native WAV decode fell back to manual PCM parser:', decodeErr);
      }
    }

    // Raw 16-bit PCM Little-Endian parser (audio/pcm, audio/l16, or stripped WAV)
    try {
      let offset = 0;
      if (isWav && arrayBuffer.byteLength > 44) {
        // Skip 44-byte RIFF header to read raw PCM payload
        offset = 44;
      }

      const pcmByteLength = arrayBuffer.byteLength - offset;
      const numSamples = Math.floor(pcmByteLength / 2);
      if (numSamples <= 0) return null;

      const int16Array = new Int16Array(arrayBuffer, offset, numSamples);
      const float32Array = new Float32Array(numSamples);

      // Verify buffer has non-zero amplitude (Requirement 5)
      let nonZeroCount = 0;
      for (let i = 0; i < numSamples; i++) {
        const sample = int16Array[i];
        float32Array[i] = sample < 0 ? sample / 32768.0 : sample / 32767.0;
        if (sample !== 0) nonZeroCount++;
      }

      if (nonZeroCount === 0) {
        return null; // Empty silent buffer
      }

      const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
      audioBuffer.getChannelData(0).set(float32Array);
      return audioBuffer;
    } catch (pcmErr) {
      console.error('Failed to parse PCM audio buffer:', pcmErr);
      return null;
    }
  }

  /**
   * SCHEDULE AUDIO BUFFER GAPLESSLY (Requirement 3, 7, 10)
   * Schedules chunks onto the Web Audio timeline using precise time offsets.
   */
  public async scheduleAudioChunk(
    base64Data: string,
    mimeType?: string,
    sampleRate = 24000
  ): Promise<void> {
    if (this.isMuted) return;

    const buffer = await this.decodeAudioBuffer(base64Data, mimeType, sampleRate);
    if (!buffer || buffer.length === 0 || buffer.duration === 0) return;

    const ctx = await this.ensureAudioContext();
    const now = ctx.currentTime;

    // Schedule seamlessly right after previous chunk, or start in 20ms if queue dried up
    const startTime = Math.max(now + 0.02, this.nextStartTime);
    this.nextStartTime = startTime + buffer.duration;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode!);

    this.activeSources.add(source);

    // Synchronize speaking status ONLY when audio physically starts outputting (Requirement 10)
    const delayMs = Math.max(0, (startTime - now) * 1000);
    this.startTimeoutId = window.setTimeout(() => {
      this.startTimeoutId = null;
      if (!this.isMuted && this.activeSources.has(source)) {
        if (!this.isPlaybackActive) {
          this.isPlaybackActive = true;
          this.notify();
        }
      }
    }, delayMs);

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        this.nextStartTime = 0;
        if (this.isStreamEnded) {
          this.isPlaybackActive = false;
          this.currentTextId = null;
          this.notify();
          if (this.onPlaybackCompleteCallback) {
            const cb = this.onPlaybackCompleteCallback;
            this.onPlaybackCompleteCallback = null;
            cb();
          }
        }
      }
    };

    source.start(startTime);
  }

  /**
   * STREAMING TTS SESSION START
   */
  public startStreamingSession(lang: 'hi' | 'en' = 'hi', textId?: string): void {
    this.stop();
    this.currentLang = lang;
    this.currentTextId = textId || 'stream';
    this.isStreamEnded = false;
    this.onPlaybackCompleteCallback = null;
    this.ensureAudioContext().catch(() => {});
  }

  /**
   * STREAMING TTS ENQUEUE SENTENCE
   */
  public enqueueAudioChunk(
    base64Data: string,
    mimeType = 'audio/wav',
    sampleRate = 24000
  ): void {
    if (this.isMuted) return;
    this.scheduleAudioChunk(base64Data, mimeType, sampleRate).catch((err) => {
      console.warn('Failed to schedule streaming audio chunk:', err);
    });
  }

  /**
   * STREAMING TTS SESSION END
   */
  public endStreamingSession(onComplete?: () => void): void {
    this.isStreamEnded = true;
    if (onComplete) {
      this.onPlaybackCompleteCallback = onComplete;
    }

    if (this.activeSources.size === 0) {
      this.isPlaybackActive = false;
      this.currentTextId = null;
      this.notify();
      if (this.onPlaybackCompleteCallback) {
        const cb = this.onPlaybackCompleteCallback;
        this.onPlaybackCompleteCallback = null;
        cb();
      }
    }
  }

  /**
   * UNARY AUDIO PLAYBACK (Listen to individual messages or training voice scripts)
   */
  public async speak(text: string, lang: 'hi' | 'en' = 'hi', textId?: string): Promise<void> {
    if (this.isMuted) return;

    // Toggle off if currently speaking this exact item
    if (this.isSpeaking() && textId && this.currentTextId === textId) {
      this.stop();
      return;
    }

    this.stop();

    const clean = text.trim();
    if (!clean) return;

    this.currentTextId = textId || 'manual';
    this.currentLang = lang;

    try {
      await this.ensureAudioContext();

      // Call backend Gemini TTS endpoint to get real 24kHz audio
      const result = await AITrainingService.synthesizeSpeech(clean, lang);
      if (result && result.audio) {
        await this.scheduleAudioChunk(result.audio, result.mimeType, result.sampleRate);
      }
    } catch (err) {
      console.error('Speech synthesis playback error:', err);
      this.stop();
    }
  }
}

export const speechService = new GeminiSpeechService();
