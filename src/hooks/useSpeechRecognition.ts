import { useState, useCallback, useRef, useEffect } from 'react';

/** Speech recognition status */
export type SpeechStatus = 'idle' | 'listening' | 'error' | 'unsupported';

/** Speech recognition event callback types */
interface SpeechCallbacks {
  onInterimResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onError?: (error: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionType = any;

/**
 * Custom hook for Web Speech API SpeechRecognition
 * Handles browser compatibility, interim/final results, and cleanup
 */
export function useSpeechRecognition(speechCode: string, callbacks: SpeechCallbacks) {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionType>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      setStatus('unsupported');
    }
  }, []);

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      setStatus('unsupported');
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_e) { /* ignore */ }
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = speechCode || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus('listening');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        callbacksRef.current.onInterimResult?.(interimTranscript);
      }

      if (finalTranscript) {
        callbacksRef.current.onFinalResult?.(finalTranscript);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error('[SpeechHandler] Error:', event.error);
      if (event.error !== 'aborted') {
        setStatus('error');
        callbacksRef.current.onError?.(event.error);
      }
    };

    recognition.onend = () => {
      setStatus('idle');
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error('[SpeechHandler] Start error:', err);
      setStatus('error');
    }
  }, [speechCode]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_e) { /* ignore */ }
    }
    setStatus('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_e) { /* ignore */ }
      }
    };
  }, []);

  return { status, isSupported, startListening, stopListening };
}
