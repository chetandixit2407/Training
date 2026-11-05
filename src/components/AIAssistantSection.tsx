import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Language, AIMessage } from '../types';
import { AITrainingService } from '../services/aiTrainingService';
import { speechService } from '../services/speechService';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Sparkles,
  Bot,
  User as UserIcon,
  RotateCcw,
  Square,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Radio,
  Send,
  Zap,
} from 'lucide-react';

interface AIAssistantSectionProps {
  currentUser: User | null;
  language: Language;
}

type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

export const AIAssistantSection: React.FC<AIAssistantSectionProps> = ({
  currentUser,
  language,
}) => {
  // Session & Voice Conversation States
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [liveInterimText, setLiveInterimText] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(18);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Chat History
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text:
        language === 'hi'
          ? `नमस्ते ${currentUser?.nameHi || currentUser?.name || 'भैया'}! मैं आपका AI ट्रेनर भैया हूँ। माइक बटन दबाते ही हमारी बातचीत शुरू हो जाएगी—सबमिट बटन दबाने की ज़रूरत नहीं है, बस आमने-सामने बोलते रहिए!`
          : `Hello ${currentUser?.name || 'Bhaiya'}! I am your AI Trainer Bhaiya. Tap Start Call to talk in real-time—no submit buttons needed, just speak naturally!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioText:
        language === 'hi'
          ? 'नमस्ते भैया! मैं आपका ट्रेनर भैया हूँ। बातचीत शुरू करने के लिए माइक दबाएं।'
          : 'Hello! I am your Trainer Bhaiya. Press the mic to start our live talk.',
      followUpSuggestions:
        language === 'hi'
          ? [
              'ललित सर के कैबिन के नियम?',
              'द स्काईलाइन मीटिंग रूम कैसे तैयार करें?',
              'क्लाइंट आने पर 15 सेकंड में क्या करना है?',
              'पानी और कोस्टर टेबल पर कैसे रखें?',
            ]
          : [
              'Lalit Sir cabin protocol?',
              'How to prepare The Skyline meeting room?',
              'Client arrival 15-second protocol?',
              'How to place coasters and glasses?',
            ],
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);

  // Core References for Real-Time Execution
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<number | null>(null);
  const isCallActiveRef = useRef<boolean>(false);
  const conversationStateRef = useRef<ConversationState>('idle');
  const isMutedRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const accumulatedSpeechRef = useRef<string>('');
  const waveIntervalRef = useRef<number | null>(null);

  // Synchronize state references
  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  useEffect(() => {
    conversationStateRef.current = conversationState;
  }, [conversationState]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    speechService.setMuted(isMuted);
  }, [isMuted]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveInterimText, conversationState]);

  // Audio wave visualizer animation
  useEffect(() => {
    if (isCallActive) {
      waveIntervalRef.current = window.setInterval(() => {
        if (conversationStateRef.current === 'listening') {
          // Dynamic bouncing levels while listening
          const rand = Math.floor(Math.random() * 65) + 25;
          setAudioLevel(rand);
        } else if (conversationStateRef.current === 'speaking') {
          const realLvl = speechService.getAudioLevel();
          const level = realLvl > 0 ? realLvl : Math.floor(Math.random() * 80) + 20;
          setAudioLevel(level);
        } else {
          setAudioLevel(15);
        }
      }, 90);
    } else {
      if (waveIntervalRef.current) {
        clearInterval(waveIntervalRef.current);
        waveIntervalRef.current = null;
      }
      setAudioLevel(15);
    }

    return () => {
      if (waveIntervalRef.current) {
        clearInterval(waveIntervalRef.current);
        waveIntervalRef.current = null;
      }
    };
  }, [isCallActive]);

  // RESUME LISTENING (Automatic loop after AI speaks or barge-in)
  const resumeListening = useCallback(() => {
    if (!isCallActiveRef.current) return;

    setConversationState('listening');
    setLiveInterimText('');
    accumulatedSpeechRef.current = '';

    if (recognitionRef.current && !isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Recognition already active
      }
    }
  }, []);

  // BARGE-IN INTERRUPTION: When user speaks while AI is talking, immediately halt speech & stream!
  const triggerBargeIn = useCallback(() => {
    if (conversationStateRef.current === 'speaking' || speechService.isSpeaking() || isProcessingRef.current) {
      // Abort ongoing server-sent stream if active
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Stop AudioContext playback immediately
      speechService.stop();
      isProcessingRef.current = false;
      setConversationState('listening');
    }
  }, []);

  // Subscribe to SpeechService events
  useEffect(() => {
    const unsub = speechService.subscribe((state) => {
      setCurrentSpeakingId(state.currentTextId);

      // Show SPEAKING ONLY when actual audio playback starts from speakers (Requirement 10)
      if (state.isSpeaking) {
        setConversationState('speaking');
      } else if (conversationStateRef.current === 'speaking' && isCallActiveRef.current) {
        // When AI completes speaking in an active call, automatically resume listening!
        resumeListening();
      }
    });

    return () => unsub();
  }, [resumeListening]);

  // SUBMIT USER QUERY VIA LOW-LATENCY STREAMING
  const submitUserQuery = async (queryText: string) => {
    const cleanText = queryText.trim();
    if (!cleanText || isProcessingRef.current) return;

    // Discard single meaningless clicks/noises
    if (cleanText.length < 2) return;

    // Clear any pending silence timer
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Fix AudioContext suspended state before query starts (Requirement 4)
    speechService.ensureAudioContext().catch(() => {});

    isProcessingRef.current = true;
    setConversationState('processing');
    setLiveInterimText('');
    accumulatedSpeechRef.current = '';

    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 1. Add User Message
    const userMsg: AIMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fromVoice: true,
    };

    // 2. Prepare Placeholder Assistant Message for real-time text streaming
    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: AIMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      languageDetected: 'hi',
    };

    const updatedHistory = [...messages, userMsg];
    setMessages([...updatedHistory, assistantMsg]);

    // 3. Initialize Streaming Audio Session immediately (Requirement 7)
    if (!isMutedRef.current) {
      speechService.startStreamingSession('hi', assistantMsgId);
    }

    let fullGeneratedText = '';

    try {
      await AITrainingService.streamChatWithAssistant({
        messages: updatedHistory,
        user: currentUser,
        signal: abortController.signal,
        onChunk: (chunk: string) => {
          if (abortController.signal.aborted) return;

          fullGeneratedText += chunk;

          // Update message text on screen in real time
          setMessages((prev) => {
            const next = [...prev];
            const target = next.find((m) => m.id === assistantMsgId);
            if (target) {
              target.text = fullGeneratedText;
            }
            return next;
          });
        },
        // Real Gemini audio chunk received directly from server-sent event stream
        onAudioChunk: (chunk) => {
          if (abortController.signal.aborted) return;
          if (!isMutedRef.current && chunk?.audio) {
            speechService.enqueueAudioChunk(chunk.audio, chunk.mimeType, chunk.sampleRate);
          }
        },
        onDone: (finalText: string) => {
          if (abortController.signal.aborted) return;

          isProcessingRef.current = false;

          // Mark streaming session complete and wire auto-resume callback
          if (!isMutedRef.current) {
            speechService.endStreamingSession(() => {
              if (isCallActiveRef.current) {
                resumeListening();
              }
            });
          } else {
            // Muted mode: immediately resume listening
            if (isCallActiveRef.current) {
              resumeListening();
            }
          }
        },
        onError: (err: Error) => {
          if (abortController.signal.aborted) return;
          console.error('Streaming error:', err);
          isProcessingRef.current = false;
          speechService.stop();
          setErrorMessage(
            language === 'hi'
              ? 'क्षमा करें भैया, कनेक्शन में समस्या हुई। कृपया दोबारा बोलें।'
              : 'Connection interrupted. Please speak again.'
          );
          if (isCallActiveRef.current) {
            setTimeout(() => resumeListening(), 800);
          }
        },
      });
    } catch (err: any) {
      if (abortController.signal.aborted) return;
      isProcessingRef.current = false;
      speechService.stop();
      console.error('Turn error:', err);
    }
  };

  // INITIALIZE SPEECH RECOGNITION (STREAMING & SELF-HEALING)
  const setupSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(
        language === 'hi'
          ? 'आपके ब्राउज़र में आवाज़ पहचान (Speech Recognition) समर्थित नहीं है। कृपया Chrome या Edge का उपयोग करें।'
          : 'Speech recognition not supported in this browser. Please use Chrome or Edge.'
      );
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

    recognition.onstart = () => {
      isRecognitionActiveRef.current = true;
      setErrorMessage(null);
    };

    recognition.onresult = (event: any) => {
      // Barge-in: if user starts speaking while AI is speaking, interrupt AI instantly!
      triggerBargeIn();

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      const activeText = (final || interim).trim();

      if (activeText) {
        setLiveInterimText(activeText);
        accumulatedSpeechRef.current = activeText;

        // Reset Voice Activity Detection (VAD) silence timer
        if (silenceTimerRef.current) {
          window.clearTimeout(silenceTimerRef.current);
        }

        // Adaptive VAD timeout:
        // When user pauses speaking for ~850ms, automatically trigger response generation!
        silenceTimerRef.current = window.setTimeout(() => {
          silenceTimerRef.current = null;
          const query = accumulatedSpeechRef.current.trim();
          if (query.length >= 2 && !isProcessingRef.current) {
            submitUserQuery(query);
          }
        }, 850);
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      console.warn('Speech recognition notice:', err);

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        isRecognitionActiveRef.current = false;
        setErrorMessage(
          language === 'hi'
            ? 'कृपया ब्राउज़र में माइक्रोफ़ोन की अनुमति (Allow Microphone) दें।'
            : 'Please grant microphone permissions in your browser.'
        );
        handleEndCall();
        return;
      }

      // Ignore normal silence timeouts and keep session alive
      if (err === 'no-speech') {
        // Handled cleanly in onend auto-restart
      }
    };

    recognition.onend = () => {
      isRecognitionActiveRef.current = false;

      // Self-healing: if session is active and not currently generating/speaking, restart immediately!
      if (
        isCallActiveRef.current &&
        !isProcessingRef.current &&
        conversationStateRef.current !== 'speaking'
      ) {
        setTimeout(() => {
          if (
            isCallActiveRef.current &&
            !isRecognitionActiveRef.current &&
            conversationStateRef.current !== 'speaking'
          ) {
            try {
              recognition.start();
            } catch (e) {
              // already started
            }
          }
        }, 40);
      }
    };

    return recognition;
  }, [language, triggerBargeIn]);

  // START CONTINUOUS REAL-TIME CALL (IMMEDIATE ACTIVATION)
  const handleStartCall = () => {
    setErrorMessage(null);
    setIsCallActive(true);
    isCallActiveRef.current = true;
    setConversationState('listening');
    setLiveInterimText('');
    accumulatedSpeechRef.current = '';

    // Fix AudioContext autoplay restriction on user click (Requirement 4)
    speechService.ensureAudioContext().catch(() => {});

    // Cancel any active speech
    speechService.stop();

    // Instantiate recognition if needed
    if (!recognitionRef.current) {
      recognitionRef.current = setupSpeechRecognition();
    }

    // ACTIVATE MICROPHONE IMMEDIATELY on this user click gesture
    if (recognitionRef.current && !isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Immediate recognition start caught:', err);
      }
    }
  };

  // END CONVERSATION COMPLETELY
  const handleEndCall = () => {
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setConversationState('idle');
    setLiveInterimText('');
    accumulatedSpeechRef.current = '';

    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      isRecognitionActiveRef.current = false;
    }

    speechService.stop();
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      handleEndCall();
    };
  }, []);

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;
    speechService.setMuted(nextMuted);

    // If currently speaking and muted: stop audio immediately, continue listening
    if (nextMuted && conversationState === 'speaking') {
      speechService.stop();
      resumeListening();
    }
  };

  // Manual interrupt button
  const handleManualInterrupt = () => {
    triggerBargeIn();
    resumeListening();
  };

  // Manual text send
  const handleSendManualText = () => {
    if (!inputQuery.trim()) return;
    const text = inputQuery.trim();
    setInputQuery('');
    submitUserQuery(text);
  };

  // Audio Playback for individual messages in history
  const handlePlayMessageAudio = (msg: AIMessage) => {
    if (currentSpeakingId === msg.id && speechService.isSpeaking()) {
      speechService.stop();
      return;
    }
    const textToPlay = msg.audioText || msg.text;
    const speechLang = msg.languageDetected === 'en' ? 'en' : 'hi';
    speechService.speak(textToPlay, speechLang, msg.id);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] md:h-[calc(100vh-7.5rem)] max-w-4xl mx-auto pb-14 md:pb-2">
      
      {/* REAL-TIME VOICE CALL COCKPIT */}
      <div
        className={`rounded-2xl p-4 sm:p-5 text-white shadow-md transition-all shrink-0 mb-3 border ${
          isCallActive
            ? conversationState === 'listening'
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 border-emerald-400/50 shadow-emerald-500/20'
              : conversationState === 'speaking'
              ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 border-amber-300/50 shadow-amber-500/20'
              : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 border-blue-400/50 shadow-blue-500/20'
            : 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          
          {/* Identity & Status */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`w-13 h-13 rounded-2xl flex items-center justify-center text-white shadow-inner backdrop-blur-md transition-all ${
                  isCallActive ? 'bg-white/20 ring-4 ring-white/30' : 'bg-amber-500/90 text-slate-950'
                }`}
              >
                <Bot className="w-7 h-7" />
              </div>

              {/* Status pulsating ping */}
              {isCallActive && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  {language === 'hi' ? 'ट्रेनर भैया (लाइव वॉइस असिस्टेंट)' : 'Trainer Bhaiya (Live Voice Assistant)'}
                </h2>
                {isCallActive && (
                  <span className="bg-white/25 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-xs flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-300" />
                    <span>{language === 'hi' ? 'स्ट्रीमिंग लाइव' : 'Streaming'}</span>
                  </span>
                )}
              </div>

              {/* Real-time Status Badge */}
              <div className="text-xs sm:text-sm font-semibold text-white/95 flex items-center gap-1.5 mt-0.5">
                {!isCallActive ? (
                  <span className="text-slate-300">
                    {language === 'hi'
                      ? 'माइक दबाकर बातचीत शुरू करें (बिना सबमिट बटन, लगातार बात करें)'
                      : 'Press Start to begin hands-free conversation'}
                  </span>
                ) : conversationState === 'listening' ? (
                  <span className="flex items-center gap-1.5 text-emerald-100 font-bold">
                    <Radio className="w-4 h-4 text-emerald-200 animate-pulse" />
                    {language === 'hi'
                      ? 'सुन रहा हूँ, बोलिए भैया... (ऑटो VAD चालू)'
                      : 'Live Listening... speak freely (Auto-detecting)'}
                  </span>
                ) : conversationState === 'processing' ? (
                  <span className="flex items-center gap-1.5 text-blue-100 font-bold">
                    <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                    {language === 'hi' ? 'ट्रेनर भैया सोच रहे हैं...' : 'Thinking & Streaming reply...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-100 font-bold">
                    <Volume2 className="w-4 h-4 text-white animate-bounce" />
                    {language === 'hi'
                      ? 'ट्रेनर भैया बोल रहे हैं (बोलकर रोक सकते हैं)'
                      : 'Speaking... (Speak anytime to interrupt)'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            
            {/* MUTE / UNMUTE BUTTON */}
            {isCallActive && (
              <button
                type="button"
                onClick={handleToggleMute}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isMuted
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                    : 'bg-white/15 hover:bg-white/25 text-white border-white/20'
                }`}
                title={isMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>
                  {language === 'hi'
                    ? isMuted
                      ? 'म्यूटेड (Muted)'
                      : 'म्यूट करें'
                    : isMuted
                    ? 'Muted'
                    : 'Mute Voice'}
                </span>
              </button>
            )}

            {/* BARGE-IN BUTTON (When AI is speaking) */}
            {isCallActive && conversationState === 'speaking' && (
              <button
                type="button"
                onClick={handleManualInterrupt}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer animate-pulse"
                title="Interrupt AI speaking"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{language === 'hi' ? 'रुको / Interrupt' : 'Interrupt'}</span>
              </button>
            )}

            {/* START CALL OR END CALL */}
            {!isCallActive ? (
              <button
                type="button"
                onClick={handleStartCall}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer hover:scale-102 active:scale-98"
              >
                <Mic className="w-5 h-5 text-slate-950" />
                <span>{language === 'hi' ? 'बातचीत शुरू करें (Start Call)' : 'Start Real-Time Call'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEndCall}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                title="End continuous conversation"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{language === 'hi' ? 'बातचीत समाप्त (End)' : 'End Call'}</span>
              </button>
            )}
          </div>
        </div>

        {/* LIVE AUDIO WAVEFORM & INTERIM TRANSCRIPT */}
        {isCallActive && (
          <div className="mt-3.5 pt-3 border-t border-white/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            
            {/* Frequency bars visualizer */}
            <div className="flex items-center gap-1.5 h-7 px-3 py-1 bg-black/25 rounded-full border border-white/10 w-full sm:w-auto justify-center">
              {[...Array(12)].map((_, i) => {
                const factor = Math.sin(i * 0.6 + Date.now() / 150);
                const height =
                  conversationState === 'listening'
                    ? Math.max(6, Math.min(26, (audioLevel / 100) * 26 * Math.abs(factor) + 6))
                    : conversationState === 'speaking'
                    ? Math.max(8, Math.min(26, (audioLevel / 100) * 26 * Math.abs(factor) + 8))
                    : 10;

                return (
                  <span
                    key={i}
                    className={`w-1 rounded-full transition-all duration-75 ${
                      conversationState === 'listening'
                        ? 'bg-emerald-300'
                        : conversationState === 'speaking'
                        ? 'bg-amber-300'
                        : 'bg-blue-300'
                    }`}
                    style={{ height: `${height}px` }}
                  />
                );
              })}
              <span className="text-[11px] font-bold text-white/90 ml-1.5 tracking-tight uppercase">
                {conversationState === 'listening'
                  ? language === 'hi'
                    ? 'लाइव माइक'
                    : 'Mic Live'
                  : conversationState === 'speaking'
                  ? language === 'hi'
                    ? 'AI आवाज़'
                    : 'AI Voice'
                  : 'AI Thinking'}
              </span>
            </div>

            {/* Live interim spoken transcript */}
            <div className="flex-1 text-center sm:text-right min-h-[22px]">
              {liveInterimText ? (
                <div className="text-xs sm:text-sm font-bold text-white bg-black/30 px-3 py-1 rounded-xl inline-block max-w-full truncate border border-white/10">
                  <span className="text-amber-300 mr-1.5">"{liveInterimText}"</span>
                  <span className="text-[10px] text-white/70 italic">
                    ({language === 'hi' ? 'रुकते ही जवाब मिलेगा' : 'AI replies on pause'})
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-white/70 font-medium italic">
                  {conversationState === 'listening'
                    ? language === 'hi'
                      ? 'लगातार बोलिए... रुकने पर AI खुद बोलेगा।'
                      : 'Speak freely... AI replies automatically after you pause.'
                    : conversationState === 'speaking'
                    ? language === 'hi'
                      ? 'टोकने के लिए बस बोलिए (Barge-in).'
                      : 'Just speak to interrupt AI anytime.'
                    : '...'}
                </span>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3.5 py-2.5 rounded-xl mb-2 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Conversation Chat Log */}
      <div className="flex-1 overflow-y-auto px-1 sm:px-2 space-y-3.5 scroll-smooth">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isThisPlaying = currentSpeakingId === msg.id && speechService.isSpeaking();

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div
                className={`flex gap-2.5 max-w-[92%] sm:max-w-[85%] ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold shadow-xs ${
                    isUser ? 'bg-slate-800 text-white' : 'bg-amber-500 text-slate-950 font-black'
                  }`}
                >
                  {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 shadow-xs text-sm leading-relaxed ${
                    isUser
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                  }`}
                >
                  {/* Voice input tag */}
                  {msg.fromVoice && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold mb-1">
                      <Mic className="w-3 h-3 text-amber-500" />
                      <span>{language === 'hi' ? 'लाइव आवाज़ द्वारा' : 'Voice Input'}</span>
                    </div>
                  )}

                  {/* Message Text with Streaming Cursor */}
                  <div className="whitespace-pre-line font-medium">
                    {msg.text || (
                      <span className="inline-flex items-center gap-1 text-slate-400 italic text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {language === 'hi' ? 'ट्रेनर भैया बोल रहे हैं...' : 'Speaking...'}
                      </span>
                    )}
                  </div>

                  {/* Audio Playback & Timestamp bar */}
                  {msg.text && (
                    <div className="mt-2 flex items-center justify-between gap-3 pt-1 border-t border-slate-100/50">
                      <span className="text-[10px] text-slate-400">{msg.timestamp}</span>

                      {!isUser && (
                        <button
                          onClick={() => handlePlayMessageAudio(msg)}
                          className={`flex items-center gap-1 px-2.5 py-0.8 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isThisPlaying
                              ? 'bg-amber-500 text-white animate-pulse'
                              : 'bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800'
                          }`}
                          title="Play audio explanation"
                        >
                          {isThisPlaying ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5" />
                              <span>{language === 'hi' ? 'रोकें' : 'Stop'}</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                              <span>{language === 'hi' ? 'आवाज़ में सुनें' : 'Listen'}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Follow-up Suggestion Chips for assistant's last message */}
              {!isUser && msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                <div className="mt-2 pl-10 pr-2 flex flex-wrap gap-1.5">
                  {msg.followUpSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => submitUserQuery(suggestion)}
                      disabled={conversationState === 'processing'}
                      className="text-left bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 hover:border-amber-300 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input / Control Bar at Bottom */}
      <div className="mt-2 bg-white rounded-2xl border border-slate-300 shadow-sm p-2 flex items-center gap-2 shrink-0">
        
        {/* Real-time Voice Toggle Button */}
        <button
          type="button"
          onClick={isCallActive ? handleEndCall : handleStartCall}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            isCallActive
              ? 'bg-red-600 text-white animate-pulse shadow-md ring-4 ring-red-100'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-xs hover:scale-105 active:scale-95'
          }`}
          title={isCallActive ? 'End voice call' : 'Start real-time voice conversation'}
          aria-label="Real-time Microphone"
        >
          {isCallActive ? <PhoneOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* Text Input (Optional typing) */}
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSendManualText();
            }
          }}
          placeholder={
            isCallActive
              ? language === 'hi'
                ? 'लाइव कॉल चालू है—बस बोलते रहिए, या यहां टाइप करें...'
                : 'Live call active—just speak, or type here...'
              : language === 'hi'
              ? 'माइक दबाकर लाइव बोलें, या यहां टाइप करें...'
              : 'Tap mic for live talk, or type question here...'
          }
          className="flex-1 bg-transparent px-2 text-sm sm:text-base font-medium text-slate-800 placeholder-slate-400 focus:outline-none min-h-[44px]"
        />

        {/* Manual Send Button */}
        <button
          type="button"
          onClick={handleSendManualText}
          disabled={!inputQuery.trim() || conversationState === 'processing'}
          className="w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-xs"
          title="Send text"
          aria-label="Send"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

    </div>
  );
};
