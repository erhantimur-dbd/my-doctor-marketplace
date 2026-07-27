"use client";

import { Loader2, Mic, MicOff, PhoneOff, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { LiveVoiceStatus } from "@/hooks/use-grok-realtime-voice";

interface LiveVoiceBarProps {
  status: LiveVoiceStatus;
  isMuted: boolean;
  captions: { role: "user" | "assistant"; text: string } | null;
  onMuteToggle: () => void;
  onEnd: () => void;
}

export function LiveVoiceBar({
  status,
  isMuted,
  captions,
  onMuteToggle,
  onEnd,
}: LiveVoiceBarProps) {
  const t = useTranslations("voice.live");

  const statusLabel =
    status === "connecting"
      ? t("connecting")
      : status === "speaking"
        ? t("speaking")
        : status === "thinking"
          ? t("thinking")
          : status === "listening"
            ? t("listening")
            : status === "error"
              ? t("error")
              : t("live");

  return (
    <div className="border-t border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-teal-500/10 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {status === "connecting" || status === "thinking" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Radio className="h-4 w-4" />
          )}
          {(status === "listening" || status === "speaking") && (
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full bg-primary/40"
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-foreground">
            {statusLabel}
          </p>
          {captions?.text ? (
            <p className="truncate text-[11px] text-muted-foreground">
              <span className="font-medium">
                {captions.role === "user" ? t("you") : t("assistant")}:
              </span>{" "}
              {captions.text}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">{t("hint")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onMuteToggle}
          aria-label={isMuted ? t("unmute") : t("mute")}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
            isMuted
              ? "bg-amber-500 text-white"
              : "bg-background text-foreground ring-1 ring-border hover:bg-muted"
          )}
        >
          {isMuted ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onEnd}
          aria-label={t("end")}
          className="flex h-9 items-center gap-1.5 rounded-full bg-red-500 px-3 text-[12px] font-semibold text-white hover:bg-red-600"
        >
          <PhoneOff className="h-3.5 w-3.5" />
          {t("end")}
        </button>
      </div>
    </div>
  );
}
