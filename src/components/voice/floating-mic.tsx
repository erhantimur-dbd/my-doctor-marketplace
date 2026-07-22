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

  // Hide on doctor dashboard / admin (patient-facing only)
  const hide =
    pathname?.includes("/doctor-dashboard") ||
    pathname?.includes("/admin") ||
    pathname?.includes("/login") ||
    pathname?.includes("/register");

  const stt = useGrokStt({
    locale,
    onResult: (text) => {
      setLastText(text);
      // Navigate to search — user still picks a doctor and confirms booking
      const q = encodeURIComponent(text);
      router.push(`/doctors?q=${q}`);
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
      const raw = localStorage.getItem(VOICE_PRIVACY_STORAGE_KEY);
      if (hasAcceptedVoicePrivacy(raw)) {
        action();
        return;
      }
      setPendingStart(true);
      setShowPrivacy(true);
    },
    []
  );

  const handleAcceptPrivacy = () => {
    const consent = buildVoicePrivacyConsent(true);
    localStorage.setItem(
      VOICE_PRIVACY_STORAGE_KEY,
      serializeVoicePrivacyConsent(consent)
    );
    setShowPrivacy(false);
    if (pendingStart) {
      setPendingStart(false);
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
      return;
    }
    if (stt.isProcessing) return;
    ensurePrivacyThen(() => {
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
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6">
        {lastText && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-11 w-11 rounded-full shadow-md"
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
            "h-14 w-14 rounded-full shadow-lg",
            stt.isRecording && "bg-destructive hover:bg-destructive/90"
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
    </>
  );
}
