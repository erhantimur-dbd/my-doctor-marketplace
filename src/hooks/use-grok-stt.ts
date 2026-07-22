"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GrokSttStatus =
  | "idle"
  | "recording"
  | "processing"
  | "error";

interface UseGrokSttOptions {
  locale?: string;
  onResult?: (text: string) => void;
  onError?: (code: string) => void;
  /** Max recording length in ms (default 15s) */
  maxMs?: number;
}

interface UseGrokSttReturn {
  isSupported: boolean;
  status: GrokSttStatus;
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * MediaRecorder → POST /api/voice/stt (Grok Voice / xAI STT).
 * Audio never stored client-side after upload (recorder tracks discarded).
 */
export function useGrokStt(
  options: UseGrokSttOptions = {}
): UseGrokSttReturn {
  const { locale = "en", onResult, onError, maxMs = 15000 } = options;
  const [isSupported, setIsSupported] = useState(false);
  const [status, setStatus] = useState<GrokSttStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  const cleanupStream = useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setStatus("processing");
      try {
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        form.append("locale", locale);
        const res = await fetch("/api/voice/stt", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const code = res.status === 503 ? "not-configured" : "stt-failed";
          setError(code);
          setStatus("error");
          onErrorRef.current?.(code);
          return;
        }
        const data = (await res.json()) as { text?: string };
        const text = (data.text || "").trim();
        setTranscript(text);
        setStatus("idle");
        if (text) onResultRef.current?.(text);
      } catch {
        setError("stt-failed");
        setStatus("error");
        onErrorRef.current?.("stt-failed");
      }
    },
    [locale]
  );

  const stop = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    } else {
      cleanupStream();
      setStatus("idle");
    }
  }, [cleanupStream]);

  const start = useCallback(async () => {
    if (!isSupported) {
      setError("not-supported");
      setStatus("error");
      onErrorRef.current?.("not-supported");
      return;
    }

    setError(null);
    setTranscript("");
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Prefer webm; fall back for Safari (often mp4 / no explicit type)
      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
      ];
      const mime =
        mimeCandidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";

      let recorder: MediaRecorder;
      try {
        recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        setError("stt-failed");
        setStatus("error");
        onErrorRef.current?.("stt-failed");
        cleanupStream();
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mime || "audio/webm",
        });
        cleanupStream();
        if (blob.size === 0) {
          setError("no-speech");
          setStatus("error");
          onErrorRef.current?.("no-speech");
          return;
        }
        await transcribe(blob);
      };

      // Some browsers require timeslice; others only emit data on stop
      try {
        recorder.start(250);
      } catch {
        recorder.start();
      }
      setStatus("recording");
      maxTimerRef.current = setTimeout(() => stop(), maxMs);
    } catch {
      setError("not-allowed");
      setStatus("error");
      onErrorRef.current?.("not-allowed");
      cleanupStream();
    }
  }, [isSupported, maxMs, stop, transcribe, cleanupStream]);

  return {
    isSupported,
    status,
    isRecording: status === "recording",
    isProcessing: status === "processing",
    transcript,
    error,
    start,
    stop,
  };
}

/** @deprecated Use useGrokStt */
export const useWhisperStt = useGrokStt;
