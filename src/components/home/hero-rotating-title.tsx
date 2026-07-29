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
  /** Static secondary line, e.g. "Book Instantly" */
  secondLine: string;
  /** Dwell time per word (ms) */
  intervalMs?: number;
  className?: string;
}

/**
 * Doctify-style stacked hero title:
 *
 *   Find your trusted          ← lead-in (smaller)
 *   Gynaecologist              ← large centered rotating role
 *   Book Instantly             ← secondary CTA line
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

  return (
    <h1
      className={cn(
        "mx-auto flex max-w-4xl flex-col items-center text-center tracking-tight text-white",
        className
      )}
    >
      {/* 1. Lead-in — Doctify: smaller line above the role */}
      <span
        data-hero-part="lead-in"
        className="block text-2xl font-semibold text-white/95 md:text-4xl md:font-bold"
      >
        {prefix}
      </span>

      {/* 2. Rotating role — visual centerpiece */}
      <span
        data-hero-part="role"
        className="relative mt-1 inline-grid min-h-[1.15em] text-5xl font-bold leading-tight md:mt-2 md:text-7xl"
        aria-live="polite"
        aria-atomic="true"
      >
        {/* Reserve width + height for the longest word so content below does not jump */}
        <span
          className="invisible col-start-1 row-start-1 whitespace-nowrap px-1"
          aria-hidden
        >
          {longest}
        </span>
        <span className="relative col-start-1 row-start-1 flex items-center justify-center overflow-hidden">
          {reduceMotion ? (
            <span className="whitespace-nowrap underline decoration-white/50 decoration-2 underline-offset-[0.12em]">
              {safeWords[0]}
            </span>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={current}
                className="whitespace-nowrap underline decoration-white/50 decoration-2 underline-offset-[0.12em]"
                initial={{ y: "50%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-50%", opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {current}
              </motion.span>
            </AnimatePresence>
          )}
        </span>
      </span>

      {/* 3. Secondary line — Book Instantly (not equal H1 weight) */}
      <span
        data-hero-part="second-line"
        className="mt-3 block text-xl font-semibold tracking-tight text-white/85 md:mt-4 md:text-3xl"
      >
        {secondLine}
      </span>
    </h1>
  );
}
