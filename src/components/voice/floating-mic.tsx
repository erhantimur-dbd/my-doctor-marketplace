"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat-store";

/**
 * Shortcut FAB: opens the AI chat widget in voice mode (same conversation
 * as text chat). Primary voice UX lives in ChatComposer + spoken replies.
 */
export function FloatingMic() {
  const t = useTranslations("voice");
  const pathname = usePathname();
  const openWithVoice = useChatStore((s) => s.openWithVoice);
  const isOpen = useChatStore((s) => s.isOpen);

  const hide =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname?.startsWith("/login/") ||
    pathname?.startsWith("/register/") ||
    pathname?.startsWith("/doctor-dashboard") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/verify-") ||
    isOpen;

  if (hide) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[10050] flex justify-start p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-5"
      data-testid="floating-mic"
    >
      <Button
        type="button"
        size="icon"
        className="pointer-events-auto h-14 w-14 rounded-full border-2 border-white bg-primary text-primary-foreground shadow-[0_8px_28px_-6px_rgba(2,132,199,0.65)] ring-2 ring-primary/30"
        onClick={() => openWithVoice()}
        aria-label={t("mic_label")}
        title={t("mic_speak")}
      >
        <Mic className="h-6 w-6" />
      </Button>
    </div>
  );
}
