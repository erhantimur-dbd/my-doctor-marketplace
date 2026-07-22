"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Mic, MicOff, Loader2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGrokStt } from "@/hooks/use-grok-stt";
import { useTts } from "@/hooks/use-tts";
import { VoicePrivacyNotice } from "@/components/voice/voice-privacy-notice";
import {
  VOICE_PRIVACY_STORAGE_KEY,
  buildVoicePrivacyConsent,
  hasAcceptedVoicePrivacy,
  serializeVoicePrivacyConsent,
} from "@/lib/voice/privacy";
import { toast } from "sonner";

/**
 * Floating mic on primary patient pages.
 * Records via MediaRecorder → Grok Voice STT → navigates to doctor search with q=.
 * Optional Grok TTS readback of the transcript. Never auto-books.
 */
export function FloatingMic() {
  const t = useTranslations("voice");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
  const [lastText, setLastText] = useState("");
  const tts = useTts({ locale });

  // Hide only on auth / staff shells (exact segments — not "/register-doctor")
  const hide =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname?.startsWith("/login/") ||
    pathname?.startsWith("/register/") ||
    pathname?.startsWith("/doctor-dashboard") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/verify-");

  const stt = useGrokStt({
    locale,
    onResult: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setLastText(trimmed);
      // Find a Doctor uses ?query= (not q) — always land on search results.
      // Preserve existing filters when already on /doctors.
      const params = new URLSearchParams(
        typeof window !== "undefined" &&
          (pathname === "/doctors" || pathname?.startsWith("/doctors"))
          ? window.location.search
          : ""
      );
      params.delete("page");
      params.set("query", trimmed);
      const qs = params.toString();
      router.push(`/doctors?${qs}`);
      // TTS is opt-in via the speaker button (lastText), not auto-play
    },
    onError: (code) => {
      if (code === "not-allowed") toast.error(t("error_permission"));
      else if (code === "not-supported") toast.error(t("error_unsupported"));
      else toast.error(t("error_stt"));
    },
  });

  useEffect(() => {
    if (tts.error) toast.error(t("error_tts"));
  }, [tts.error, t]);

  const ensurePrivacyThen = useCallback(
    (action: () => void) => {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem(VOICE_PRIVACY_STORAGE_KEY);
        if (hasAcceptedVoicePrivacy(raw)) {
          action();
          return;
        }
      } catch {
        // private mode / blocked storage — still show notice once per session
      }
      setPendingStart(true);
      setShowPrivacy(true);
    },
    []
  );

  const handleAcceptPrivacy = () => {
    try {
      const consent = buildVoicePrivacyConsent(true);
      localStorage.setItem(
        VOICE_PRIVACY_STORAGE_KEY,
        serializeVoicePrivacyConsent(consent)
      );
    } catch {
      // ignore storage failures; still proceed this session
    }
    setShowPrivacy(false);
    if (pendingStart) {
      setPendingStart(false);
      toast.message(t("mic_listening"));
      void stt.start();
    }
  };

  const handleDeclinePrivacy = () => {
    setShowPrivacy(false);
    setPendingStart(false);
  };

  const handleMicClick = () => {
    if (stt.isRecording) {
      stt.stop();
      toast.message(t("mic_processing"));
      return;
    }
    if (stt.isProcessing) return;
    if (!stt.isSupported) {
      toast.error(t("error_unsupported"));
      return;
    }
    ensurePrivacyThen(() => {
      toast.message(t("mic_listening"));
      void stt.start();
    });
  };

  const handleTts = () => {
    if (tts.isPlaying) {
      tts.stop();
      return;
    }
    if (lastText) {
      ensurePrivacyThen(() => {
        void tts.speak(lastText);
      });
    }
  };

  if (hide) return null;

  return (
    <>
      {showPrivacy && (
        <VoicePrivacyNotice
          onAccept={handleAcceptPrivacy}
          onDecline={handleDeclinePrivacy}
        />
      )}
      {/*
        Placement notes:
        - Chat launcher owns bottom-right (z 9998).
        - Cookie banner is full-width bottom at z 9999 — sit above it (z 10050)
          and lift off the bottom edge so it is not covered.
        - Primary targets: homepage + /doctors (soft-launch allowlisted).
      */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[10050] flex justify-start p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-5"
        data-testid="floating-mic"
      >
        <div className="pointer-events-auto flex flex-col items-start gap-2">
          {lastText && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-12 w-12 rounded-full border border-border bg-background shadow-xl"
              onClick={handleTts}
              aria-label={tts.isPlaying ? t("tts_stop") : t("tts_play")}
              title={tts.isPlaying ? t("tts_stop") : t("tts_play")}
            >
              {tts.isPlaying ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            className={cn(
              "h-14 w-14 rounded-full border-2 border-white bg-primary text-primary-foreground shadow-[0_8px_28px_-6px_rgba(2,132,199,0.65)] ring-2 ring-primary/30",
              stt.isRecording &&
                "border-destructive bg-destructive ring-destructive/40 hover:bg-destructive/90"
            )}
            onClick={handleMicClick}
            aria-label={
              stt.isRecording
                ? t("mic_listening")
                : stt.isProcessing
                  ? t("mic_processing")
                  : t("mic_label")
            }
            title={
              stt.isRecording
                ? t("mic_listening")
                : stt.isProcessing
                  ? t("mic_processing")
                  : t("mic_speak")
            }
            disabled={stt.isProcessing}
          >
            {stt.isProcessing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : stt.isRecording ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
