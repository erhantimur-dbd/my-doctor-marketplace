"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/** Map next-intl locale to BCP-47 language tag for SpeechRecognition */
const LOCALE_TO_LANG: Record<string, string> = {
  en: "en-GB",
  de: "de-DE",
  tr: "tr-TR",
  fr: "fr-FR",
};

interface UseSpeechRecognitionOptions {
  /** next-intl locale string (e.g. "en", "de") */
  locale?: string;
  /** Called with the final transcript text */
  onResult?: (text: string) => void;
  /** Called when recognition ends (after result or error) */
  onEnd?: () => void;
}

interface UseSpeechRecognitionReturn {
  /** Whether the browser supports speech recognition */
  isSupported: boolean;
  /** Whether the mic is currently active */
  isListening: boolean;
  /** Live transcript (interim + final) */
  transcript: string;
  /** Start listening */
  start: () => void;
  /** Stop listening */
  stop: () => void;
  /** Last error message, if any */
  error: string | null;
}

// Web Speech API types (not included in default TS libs for all targets)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { locale = "en", onResult, onEnd } = options;

  const [isSupported] = useState(() => !!getSpeechRecognition());
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep latest callbacks in refs so we don't recreate the recognition instance
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  onResultRef.current = onResult;
  onEndRef.current = onEnd;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const stop = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore — may already be stopped
      }
    }
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setError("not-supported");
      return;
    }

    // If already listening, stop first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    setError(null);
    setTranscript("");

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = LOCALE_TO_LANG[locale] || "en-GB";
    recognition.continuous = false; // Single utterance mode
    recognition.interimResults = true; // Show real-time partial results
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      // Reset silence timer on each new result
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      let interim = "";
      let final = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      const text = final || interim;
      setTranscript(text);

      if (final) {
        // Final result received — deliver it
        onResultRef.current?.(final.trim());
      } else {
        // Set a 750ms silence timeout as iOS Safari fallback
        // (iOS often never sets isFinal to true)
        silenceTimerRef.current = setTimeout(() => {
          if (interim.trim()) {
            onResultRef.current?.(interim.trim());
          }
          try {
            recognition.stop();
          } catch {
            // ignore
          }
        }, 750);
      }
    };

    recognition.onerror = (event) => {
      const code = event.error;
      // "aborted" is expected when we call stop() — not a real error
      if (code === "aborted") return;
      setError(code); // "not-allowed", "no-speech", "network", etc.
      setIsListening(false);
    };

    recognition.onend = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setIsListening(false);
      recognitionRef.current = null;
      onEndRef.current?.();
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      // Can throw if already started or permission issue
      setError("start-failed");
      setIsListening(false);
    }
  }, [locale]);

  return { isSupported, isListening, transcript, start, stop, error };
}
