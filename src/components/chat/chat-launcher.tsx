"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface ChatLauncherProps {
  onOpen: () => void;
}

/**
 * Closed-state floating card shown in the bottom-right corner. Inspired by
 * the TopDoctors chat launcher: a rounded card with the AI tagline, a cute
 * mascot, and a prominent white "Find specialist" CTA button. On mobile we
 * collapse to a compact round icon to preserve tap area without blocking
 * scroll content.
 */
export function ChatLauncher({ onOpen }: ChatLauncherProps) {
  const t = useTranslations("chat.launcher");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
      className="fixed bottom-4 right-4 z-[85] sm:bottom-6 sm:right-6"
    >
      {/* Desktop: full invite card */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("open")}
        className="group relative hidden w-[290px] flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-[#0b3a8a] via-primary to-[#4a9eff] p-3.5 text-left text-white shadow-xl ring-1 ring-white/10 transition-transform hover:-translate-y-0.5 hover:shadow-2xl sm:flex"
      >
        {/* Chevron hint, top-right */}
        <span className="absolute right-3 top-3 rounded-full p-0.5 opacity-80 transition-opacity group-hover:opacity-100">
          <ChevronRight className="h-4 w-4" />
        </span>

        {/* Top row: mascot + tagline */}
        <div className="flex items-start gap-3 pr-5">
          {/* Cute mascot — blue orb with a white face and two eyes */}
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-white/30 to-white/10 ring-2 ring-white/40 shadow-inner">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow">
              <div className="flex gap-1">
                <span className="block h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="block h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
            </div>
            {/* Tiny highlight dot */}
            <span className="absolute left-1.5 top-1.5 h-1 w-1 rounded-full bg-white/80" />
          </div>

          <p className="text-[15px] font-bold leading-snug">
            {t("tagline")}
          </p>
        </div>

        {/* Big white CTA */}
        <span className="mt-3 block w-full rounded-xl bg-white px-4 py-2.5 text-center text-sm font-semibold text-primary shadow-sm transition-colors group-hover:bg-white/95">
          {t("cta")}
        </span>
      </button>

      {/* Mobile: round icon with the mascot face */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("open")}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-[#0b3a8a] via-primary to-[#4a9eff] text-white shadow-xl ring-1 ring-white/20 transition-transform hover:scale-105 sm:hidden"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow">
          <div className="flex gap-1">
            <span className="block h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="block h-1.5 w-1.5 rounded-full bg-primary" />
          </div>
        </div>
        <span className="absolute left-3 top-3 h-1 w-1 rounded-full bg-white/80" />
      </button>
    </motion.div>
  );
}
