"use client";

import { motion } from "framer-motion";
import { ChevronRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";

interface ChatLauncherProps {
  onOpen: () => void;
}

/**
 * Closed-state floating launcher shown in the bottom-right corner of every
 * public page.
 *
 * Mobile (<640px): compact 56×56 pulsing logo circle with green online dot.
 * Desktop (≥640px): full 290px gradient card with tagline + CTA button.
 */
export function ChatLauncher({ onOpen }: ChatLauncherProps) {
  const t = useTranslations("chat.launcher");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
      className="fixed bottom-4 right-4"
      style={{ zIndex: 9998 }}
    >
      {/* Responsive toggle styles */}
      <style>{`
        .chat-launcher-mobile { display: block; }
        .chat-launcher-desktop { display: none; }
        @media (min-width: 640px) {
          .chat-launcher-mobile { display: none; }
          .chat-launcher-desktop { display: block; }
        }
      `}</style>

      {/* ── Mobile: compact circular logo button ── */}
      <div className="chat-launcher-mobile">
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("open")}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full"
        >
          {/* Pulse ring */}
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-primary/40 opacity-60"
          />
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-600 ring-2 ring-white/60"
            style={{
              boxShadow:
                "0 12px 30px -8px rgba(8, 145, 178, 0.5), 0 4px 12px -4px rgba(14, 165, 233, 0.4)",
            }}
          >
            <Logo className="h-7 w-7 text-white" />
          </div>
          {/* Online status dot */}
          <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center">
            <span
              aria-hidden
              className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
            />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-white" />
          </span>
        </button>
      </div>

      {/* ── Desktop: full gradient card ── */}
      <div className="chat-launcher-desktop">
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("open")}
          style={{
            width: "290px",
            boxShadow:
              "0 20px 45px -12px rgba(8, 145, 178, 0.45), 0 8px 20px -8px rgba(14, 165, 233, 0.35)",
          }}
          className="group relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-teal-600 p-4 text-left text-white ring-1 ring-white/20 transition-all duration-300 hover:-translate-y-1 hover:ring-white/30"
        >
          {/* Decorative blurred blobs for depth */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/15 blur-2xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -left-6 h-20 w-20 rounded-full bg-cyan-300/20 blur-2xl"
          />

          {/* Shine sweep on hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          />

          {/* Chevron pill, top-right */}
          <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-all group-hover:translate-x-0.5 group-hover:bg-white/25">
            <ChevronRight className="h-3.5 w-3.5" />
          </span>

          {/* Top row: logo + tagline */}
          <div className="relative flex items-start gap-3 pr-8">
            {/* Logo with pulse ring + online indicator */}
            <div className="relative shrink-0">
              <span
                aria-hidden
                className="absolute inset-0 animate-ping rounded-full bg-white/30 opacity-60"
              />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-white/60">
                <Logo className="h-7 w-7 text-primary" />
              </div>
              {/* Online status dot */}
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
                {t("tagline")}
              </p>
            </div>
          </div>

          {/* CTA pill with subtle arrow */}
          <span className="relative mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-center text-[13px] font-semibold text-primary shadow-md transition-all group-hover:gap-2 group-hover:shadow-lg">
            {t("cta")}
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      </div>
    </motion.div>
  );
}
