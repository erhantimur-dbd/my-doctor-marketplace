"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Loader2, Mic, MicOff, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useGrokStt } from "@/hooks/use-grok-stt";
import {
  VOICE_PRIVACY_STORAGE_KEY,
  buildVoicePrivacyConsent,
  hasAcceptedVoicePrivacy,
  serializeVoicePrivacyConsent,
} from "@/lib/voice/privacy";
import { VoicePrivacyNotice } from "@/components/voice/voice-privacy-notice";
import { toast } from "sonner";

interface ChatComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  /** When true, start listening as soon as mounted (e.g. floating mic → chat) */
  autoStartVoice?: boolean;
  onAutoStartVoiceConsumed?: () => void;
  /** Fired when user begins a voice session (privacy accepted / listen start) */
  onVoiceSessionStart?: () => void;
}

export function ChatComposer({
  onSend,
  disabled,
  autoStartVoice,
  onAutoStartVoiceConsumed,
  onVoiceSessionStart,
}: ChatComposerProps) {
  const t = useTranslations("chat.composer");
  const tVoice = useTranslations("voice");
  const locale = useLocale();
  const [value, setValue] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stt = useGrokStt({
    locale,
    onResult: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setValue(trimmed);
      // Auto-send spoken turns into the same chat pipeline
      if (!disabled) {
        onSend(trimmed);
        setValue("");
      }
    },
    onError: (code) => {
      if (code === "not-allowed") toast.error(tVoice("error_permission"));
      else if (code === "not-supported")
        toast.error(tVoice("error_unsupported"));
      else if (code === "no-speech") toast.error(t("voice_no_speech"));
      else toast.error(tVoice("error_stt"));
    },
  });

  const startVoice = useCallback(() => {
    if (disabled || stt.isProcessing) return;
    onVoiceSessionStart?.();
    try {
      const raw = localStorage.getItem(VOICE_PRIVACY_STORAGE_KEY);
      if (hasAcceptedVoicePrivacy(raw)) {
        toast.message(tVoice("mic_listening"));
        void stt.start();
        return;
      }
    } catch {
      // fall through to privacy
    }
    setShowPrivacy(true);
  }, [disabled, stt, tVoice, onVoiceSessionStart]);

  useEffect(() => {
    if (!autoStartVoice) return;
    onAutoStartVoiceConsumed?.();
    // slight delay so panel is visible
    const id = window.setTimeout(() => startVoice(), 300);
    return () => clearTimeout(id);
  }, [autoStartVoice, onAutoStartVoiceConsumed, startVoice]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleMicClick = () => {
    if (stt.isRecording) {
      stt.stop();
      toast.message(tVoice("mic_processing"));
      return;
    }
    startVoice();
  };

  return (
    <>
      {showPrivacy && (
        <VoicePrivacyNotice
          onAccept={() => {
            try {
              localStorage.setItem(
                VOICE_PRIVACY_STORAGE_KEY,
                serializeVoicePrivacyConsent(buildVoicePrivacyConsent(true))
              );
            } catch {
              /* ignore */
            }
            setShowPrivacy(false);
            toast.message(tVoice("mic_listening"));
            void stt.start();
          }}
          onDecline={() => setShowPrivacy(false)}
        />
      )}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border bg-background px-2.5 py-2"
      >
        <button
          type="button"
          onClick={handleMicClick}
          disabled={disabled || stt.isProcessing}
          aria-label={
            stt.isRecording
              ? tVoice("mic_listening")
              : t("voice_input")
          }
          title={
            stt.isRecording
              ? tVoice("mic_listening")
              : t("voice_input")
          }
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
            stt.isRecording
              ? "bg-destructive text-destructive-foreground"
              : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary",
            (disabled || stt.isProcessing) && "opacity-60"
          )}
        >
          {stt.isProcessing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : stt.isRecording ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          {stt.isRecording && (
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/30" />
          )}
        </button>
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={
              stt.isRecording
                ? tVoice("mic_listening")
                : t("placeholder")
            }
            rows={1}
            disabled={disabled || stt.isRecording}
            style={{ minHeight: "36px" }}
            className={cn(
              "block w-full resize-none rounded-full border border-border bg-muted/40 px-3.5 py-1.5 text-[13px] leading-[22px]",
              "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !value.trim() || stt.isRecording}
          aria-label={t("send")}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-full transition-colors",
            value.trim() && !disabled && !stt.isRecording
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </>
  );
}
