"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  heroWordAt,
  longestHeroWord,
  nextHeroWordIndex,
  normalizeHeroWords,
} from "@/lib/home/hero-rotating-words";

interface HeroRotatingTitleProps {
  /** Static lead-in, e.g. "Find your trusted" */
  prefix: string;
  /** Specialty / role nouns to cycle */
  words: string[];
  /** Static secondary line under the H1 phrase, e.g. "Book Instantly" */
  secondLine: string;
  /** Dwell time per word (ms) */
  intervalMs?: number;
  className?: string;
}

/**
 * Doctify-style hero title (Image #1 / doctify.com):
 *
 *   Find your trusted Cardiologist   ← ONE line; role inline + accent color
 *   Book Instantly                   ← secondary line under the phrase
 */
export function HeroRotatingTitle({
  prefix,
  words,
  secondLine,
  intervalMs = 2800,
  className,
}: HeroRotatingTitleProps) {
  const safeWords = useMemo(() => normalizeHeroWords(words), [words]);
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || safeWords.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => nextHeroWordIndex(i, safeWords));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, reduceMotion, safeWords]);

  const current = heroWordAt(safeWords, index);
  const longest = longestHeroWord(safeWords);

  // Accent on rotating role (Doctify uses contrast color on the noun)
  const roleClass =
    "inline-block whitespace-nowrap text-amber-200 drop-shadow-sm";

  return (
    <div className={cn("mx-auto max-w-5xl text-center", className)}>
      {/* Single-line H1: prefix + inline rotating role */}
      <h1
        data-hero-layout="doctify-inline"
        className="text-4xl font-bold tracking-tight text-white md:text-6xl"
      >
        <span className="inline-flex max-w-full flex-wrap items-baseline justify-center gap-x-2.5 gap-y-1">
          <span data-hero-part="lead-in" className="whitespace-nowrap">
            {prefix}
          </span>
          <span
            data-hero-part="role"
            className="relative inline-grid min-h-[1.1em] text-left align-baseline"
            aria-live="polite"
            aria-atomic="true"
          >
            {/* Reserve width for longest word so the line does not jump */}
            <span
              className="invisible col-start-1 row-start-1 whitespace-nowrap"
              aria-hidden
            >
              {longest}
            </span>
            <span className="relative col-start-1 row-start-1 overflow-hidden leading-none">
              {reduceMotion ? (
                <span className={roleClass}>{safeWords[0]}</span>
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={current}
                    className={roleClass}
                    initial={{ y: "40%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "-40%", opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {current}
                  </motion.span>
                </AnimatePresence>
              )}
            </span>
          </span>
        </span>
      </h1>

      {/* Secondary line under the single-line title */}
      <p
        data-hero-part="second-line"
        className="mt-3 text-xl font-semibold tracking-tight text-white/85 md:mt-4 md:text-3xl"
      >
        {secondLine}
      </p>
    </div>
  );
}
