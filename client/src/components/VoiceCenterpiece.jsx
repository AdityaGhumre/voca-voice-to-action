import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  Volume2,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  Info,
  Receipt,
  CheckSquare,
  Bell,
  Bot,
  HelpCircle,
  Database,
  Check,
  X,
  VolumeX,
  Square
} from 'lucide-react';
import { parseCommand, executeActions } from '../services/api';
import {
  speakMessage,
  stopSpeaking,
  isSpeechSynthesisSupported,
  getStoredMutePreference,
  setStoredMutePreference
} from '../services/speechSynthesis';

const SAMPLE_PROMPTS = [
  "I spent 250 rupees on lunch, remind me to submit my assignment on Friday, and create a task to call Rahul tomorrow.",
  "Create a high-priority task to prepare the hackathon demo, description: test the microphone, verify all three actions and prepare the presentation.",
  "I spent money on lunch" // Missing amount clarification test case
];

const SILENCE_TIMEOUT_MS = 3000; // Target ~3.0s pause tolerance once speech has started
const INACTIVITY_TIMEOUT_MS = 7000; // 7.0s timeout if user says nothing after starting mic
const DUPLICATE_WINDOW_MS = 60000; // 60s duplicate detection window

// Normalization for duplicate command comparison
function normalizeCommand(text) {
  return (text || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

const isSpeechSupported = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
};

export default function VoiceCenterpiece({ onActionsExecuted }) {
  // Clear states: 'idle' | 'listening' | 'processing' | 'completed' | 'error'
  const [mode, setMode] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState(
    !isSpeechSupported()
      ? 'Web Speech API is not supported in this browser. Please use Google Chrome, Edge, or Safari.'
      : ''
  );
  const [aiResult, setAiResult] = useState(null);
  const [savedData, setSavedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState(null);
  const [actionDuplicates, setActionDuplicates] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(getStoredMutePreference);
  const [emptyNotice, setEmptyNotice] = useState('');

  const recognitionRef = useRef(null);
  const isRecordingSessionRef = useRef(false);
  const userManuallyStoppedRef = useRef(false);
  const hasSpokenInSessionRef = useRef(false);
  const sessionTranscriptPartsRef = useRef([]);
  const currentSegmentRef = useRef('');
  const silenceTimerRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const emptyRestartCountRef = useRef(0);
  const isAIInFlightRef = useRef(false);
  const lastConfirmationMessageRef = useRef('');

  // Duplicate tracking ref: { normalized: '', text: '', timestamp: 0 }
  const lastExecutedCommandRef = useRef({ normalized: '', text: '', timestamp: 0 });

  // Clear timers safely
  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const clearInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  };

  const clearAllTimers = () => {
    clearSilenceTimer();
    clearInactivityTimer();
  };

  // Handles 7-second complete inactivity (user clicked mic and said nothing)
  const handleInactivityTimeout = useCallback(() => {
    if (!hasSpokenInSessionRef.current) {
      console.log('[Voice Engine] Inactivity timeout reached (7s). No speech detected.');
      clearSilenceTimer();
      clearInactivityTimer();
      userManuallyStoppedRef.current = true;
      isRecordingSessionRef.current = false;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          try { recognitionRef.current.stop(); } catch {}
        }
      }

      sessionTranscriptPartsRef.current = [];
      currentSegmentRef.current = '';

      setMode('idle');
      setTranscript('');
      setEmptyNotice('No speech detected. Tap the microphone and try again.');
    }
  }, []);

  // SpeechSynthesis Voice Out helper
  const speakConfirmation = useCallback((text) => {
    if (!text || isMuted || !isSpeechSynthesisSupported()) return;
    lastConfirmationMessageRef.current = text;
    speakMessage(text, {
      isMuted,
      rate: 0.98,
      pitch: 1.0,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
  }, [isMuted]);

  const handleStopSpeaking = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      setStoredMutePreference(next);
      if (next) {
        stopSpeaking();
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  const handleReplayConfirmation = useCallback(() => {
    const text = lastConfirmationMessageRef.current || aiResult?.assistantMessage;
    if (!text) return;
    stopSpeaking();
    speakMessage(text, {
      isMuted: false,
      rate: 0.98,
      pitch: 1.0,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
  }, [aiResult]);

  // Clean up speech on component unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // Perform backend execution with idempotency & safety
  const executeValidatedActions = useCallback(async (parsedData, textToExecute, forceExecute = false) => {
    const trimmed = textToExecute.trim();
    const normalized = normalizeCommand(trimmed);
    const now = Date.now();

    // Check for identical normalized command within 60 seconds
    const timeDiff = now - lastExecutedCommandRef.current.timestamp;
    if (!forceExecute && lastExecutedCommandRef.current.normalized === normalized && timeDiff < DUPLICATE_WINDOW_MS) {
      const timeAgoSec = Math.max(1, Math.round(timeDiff / 1000));
      setDuplicatePrompt({
        parsedData,
        transcript: trimmed,
        timeAgoSec
      });
      setMode('completed');
      return;
    }

    try {
      const requestId = `req-${now}-${Math.random().toString(36).substring(2, 7)}`;
      const executionResult = await executeActions({
        actions: parsedData.actions,
        transcript: trimmed,
        assistantMessage: parsedData.assistantMessage,
        requestId,
        force: forceExecute
      });

      // Action-level duplicate check returned by backend
      if (executionResult?.duplicateWarning && Array.isArray(executionResult.duplicates) && executionResult.duplicates.length > 0) {
        console.warn('[Duplicate Guard] Action-level duplicates detected:', executionResult.duplicates);
        setActionDuplicates({
          parsedData,
          transcript: trimmed,
          duplicates: executionResult.duplicates,
          message: executionResult.message
        });
        setMode('completed');
        return;
      }

      const saved = executionResult?.saved || executionResult?.data?.saved;
      if (!executionResult || !saved) {
        throw new Error('Action execution failed on backend: No records were saved.');
      }

      // Record successful execution for duplicate tracking
      lastExecutedCommandRef.current = {
        normalized,
        text: trimmed,
        timestamp: now
      };

      setSavedData(saved);
      setDuplicatePrompt(null);
      setActionDuplicates(null);
      setMode('completed');

      // Speak confirmation message only after successful backend persistence
      if (parsedData.assistantMessage) {
        lastConfirmationMessageRef.current = parsedData.assistantMessage;
        speakConfirmation(parsedData.assistantMessage);
      }

      if (typeof onActionsExecuted === 'function') {
        onActionsExecuted();
      }
    } catch (err) {
      console.error('[Action Execution Error]:', err);
      stopSpeaking();
      setIsSpeaking(false);
      setSavedData(null);
      // Do NOT clear aiResult here — the parse succeeded; only saving failed.
      // Keeping aiResult lets the user see what was understood before the network error.
      setMode('error');
      setErrorMessage(err.message || 'Failed to execute actions. Your command was understood but could not be saved — please try again.');
    }
  }, [onActionsExecuted]);

  // Process finalized transcript with Gemini
  const processTranscriptWithAI = useCallback(async (textToParse, forceExecute = false) => {
    const trimmed = textToParse.trim();
    if (!trimmed) {
      setMode('idle');
      return;
    }

    if (isAIInFlightRef.current) return;
    isAIInFlightRef.current = true;

    setMode('processing');
    setIsProcessing(true);
    setErrorMessage('');
    setSavedData(null);
    setDuplicatePrompt(null);
    setActionDuplicates(null);
    stopSpeaking();
    setIsSpeaking(false);

    try {
      // Step 1: Parse intent with Gemini
      const parsedData = await parseCommand(trimmed);
      setAiResult(parsedData);

      // Step 2: If valid actions exist and no clarification is needed, proceed to execution check
      if (parsedData.summary?.totalActions > 0 && !parsedData.clarificationNeeded) {
        await executeValidatedActions(parsedData, trimmed, forceExecute);
      } else {
        setSavedData(null);
        setMode('completed');
      }
    } catch (err) {
      console.error('[Voice Pipeline Error]:', err);
      setSavedData(null);
      setAiResult(null);
      setMode('error');
      setErrorMessage(err.message || 'Failed to process voice command.');
    } finally {
      setIsProcessing(false);
      isAIInFlightRef.current = false;
    }
  }, [executeValidatedActions]);

  // Finalizes the overall recording session and dispatches combined text to Gemini ONCE
  const finalizeRecordingSession = useCallback(() => {
    clearSilenceTimer();
    clearInactivityTimer();
    isRecordingSessionRef.current = false;
    userManuallyStoppedRef.current = true;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    // Combine all accumulated segments in chronological order
    const allSegments = [...sessionTranscriptPartsRef.current, currentSegmentRef.current]
      .filter(Boolean)
      .join(' ')
      .trim();

    sessionTranscriptPartsRef.current = [];
    currentSegmentRef.current = '';

    if (allSegments) {
      setEmptyNotice('');
      setTranscript(allSegments);
      processTranscriptWithAI(allSegments);
    } else {
      setTranscript('');
      setMode('idle');
      setEmptyNotice('No speech detected. Tap the microphone and try again.');
    }
  }, [processTranscriptWithAI]);

  // Initialize SpeechRecognition once on component mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setMode('listening');
      setErrorMessage('');
    };

    recognition.onresult = (event) => {
      let thisFinal = '';
      let thisInterim = '';

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          thisFinal += item[0].transcript + ' ';
        } else {
          thisInterim += item[0].transcript;
        }
      }

      const detected = (thisFinal + thisInterim).trim();
      currentSegmentRef.current = detected;
      emptyRestartCountRef.current = 0;

      if (detected) {
        // User has spoken: mark session active with speech and cancel 7s inactivity timer
        hasSpokenInSessionRef.current = true;
        setEmptyNotice('');
        clearInactivityTimer();

        // Combine previous confirmed segments with current live segment
        const combined = [...sessionTranscriptPartsRef.current, currentSegmentRef.current]
          .filter(Boolean)
          .join(' ')
          .trim();

        setTranscript(combined);

        // Reset the 3.0-second silence timer on any detected speech
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
          finalizeRecordingSession();
        }, SILENCE_TIMEOUT_MS);
      }
    };

    recognition.onerror = (event) => {
      console.warn('SpeechRecognition event error:', event.error);

      if (event.error === 'no-speech') {
        // Handled gracefully in onend / inactivity timer
        return;
      }

      if (event.error === 'not-allowed') {
        clearSilenceTimer();
        clearInactivityTimer();
        isRecordingSessionRef.current = false;
        userManuallyStoppedRef.current = true;
        setMode('error');
        setErrorMessage('Microphone access blocked. Please allow microphone permission in your browser.');
      } else if (event.error === 'audio-capture') {
        clearSilenceTimer();
        clearInactivityTimer();
        isRecordingSessionRef.current = false;
        userManuallyStoppedRef.current = true;
        setMode('error');
        setErrorMessage('No microphone detected. Please verify your audio input device.');
      } else if (event.error !== 'aborted') {
        setMode('error');
        setErrorMessage(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // 1. If user manually clicked stop, do not restart
      if (userManuallyStoppedRef.current || !isRecordingSessionRef.current) {
        return;
      }

      // 2. Commit segment to confirmed parts
      if (currentSegmentRef.current) {
        sessionTranscriptPartsRef.current.push(currentSegmentRef.current);
        currentSegmentRef.current = '';
      }

      // 3. User has actually started speaking: preserve pause tolerance restarts
      if (hasSpokenInSessionRef.current) {
        if (emptyRestartCountRef.current < 5) {
          emptyRestartCountRef.current += 1;
          try {
            recognition.start();
          } catch {
            setTimeout(() => {
              if (isRecordingSessionRef.current && !userManuallyStoppedRef.current) {
                try { recognition.start(); } catch { finalizeRecordingSession(); }
              }
            }, 100);
          }
        } else {
          finalizeRecordingSession();
        }
      } else {
        // 4. User has NOT spoken anything yet: allow at most 1 brief restart only while 7s timer runs
        if (emptyRestartCountRef.current < 2 && inactivityTimerRef.current) {
          emptyRestartCountRef.current += 1;
          try {
            recognition.start();
          } catch {
            handleInactivityTimeout();
          }
        } else {
          handleInactivityTimeout();
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      clearInactivityTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
    };
  }, [finalizeRecordingSession, handleInactivityTimeout]);

  // Start or stop recording toggle
  const toggleListening = useCallback(() => {
    if (!isSpeechSupported()) {
      setErrorMessage('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecordingSessionRef.current) {
      // User manually stopped
      userManuallyStoppedRef.current = true;
      clearSilenceTimer();
      clearInactivityTimer();

      const combined = [...sessionTranscriptPartsRef.current, currentSegmentRef.current]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (combined) {
        finalizeRecordingSession();
      } else {
        // Manual stop with zero speech: return directly to idle, zero API calls
        isRecordingSessionRef.current = false;
        try { recognitionRef.current?.abort(); } catch {}
        sessionTranscriptPartsRef.current = [];
        currentSegmentRef.current = '';
        setTranscript('');
        setMode('idle');
        setEmptyNotice('No speech detected. Tap the microphone and try again.');
      }
    } else {
      // Starting a completely fresh recording session
      stopSpeaking();
      setIsSpeaking(false);
      clearSilenceTimer();
      clearInactivityTimer();

      isRecordingSessionRef.current = true;
      userManuallyStoppedRef.current = false;
      hasSpokenInSessionRef.current = false;
      sessionTranscriptPartsRef.current = [];
      currentSegmentRef.current = '';
      emptyRestartCountRef.current = 0;

      setEmptyNotice('');
      setTranscript('');
      setErrorMessage('');
      setAiResult(null);
      setSavedData(null);
      setDuplicatePrompt(null);
      setActionDuplicates(null);

      // Start 7-second inactivity timer
      inactivityTimerRef.current = setTimeout(() => {
        handleInactivityTimeout();
      }, INACTIVITY_TIMEOUT_MS);

      try {
        recognitionRef.current?.start();
      } catch {
        try {
          recognitionRef.current?.abort();
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
            } catch {
              clearSilenceTimer();
              clearInactivityTimer();
              isRecordingSessionRef.current = false;
              setMode('error');
              setErrorMessage('Failed to start microphone. Please try again.');
            }
          }, 150);
        } catch {
          clearSilenceTimer();
          clearInactivityTimer();
          isRecordingSessionRef.current = false;
          setMode('error');
          setErrorMessage('Could not initialize microphone.');
        }
      }
    }
  }, [finalizeRecordingSession, handleInactivityTimeout]);

  // Sample prompt selection
  const handleApplySample = (text) => {
    clearSilenceTimer();
    clearInactivityTimer();
    userManuallyStoppedRef.current = true;
    isRecordingSessionRef.current = false;
    hasSpokenInSessionRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }

    setEmptyNotice('');
    setTranscript(text);
    setErrorMessage('');
    processTranscriptWithAI(text);
  };

  // Reset transcript and mode to idle
  const handleReset = () => {
    clearSilenceTimer();
    clearInactivityTimer();
    userManuallyStoppedRef.current = true;
    isRecordingSessionRef.current = false;
    hasSpokenInSessionRef.current = false;
    sessionTranscriptPartsRef.current = [];
    currentSegmentRef.current = '';

    if (recognitionRef.current) {
      try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    }
    stopSpeaking();
    setIsSpeaking(false);
    setMode('idle');
    setEmptyNotice('');
    setTranscript('');
    setErrorMessage('');
    setAiResult(null);
    setSavedData(null);
    setDuplicatePrompt(null);
    setActionDuplicates(null);
  };

  // User confirmed creating action duplicate anyway
  const handleConfirmActionDuplicates = () => {
    if (!actionDuplicates) return;
    const { parsedData, transcript: cmdText } = actionDuplicates;
    setActionDuplicates(null);
    executeValidatedActions(parsedData, cmdText, true);
  };

  // User cancelled action duplicate
  const handleCancelActionDuplicates = () => {
    setActionDuplicates(null);
    setMode('completed');
  };

  // User explicitly confirmed duplicate action execution
  const handleConfirmDuplicate = () => {
    if (!duplicatePrompt) return;
    const { parsedData, transcript: cmdText } = duplicatePrompt;
    setDuplicatePrompt(null);
    executeValidatedActions(parsedData, cmdText, true);
  };

  // User cancelled duplicate action execution
  const handleCancelDuplicate = () => {
    setDuplicatePrompt(null);
    setMode('completed');
  };

  const hasPersisted = Boolean(savedData && (savedData.expenses?.length || savedData.tasks?.length || savedData.reminders?.length));

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#101726] border border-[#1E2A3E] p-6 sm:p-8 shadow-xl">
      {/* Background ambient subtle glow */}
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#CCFF00]/5 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[#8B5CF6]/5 blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium mb-6 transition-all duration-300 border bg-[#141E30] border-[#223147]">
          {mode === 'idle' && (
            <>
              <span className="w-2 h-2 rounded-full bg-[#7A88A1]"></span>
              <span className="text-[#9AA6BC]">Ready to listen (natural pauses supported)</span>
            </>
          )}
          {mode === 'listening' && (
            <>
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-ping"></span>
              <span className="text-[#CCFF00] font-semibold">Listening... (feel free to pause while thinking)</span>
            </>
          )}
          {mode === 'processing' && (
            <>
              <Sparkles className="w-3.5 h-3.5 text-[#A78BFA] animate-spin" />
              <span className="text-[#A78BFA] font-semibold">Gemini parsing intent & executing actions...</span>
            </>
          )}
          {mode === 'completed' && hasPersisted && (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#CCFF00]" />
              <span className="text-[#CCFF00] font-semibold">Actions executed & saved to storage</span>
            </>
          )}
          {mode === 'completed' && !hasPersisted && (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span className="text-[#A78BFA] font-semibold">Voice command analyzed</span>
            </>
          )}
          {mode === 'error' && (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-rose-400 font-semibold">Execution alert</span>
            </>
          )}
        </div>

        {/* Central Prominent Microphone Button */}
        <div className="relative my-4 flex items-center justify-center">
          {mode === 'listening' && (
            <>
              <div className="absolute inset-0 -m-4 rounded-full border border-[#CCFF00]/30 animate-ping pointer-events-none"></div>
              <div className="absolute inset-0 -m-8 rounded-full border border-[#CCFF00]/15 pointer-events-none"></div>
            </>
          )}

          <button
            onClick={toggleListening}
            disabled={isProcessing}
            className={`group relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-95 disabled:opacity-80 ${
              mode === 'listening'
                ? 'bg-[#CCFF00] text-[#0B0F17] shadow-[0_0_50px_rgba(204,255,0,0.45)] scale-105'
                : mode === 'processing'
                ? 'bg-[#8B5CF6] text-white shadow-[0_0_35px_rgba(139,92,246,0.35)] animate-pulse'
                : hasPersisted
                ? 'bg-[#151F31] text-[#CCFF00] border-2 border-[#CCFF00] shadow-[0_0_30px_rgba(204,255,0,0.2)] hover:bg-[#1A263C]'
                : mode === 'error'
                ? 'bg-[#1D161F] text-rose-400 border-2 border-rose-500/40 hover:border-rose-400'
                : 'bg-[#151F31] text-[#CCFF00] hover:bg-[#1A263C] border-2 border-[#25354F] hover:border-[#CCFF00]/50 shadow-lg'
            }`}
            title={
              mode === 'listening'
                ? 'Click to finish speaking now'
                : 'Click to start speaking'
            }
          >
            {mode === 'listening' ? (
              <MicOff className="w-10 h-10 stroke-[2.2]" />
            ) : mode === 'processing' ? (
              <Sparkles className="w-10 h-10 animate-spin" />
            ) : (
              <Mic className="w-10 h-10 group-hover:scale-110 transition-transform duration-200 stroke-[2.2]" />
            )}
          </button>
        </div>

        {/* Waveform graphic ONLY while listening */}
        {mode === 'listening' ? (
          <div className="flex items-center justify-center gap-1.5 h-14 my-3">
            <span className="w-1.5 bg-[#CCFF00] rounded-full animate-wave-1"></span>
            <span className="w-1.5 bg-[#CCFF00] rounded-full animate-wave-2"></span>
            <span className="w-1.5 bg-[#CCFF00] rounded-full animate-wave-3"></span>
            <span className="w-1.5 bg-[#CCFF00] rounded-full animate-wave-4"></span>
            <span className="w-1.5 bg-[#CCFF00] rounded-full animate-wave-5"></span>
            <span className="w-1.5 bg-[#CCFF00] rounded-full animate-wave-2"></span>
            <span className="w-1.5 bg-[#CCFF00] rounded-full animate-wave-4"></span>
            <span className="w-1.5 bg-[#CCFF00] rounded-full animate-wave-1"></span>
          </div>
        ) : (
          <p className="text-sm font-medium text-[#9AA6BC] mt-2 mb-4">
            {mode === 'processing'
              ? 'Parsing speech & writing actions to database...'
              : hasPersisted
              ? 'Success! Actions persisted to database & updated on dashboard below'
              : actionDuplicates
              ? 'Action duplicate detected. Confirmation required below'
              : duplicatePrompt
              ? 'Duplicate command confirmation required below'
              : emptyNotice
              ? emptyNotice
              : mode === 'error'
              ? 'Notice encountered. Tap the microphone to retry'
              : 'Tap mic to speak. Automatic stop activates after 3 seconds of silence'}
          </p>
        )}

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="w-full max-w-2xl mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage('')}
              className="text-rose-400 hover:text-rose-200 text-xs underline shrink-0 ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Friendly Empty Speech Notice Banner */}
        {emptyNotice && (
          <div className="w-full max-w-2xl mb-4 p-3.5 rounded-xl bg-[#141E30] border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between text-left animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-medium text-amber-200">{emptyNotice}</span>
            </div>
            <button
              onClick={() => setEmptyNotice('')}
              className="text-[#7A88A1] hover:text-[#F7F7F2] text-xs shrink-0 ml-3"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* ACTION-LEVEL DUPLICATE WARNING CARD */}
        {/* ============================================================ */}
        {actionDuplicates && (
          <div className="w-full max-w-2xl mb-5 p-5 rounded-xl bg-[#171410] border-2 border-amber-500/60 text-left space-y-4 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-amber-300">
                    Duplicate Action Detected
                  </h4>
                  <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
                    Confirmation Required
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                  The spoken action matches existing record(s) in your workspace. We prevented automatic duplication until you decide:
                </p>
              </div>
            </div>

            {/* List of matching duplicates */}
            <div className="space-y-3">
              {actionDuplicates.duplicates.map((dup, idx) => (
                <div key={idx} className="p-3.5 rounded-lg bg-[#0F1420] border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      {dup.type === 'task' && <CheckSquare className="w-3.5 h-3.5" />}
                      {dup.type === 'reminder' && <Bell className="w-3.5 h-3.5" />}
                      {dup.type === 'expense' && <Receipt className="w-3.5 h-3.5" />}
                      {dup.type.toUpperCase()} MATCH
                    </span>
                    <span className="text-[10px] text-[#7A88A1] font-mono">
                      Existing ID: {dup.existingRecord?.id}
                    </span>
                  </div>

                  {/* Comparison Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* New Proposed Item */}
                    <div className="p-2.5 rounded bg-[#162032] border border-[#23354E]">
                      <span className="text-[10px] font-semibold text-[#8B5CF6] uppercase block mb-1">
                        Proposed New Action
                      </span>
                      {dup.type === 'task' && (
                        <div>
                          <p className="font-semibold text-[#F7F7F2] truncate">{dup.item?.title}</p>
                          <p className="text-[11px] text-[#9AA6BC]">Priority: {dup.item?.priority} · Due: {dup.item?.dueDate || 'Today'}</p>
                        </div>
                      )}
                      {dup.type === 'reminder' && (
                        <div>
                          <p className="font-semibold text-[#F7F7F2] truncate">{dup.item?.title}</p>
                          <p className="text-[11px] text-[#9AA6BC]">Time: {dup.item?.time || 'All Day'} · Date: {dup.item?.date}</p>
                        </div>
                      )}
                      {dup.type === 'expense' && (
                        <div>
                          <p className="font-semibold text-[#CCFF00]">₹{dup.item?.amount} — {dup.item?.description}</p>
                          <p className="text-[11px] text-[#9AA6BC]">Category: {dup.item?.category} · Date: {dup.item?.date}</p>
                        </div>
                      )}
                    </div>

                    {/* Existing Record in DB */}
                    <div className="p-2.5 rounded bg-[#221A15] border border-amber-500/25">
                      <span className="text-[10px] font-semibold text-amber-400 uppercase block mb-1">
                        Existing Active Record
                      </span>
                      {dup.type === 'task' && (
                        <div>
                          <p className="font-semibold text-[#F7F7F2] truncate">{dup.existingRecord?.title}</p>
                          <p className="text-[11px] text-amber-200/80">Pending Task · Due: {dup.existingRecord?.dueDate}</p>
                        </div>
                      )}
                      {dup.type === 'reminder' && (
                        <div>
                          <p className="font-semibold text-[#F7F7F2] truncate">{dup.existingRecord?.title}</p>
                          <p className="text-[11px] text-amber-200/80">Scheduled: {dup.existingRecord?.dateTime}</p>
                        </div>
                      )}
                      {dup.type === 'expense' && (
                        <div>
                          <p className="font-semibold text-amber-300">₹{dup.existingRecord?.amount} — {dup.existingRecord?.description}</p>
                          <p className="text-[11px] text-amber-200/80">Category: {dup.existingRecord?.category} · Date: {dup.existingRecord?.date}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-300/80 italic">
                    {dup.message}
                  </p>
                </div>
              ))}
            </div>

            {/* User Choice Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-amber-500/20">
              <span className="text-xs text-[#9AA6BC]">
                Would you like to cancel or create another record anyway?
              </span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  onClick={handleCancelActionDuplicates}
                  className="px-3.5 py-2 rounded-lg bg-[#141C2B] hover:bg-[#1A2538] border border-[#273752] text-xs font-semibold text-[#9AA6BC] hover:text-[#F7F7F2] transition flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel (Discard duplicate)
                </button>
                <button
                  onClick={handleConfirmActionDuplicates}
                  className="px-4 py-2 rounded-lg bg-[#CCFF00] hover:bg-[#D4FF1A] text-[#0B0F17] text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-[#CCFF00]/20"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  Create Another Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PART B — DUPLICATE CONFIRMATION BANNER */}
        {/* ============================================================ */}
        {duplicatePrompt && (
          <div className="w-full max-w-2xl mb-4 p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-left space-y-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-amber-300">
                  Potential Duplicate Command Detected
                </h4>
                <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                  You submitted this exact command <span className="font-mono font-semibold text-amber-100">{duplicatePrompt.timeAgoSec}s ago</span>:
                </p>
                <div className="p-2.5 rounded-lg bg-[#0F1626] border border-amber-500/20 text-xs text-[#F7F7F2] font-medium my-2">
                  "{duplicatePrompt.transcript}"
                </div>
                <p className="text-xs text-amber-200/80">
                  Did you intend to execute this transaction or action a second time?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                onClick={handleCancelDuplicate}
                className="px-3 py-1.5 rounded-lg bg-[#141C2B] hover:bg-[#1A2538] border border-[#273752] text-xs font-medium text-[#9AA6BC] hover:text-[#F7F7F2] transition flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                onClick={handleConfirmDuplicate}
                className="px-3.5 py-1.5 rounded-lg bg-[#CCFF00] hover:bg-[#D4FF1A] text-[#0B0F17] text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#CCFF00]/20"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                Yes, Execute Again
              </button>
            </div>
          </div>
        )}

        {/* Spoken Voice Transcript Box */}
        <div className="w-full max-w-2xl bg-[#0B0F17]/90 border border-[#1E293D] rounded-xl p-4 text-left transition-all">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#1A2335]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6B82] flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-[#CCFF00]" />
              {mode === 'listening' ? 'Live Transcribing...' : 'Spoken Voice Transcript'}
            </span>
            {transcript && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono font-medium text-[#CCFF00] bg-[#CCFF00]/10 px-1.5 py-0.5 rounded border border-[#CCFF00]/20">
                  {hasPersisted ? 'Executed' : 'Transcribed'}
                </span>
                <button
                  onClick={handleReset}
                  className="text-[11px] text-[#7A88A1] hover:text-[#CCFF00] transition flex items-center gap-1"
                  title="Clear transcript"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            )}
          </div>
          <p className={`text-sm leading-relaxed ${transcript ? 'text-[#F7F7F2]' : 'text-[#4A576D] italic'}`}>
            {transcript || (
              mode === 'listening'
                ? 'Listening... Speak naturally (e.g. "I spent 350 rupees on dinner, remind me to call doctor on Monday at 10 AM...")'
                : emptyNotice
                ? 'No speech detected. Tap the microphone and try again.'
                : 'Microphone is standby. Tap the microphone button or pick a sample below.'
            )}
          </p>
        </div>

        {/* ============================================================ */}
        {/* ACTION EXECUTION RESULTS DISPLAY */}
        {/* ============================================================ */}
        {aiResult && !duplicatePrompt && !actionDuplicates && (
          <div className="w-full max-w-2xl mt-5 bg-[#0F1626] border border-[#273852] rounded-xl p-5 text-left shadow-lg space-y-4 animate-in fade-in duration-300">
            {/* AI Assistant Message Header */}
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#141E32] border border-[#1F2E47]">
              <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#A78BFA] shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#A78BFA] flex items-center gap-1.5">
                    Voca Action Engine
                    <span className="text-[10px] font-mono font-normal px-1.5 py-0.2 rounded bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#C4B5FD]">
                      gemini-3.5-flash-lite
                    </span>
                  </span>
                  {hasPersisted && (
                    <span className="text-[10px] font-mono font-bold text-[#CCFF00] bg-[#CCFF00]/10 px-2 py-0.5 rounded border border-[#CCFF00]/30 flex items-center gap-1">
                      <Database className="w-3 h-3 text-[#CCFF00]" />
                      Persisted
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#F7F7F2] leading-relaxed">
                  {aiResult.assistantMessage}
                </p>

                {/* Spoken AI Voice Out Player Bar */}
                {hasPersisted && (
                  <div className="mt-3 pt-2.5 border-t border-[#1C2C45] flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center transition ${
                        isSpeaking ? 'bg-[#CCFF00]/20 text-[#CCFF00] animate-pulse' : 'bg-[#182338] text-[#7A88A1]'
                      }`}>
                        {isMuted ? (
                          <VolumeX className="w-3.5 h-3.5 text-[#5B6B82]" />
                        ) : (
                          <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'text-[#CCFF00]' : 'text-[#7A88A1]'}`} />
                        )}
                      </div>
                      <span className="text-[11px] font-medium flex items-center gap-1.5">
                        {isSpeaking ? (
                          <span className="text-[#CCFF00] font-semibold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-ping"></span>
                            Speaking confirmation aloud...
                          </span>
                        ) : isMuted ? (
                          <span className="text-[#5B6B82]">Voice output muted</span>
                        ) : (
                          <span className="text-[#7A88A1]">Voice confirmation ready</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isSpeaking ? (
                        <button
                          type="button"
                          onClick={handleStopSpeaking}
                          className="px-2.5 py-1 rounded-md bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-[11px] font-semibold transition flex items-center gap-1"
                          title="Stop speech"
                        >
                          <Square className="w-2.5 h-2.5 fill-rose-300" />
                          Stop
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleReplayConfirmation}
                          className="px-2.5 py-1 rounded-md bg-[#182338] hover:bg-[#202E4A] border border-[#273852] text-[#CCFF00] hover:text-[#D4FF1A] text-[11px] font-semibold transition flex items-center gap-1.5 shadow-sm"
                          title="Replay confirmation aloud"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Replay Audio
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleToggleMute}
                        className={`p-1.5 rounded-md border transition ${
                          isMuted
                            ? 'bg-rose-950/30 border-rose-500/40 text-rose-400 hover:text-rose-200'
                            : 'bg-[#182338] border-[#273852] text-[#9AA6BC] hover:text-[#F7F7F2]'
                        }`}
                        title={isMuted ? 'Unmute voice output' : 'Mute voice output'}
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Clarification Alert if needed */}
            {aiResult.clarificationNeeded && (
              <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-600/30 text-amber-200 text-xs flex items-start gap-3">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-300">Clarification Needed (Nothing Saved)</p>
                  <p className="text-amber-200/90 mt-0.5">{aiResult.clarificationMessage}</p>
                  <p className="text-[11px] text-amber-400/80 mt-1">Tap the microphone to supply the missing information.</p>
                </div>
              </div>
            )}

            {/* Executed and Saved Records Display */}
            {hasPersisted && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9AA6BC] flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#CCFF00]" />
                    Saved to Persistent Storage
                  </span>
                  <span className="text-[10px] text-[#CCFF00] font-mono font-semibold">
                    Dashboard Synced
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Saved Expenses */}
                  {savedData.expenses?.map((exp) => (
                    <div key={exp.id} className="p-3 rounded-lg bg-[#141E30] border border-[#1F2E47] flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00] shrink-0">
                          <Receipt className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#F7F7F2] truncate">{exp.description}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1B273D] text-[#9AA6BC] font-medium">{exp.category}</span>
                          </div>
                          <span className="text-[10px] text-[#5B6B82] font-mono">{exp.date} · ID: {exp.id}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold font-mono text-[#CCFF00] shrink-0">
                        {exp.currency || '₹'}{exp.amount}
                      </span>
                    </div>
                  ))}

                  {/* Saved Tasks */}
                  {savedData.tasks?.map((tsk) => (
                    <div key={tsk.id} className="p-3 rounded-lg bg-[#141E30] border border-[#1F2E47] flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00] shrink-0">
                          <CheckSquare className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#F7F7F2] truncate">{tsk.title}</p>
                          {tsk.description && (
                            <p className="text-[11px] text-[#9AA6BC] truncate">{tsk.description}</p>
                          )}
                          <span className="text-[10px] text-[#5B6B82] font-mono">Due: {tsk.dueDate} · ID: {tsk.id}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border shrink-0 ${
                        tsk.priority === 'high'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : tsk.priority === 'low'
                          ? 'bg-[#1E293B] text-[#8695AB] border-[#2A3B54]'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}>
                        {tsk.priority} priority
                      </span>
                    </div>
                  ))}

                  {/* Saved Reminders */}
                  {savedData.reminders?.map((rem) => (
                    <div key={rem.id} className="p-3 rounded-lg bg-[#141E30] border border-[#1F2E47] flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA] shrink-0">
                          <Bell className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#F7F7F2] truncate">{rem.title}</p>
                          <span className="text-[10px] text-[#5B6B82] font-mono">{rem.dateTime} · ID: {rem.id}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-[#A78BFA] bg-[#8B5CF6]/10 px-2 py-0.5 rounded border border-[#8B5CF6]/20 shrink-0">
                        {rem.time || 'All Day'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sample Prompt Quick Selectors */}
        <div className="w-full max-w-2xl mt-4">
          <div className="flex items-center justify-between text-xs text-[#5B6B82] mb-2 px-1">
            <span>Or test with a sample sentence:</span>
            <span className="text-[11px] text-[#CCFF00]/80">Multi-action test cases</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SAMPLE_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleApplySample(prompt)}
                disabled={isProcessing}
                className="text-left p-2.5 rounded-lg bg-[#141C2B] hover:bg-[#1A253A] border border-[#1E2A3E] hover:border-[#CCFF00]/40 text-xs text-[#9AA6BC] hover:text-[#F7F7F2] transition group disabled:opacity-50"
              >
                <div className="flex items-center justify-between text-[10px] text-[#5B6B82] mb-1">
                  <span>{idx === 2 ? 'Clarification Test' : `Example ${idx + 1}`}</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:text-[#CCFF00] transition-transform" />
                </div>
                <p className="line-clamp-2">{prompt}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Informative footer note */}
        <div className="mt-5 flex items-center gap-2 text-xs text-[#5B6B82]">
          <Info className="w-3.5 h-3.5 text-[#8B5CF6]" />
          <span>Natural conversation active: Pause briefly while thinking (~3s pause tolerance). Duplicates protected.</span>
        </div>
      </div>
    </div>
  );
}
