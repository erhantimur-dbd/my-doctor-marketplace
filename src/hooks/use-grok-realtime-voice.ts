"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import type { DoctorsSearchFilters } from "@/lib/voice/search-url";

export type LiveVoiceStatus =
  | "idle"
  | "connecting"
  | "live"
  | "listening"
  | "speaking"
  | "thinking"
  | "error";

export type LiveToolResultEvent = {
  name: string;
  callId: string;
  result: unknown;
};

interface SessionPayload {
  token: string;
  model: string;
  voice: string;
  instructions: string;
  tools: unknown[];
  locale: string;
  languageHint: string;
  wsUrl: string;
}

interface UseGrokRealtimeVoiceOptions {
  locale: string;
  getCurrentFilters?: () => DoctorsSearchFilters;
  /** Append tool result to chat UI immediately */
  onToolResult?: (event: LiveToolResultEvent) => void;
  /** User / assistant transcript lines for captions */
  onUserTranscript?: (text: string, final: boolean) => void;
  onAssistantTranscript?: (text: string, final: boolean) => void;
  onStatusChange?: (status: LiveVoiceStatus) => void;
  onError?: (code: string) => void;
}

interface UseGrokRealtimeVoiceReturn {
  status: LiveVoiceStatus;
  isLive: boolean;
  isMuted: boolean;
  error: string | null;
  captions: { role: "user" | "assistant"; text: string } | null;
  start: (opts?: { welcomeText?: string }) => Promise<void>;
  stop: () => void;
  setMuted: (muted: boolean) => void;
}

const SAMPLE_RATE = 24000;

function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

/**
 * Grok Speech-to-Speech Realtime client.
 * Browser connects to xAI with an ephemeral token; tools run via /api/voice/tools.
 */
export function useGrokRealtimeVoice(
  options: UseGrokRealtimeVoiceOptions
): UseGrokRealtimeVoiceReturn {
  const {
    locale,
    getCurrentFilters,
    onToolResult,
    onUserTranscript,
    onAssistantTranscript,
    onStatusChange,
    onError,
  } = options;

  const [status, setStatus] = useState<LiveVoiceStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captions, setCaptions] = useState<{
    role: "user" | "assistant";
    text: string;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playQueueRef = useRef<Float32Array[]>([]);
  const playingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const mutedRef = useRef(false);
  const statusRef = useRef<LiveVoiceStatus>("idle");
  const pendingToolCallsRef = useRef(0);
  const playbackCompleteResolversRef = useRef<Array<() => void>>([]);

  const onToolResultRef = useRef(onToolResult);
  const onUserTranscriptRef = useRef(onUserTranscript);
  const onAssistantTranscriptRef = useRef(onAssistantTranscript);
  const onStatusChangeRef = useRef(onStatusChange);
  const onErrorRef = useRef(onError);
  const getCurrentFiltersRef = useRef(getCurrentFilters);
  onToolResultRef.current = onToolResult;
  onUserTranscriptRef.current = onUserTranscript;
  onAssistantTranscriptRef.current = onAssistantTranscript;
  onStatusChangeRef.current = onStatusChange;
  onErrorRef.current = onError;
  getCurrentFiltersRef.current = getCurrentFilters;

  const updateStatus = useCallback((s: LiveVoiceStatus) => {
    statusRef.current = s;
    setStatus(s);
    onStatusChangeRef.current?.(s);
  }, []);

  const stopPlayback = useCallback(() => {
    playQueueRef.current = [];
    playingRef.current = false;
    nextPlayTimeRef.current = 0;
    playbackCompleteResolversRef.current.forEach((r) => r());
    playbackCompleteResolversRef.current = [];
  }, []);

  const waitForPlaybackComplete = useCallback((): Promise<void> => {
    if (!playingRef.current && playQueueRef.current.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      playbackCompleteResolversRef.current.push(resolve);
      // Safety timeout so tools never hang forever
      setTimeout(resolve, 12_000);
    });
  }, []);

  const schedulePlay = useCallback((samples: Float32Array) => {
    const ctx = audioCtxRef.current;
    if (!ctx || samples.length === 0) return;

    const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    // Copy into a fresh ArrayBuffer-backed view (TS DOM lib is strict on generics)
    const channel = new Float32Array(samples.length);
    channel.set(samples);
    buffer.copyToChannel(channel, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.02, nextPlayTimeRef.current || now);
    src.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;
    playingRef.current = true;

    src.onended = () => {
      // If nothing more scheduled soon, mark idle
      if (nextPlayTimeRef.current <= ctx.currentTime + 0.05) {
        playingRef.current = false;
        const resolvers = playbackCompleteResolversRef.current;
        playbackCompleteResolversRef.current = [];
        resolvers.forEach((r) => r());
        if (statusRef.current === "speaking" && pendingToolCallsRef.current === 0) {
          updateStatus("listening");
        }
      }
    };
  }, [updateStatus]);

  const handleFunctionCall = useCallback(
    async (event: {
      name?: string;
      call_id?: string;
      arguments?: string;
    }) => {
      const name = event.name || "";
      const callId = event.call_id || `call-${Date.now()}`;
      const argsRaw = event.arguments || "{}";
      pendingToolCallsRef.current += 1;
      updateStatus("thinking");

      let result: unknown = { ok: false, error: "tool failed" };
      try {
        const res = await fetch("/api/voice/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            arguments: argsRaw,
            locale,
            currentFilters: getCurrentFiltersRef.current?.(),
          }),
        });
        const data = (await res.json()) as {
          result?: unknown;
          error?: string;
        };
        result = data.result ?? { ok: false, error: data.error || "failed" };
      } catch {
        result = { ok: false, error: "network" };
      }

      onToolResultRef.current?.({ name, callId, result });

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: callId,
              output: JSON.stringify(result),
            },
          })
        );
      }

      pendingToolCallsRef.current = Math.max(0, pendingToolCallsRef.current - 1);

      // Wait for any in-flight speech, then continue (xAI best practice)
      if (pendingToolCallsRef.current === 0) {
        await waitForPlaybackComplete();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "response.create" }));
        }
      }
    },
    [locale, updateStatus, waitForPlaybackComplete]
  );

  const handleServerEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = String(event.type || "");

      switch (type) {
        case "session.updated":
        case "session.created":
          if (statusRef.current === "connecting") updateStatus("live");
          break;

        case "input_audio_buffer.speech_started":
          stopPlayback(); // barge-in
          updateStatus("listening");
          break;

        case "input_audio_buffer.speech_stopped":
          updateStatus("thinking");
          break;

        case "conversation.item.input_audio_transcription.delta": {
          const delta = String(event.delta || "");
          if (delta) {
            setCaptions({ role: "user", text: delta });
            onUserTranscriptRef.current?.(delta, false);
          }
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          const text = String(
            (event as { transcript?: string }).transcript || ""
          );
          if (text) {
            setCaptions({ role: "user", text });
            onUserTranscriptRef.current?.(text, true);
          }
          break;
        }

        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta": {
          const delta = String(event.delta || "");
          if (delta) {
            setCaptions((prev) => ({
              role: "assistant",
              text: (prev?.role === "assistant" ? prev.text : "") + delta,
            }));
            onAssistantTranscriptRef.current?.(delta, false);
          }
          break;
        }
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done": {
          const text = String(
            (event as { transcript?: string }).transcript ||
              captions?.text ||
              ""
          );
          if (text) onAssistantTranscriptRef.current?.(text, true);
          break;
        }

        case "response.output_audio.delta":
        case "response.audio.delta": {
          updateStatus("speaking");
          const b64 = String(event.delta || "");
          if (!b64) break;
          const int16 = base64ToInt16(b64);
          const float32 = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768;
          }
          schedulePlay(float32);
          break;
        }

        case "response.function_call_arguments.done":
          void handleFunctionCall(
            event as { name?: string; call_id?: string; arguments?: string }
          );
          break;

        case "response.done":
          if (pendingToolCallsRef.current === 0 && !playingRef.current) {
            updateStatus("listening");
          }
          break;

        case "error": {
          const msg =
            (event as { error?: { message?: string }; message?: string })
              .error?.message ||
            (event as { message?: string }).message ||
            "realtime-error";
          setError(msg);
          onErrorRef.current?.(msg);
          break;
        }

        default:
          break;
      }
    },
    [captions?.text, handleFunctionCall, schedulePlay, stopPlayback, updateStatus]
  );

  const cleanupMedia = useCallback(() => {
    try {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    processorRef.current = null;
    sourceRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    wsRef.current = null;
    stopPlayback();
    cleanupMedia();
    updateStatus("idle");
    setCaptions(null);
  }, [cleanupMedia, stopPlayback, updateStatus]);

  const start = useCallback(async (opts?: { welcomeText?: string }) => {
    if (
      statusRef.current === "connecting" ||
      statusRef.current === "live" ||
      statusRef.current === "listening" ||
      statusRef.current === "speaking" ||
      statusRef.current === "thinking"
    ) {
      return;
    }
    setError(null);
    updateStatus("connecting");
    const welcomeText =
      opts?.welcomeText?.trim() ||
      "Hi, I'm your MyDoctors360 assistant. Tell me the specialty or city you're looking for, and I'll find private doctors for you.";

    // Must create AudioContext in user gesture
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx({ sampleRate: SAMPLE_RATE });
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    let session: SessionPayload;
    try {
      const res = await fetch("/api/voice/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        const code = res.status === 503 ? "not-configured" : "session-failed";
        setError(code);
        onErrorRef.current?.(code);
        updateStatus("error");
        cleanupMedia();
        return;
      }
      session = (await res.json()) as SessionPayload;
    } catch {
      setError("network");
      onErrorRef.current?.("network");
      updateStatus("error");
      cleanupMedia();
      return;
    }

    // Mic
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: SAMPLE_RATE,
        },
      });
      mediaStreamRef.current = stream;
    } catch {
      setError("not-allowed");
      onErrorRef.current?.("not-allowed");
      updateStatus("error");
      cleanupMedia();
      return;
    }

    // WebSocket — browser auth via protocol subprotocol
    const ws = new WebSocket(session.wsUrl, [
      `xai-client-secret.${session.token}`,
    ]);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            voice: session.voice || "eve",
            instructions: session.instructions,
            tools: session.tools,
            turn_detection: {
              type: "server_vad",
              threshold: 0.85,
              silence_duration_ms: 900,
              prefix_padding_ms: 300,
              idle_timeout_ms: 12_000,
            },
            audio: {
              input: {
                format: { type: "audio/pcm", rate: SAMPLE_RATE },
                transcription: {
                  language_hint: session.languageHint || "en",
                  keyterms: [
                    "MyDoctors360",
                    "dermatologist",
                    "cardiologist",
                    "video consultation",
                  ],
                },
              },
              output: {
                format: { type: "audio/pcm", rate: SAMPLE_RATE },
              },
            },
          },
        })
      );

      // Stream mic → WS
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        if (mutedRef.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        // Resample if browser context rate differs
        let samples = input;
        if (ctx.sampleRate !== SAMPLE_RATE) {
          const ratio = SAMPLE_RATE / ctx.sampleRate;
          const outLen = Math.floor(input.length * ratio);
          const out = new Float32Array(outLen);
          for (let i = 0; i < outLen; i++) {
            out[i] = input[Math.min(input.length - 1, Math.floor(i / ratio))];
          }
          samples = out;
        }
        const pcm = floatTo16BitPCM(samples);
        const b64 = arrayBufferToBase64(pcm);
        wsRef.current.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: b64,
          })
        );
      };
      source.connect(processor);
      // Keep the graph alive without feeding mic into speakers (echo)
      const silent = ctx.createGain();
      silent.gain.value = 0;
      processor.connect(silent);
      silent.connect(ctx.destination);

      // Welcome turn — agent greets without waiting for user
      ws.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "force_message",
            role: "assistant",
            interruptible: true,
            content: [
              {
                type: "output_text",
                text: welcomeText,
              },
            ],
          },
        })
      );

      updateStatus("live");
    };

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(
          typeof msg.data === "string" ? msg.data : ""
        ) as Record<string, unknown>;
        handleServerEvent(event);
      } catch {
        /* ignore non-json */
      }
    };

    ws.onerror = () => {
      setError("ws-error");
      onErrorRef.current?.("ws-error");
    };

    ws.onclose = () => {
      if (statusRef.current !== "idle") {
        cleanupMedia();
        updateStatus("idle");
      }
    };
  }, [
    locale,
    cleanupMedia,
    handleServerEvent,
    updateStatus,
  ]);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    setIsMuted(muted);
    mediaStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLive =
    status === "live" ||
    status === "listening" ||
    status === "speaking" ||
    status === "thinking";

  return {
    status,
    isLive,
    isMuted,
    error,
    captions,
    start,
    stop,
    setMuted,
  };
}

/** Build a UIMessage with a tool output part for live card rendering */
export function buildLiveToolMessage(
  toolName: string,
  callId: string,
  output: unknown
): UIMessage {
  return {
    id: `live-${callId}`,
    role: "assistant",
    parts: [
      {
        type: `tool-${toolName}`,
        toolCallId: callId,
        state: "output-available",
        output,
      } as UIMessage["parts"][number],
    ],
  };
}

export function buildLiveTextMessage(
  role: "user" | "assistant",
  text: string,
  id?: string
): UIMessage {
  return {
    id: id || `live-text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    parts: [{ type: "text", text }],
  };
}
