"use client";

import { motion } from "framer-motion";
import { ChevronRight, Mic, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";

interface ChatLauncherProps {
  onOpen: () => void;
  /** Opens the same widget and starts the Grok voice session + welcome */
  onOpenVoice?: () => void;
}

/**
 * Closed-state floating launcher — single patient AI entry (chat + voice).
 *
 * Mobile: one FAB, voice-first (opens same widget in listen mode).
 * Desktop: gradient card with chat CTA + mic.
 */
export function ChatLauncher({ onOpen, onOpenVoice }: ChatLauncherProps) {
  const t = useTranslations("chat.launcher");

  /** Mobile: prefer voice-first open when available */
  const handleMobileOpen = () => {
    if (onOpenVoice) onOpenVoice();
    else onOpen();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4"
      style={{ zIndex: 9998 }}
      data-testid="unified-ai-launcher"
    >
      <style>{`
        .chat-launcher-mobile { display: block; }
        .chat-launcher-desktop { display: none; }
        @media (min-width: 640px) {
          .chat-launcher-mobile { display: none; }
          .chat-launcher-desktop { display: block; }
        }
      `}</style>

      {/* ── Mobile: single voice-first FAB ── */}
      <div className="chat-launcher-mobile">
        <button
          type="button"
          onClick={handleMobileOpen}
          aria-label={onOpenVoice ? t("open_voice") : t("open")}
          title={onOpenVoice ? t("open_voice") : t("open")}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          data-testid="mobile-ai-fab"
        >
          {/* Soft glow only (no stacked pulse rings) */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-full bg-primary/25 blur-md"
          />
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-600"
            style={{
              boxShadow:
                "0 0 0 2.5px rgba(255,255,255,0.7), 0 12px 28px -8px rgba(8,145,178,0.55)",
            }}
          >
            <Logo className="h-7 w-7 text-white" />
          </div>
          {/* Mic badge — signals voice-first without a second FAB */}
          <span
            aria-hidden
            className="absolute -bottom-0.5 -left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-primary shadow-md ring-2 ring-primary/20"
          >
            <Mic className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          {/* Online status */}
          <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center">
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-white" />
          </span>
        </button>
      </div>

      {/* ── Desktop: full gradient card (chat + voice open same widget) ── */}
      <div className="chat-launcher-desktop">
        <div
          style={{
            width: "290px",
            boxShadow:
              "0 20px 45px -12px rgba(8, 145, 178, 0.45), 0 8px 20px -8px rgba(14, 165, 233, 0.35)",
          }}
          className="group relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-teal-600 p-4 text-left text-white ring-1 ring-white/20 transition-all duration-300 hover:-translate-y-1 hover:ring-white/30"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/15 blur-2xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -left-6 h-20 w-20 rounded-full bg-cyan-300/20 blur-2xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          />

          <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-all group-hover:translate-x-0.5 group-hover:bg-white/25">
            <ChevronRight className="h-3.5 w-3.5" />
          </span>

          <div className="relative flex items-start gap-3 pr-8">
            <div className="relative shrink-0">
              <span
                aria-hidden
                className="absolute inset-0 animate-ping rounded-full bg-white/30 opacity-60"
              />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-white/60">
                <Logo className="h-7 w-7 text-primary" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
                <span
                  aria-hidden
                  className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
                />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white" />
              </span>
            </div>

            <div className="flex-1 pt-0.5">
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-200" />
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/85">
                  {t("eyebrow")}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] font-bold leading-snug">
                {t("tagline_voice")}
              </p>
            </div>
          </div>

          <div className="relative mt-3.5 flex w-full gap-2">
            <button
              type="button"
              onClick={onOpen}
              aria-label={t("open")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-center text-[13px] font-semibold text-primary shadow-md transition-all hover:shadow-lg"
            >
              {t("cta")}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {onOpenVoice && (
              <button
                type="button"
                onClick={onOpenVoice}
                aria-label={t("open_voice")}
                title={t("open_voice")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white ring-1 ring-white/40 backdrop-blur hover:bg-white/30"
              >
                <Mic className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
