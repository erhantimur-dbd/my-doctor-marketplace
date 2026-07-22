"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Play OpenAI TTS for a text string via /api/voice/tts.
 * Audio is streamed to memory and not persisted.
 */
export function useTts() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      stop();
      setError(null);
      try {
        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed.slice(0, 2000) }),
        });
        if (!res.ok) {
          setError("tts-failed");
          return;
        }
        const buf = await res.arrayBuffer();
        const blob = new Blob([buf], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          stop();
        };
        audio.onerror = () => {
          setError("tts-failed");
          stop();
        };
        setIsPlaying(true);
        await audio.play();
      } catch {
        setError("tts-failed");
        stop();
      }
    },
    [stop]
  );

  return { speak, stop, isPlaying, error };
}
