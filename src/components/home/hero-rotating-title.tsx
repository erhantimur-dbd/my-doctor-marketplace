"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface HeroRotatingTitleProps {
  /** Static lead-in, e.g. "Find your trusted" */
  prefix: string;
  /** Specialty / role nouns to cycle */
  words: string[];
  /** Static second line, e.g. "Book Instantly" */
  secondLine: string;
  /** Dwell time per word (ms) */
  intervalMs?: number;
  className?: string;
}

/**
 * Doctify-style hero H1:
 *   Find your trusted Gynaecologist
 *   Book Instantly
 *
 * Prefix + rotating word stay on one phrase line when space allows.
 */
export function HeroRotatingTitle({
  prefix,
  words,
  secondLine,
  intervalMs = 2800,
  className,
}: HeroRotatingTitleProps) {
  const safeWords = useMemo(
    () => (words.length > 0 ? words : ["Doctor"]),
    [words]
  );
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || safeWords.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % safeWords.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, reduceMotion, safeWords.length]);

  const current = safeWords[index] ?? safeWords[0];
  // Longest word reserves width so cycling doesn't shift layout
  const longest = useMemo(
    () =>
      safeWords.reduce((a, b) => (b.length > a.length ? b : a), safeWords[0]),
    [safeWords]
  );

  const wordClass =
    "inline-block whitespace-nowrap text-white underline decoration-white/45 decoration-2 underline-offset-[0.18em]";

  return (
    <h1
      className={cn(
        "mx-auto max-w-4xl text-center text-4xl font-bold tracking-tight text-white md:text-6xl",
        className
      )}
    >
      {/* Line 1: prefix + role on one phrase (wraps as a unit only if needed) */}
      <span className="inline-flex max-w-full flex-wrap items-baseline justify-center gap-x-2.5 gap-y-1">
        <span className="whitespace-nowrap">{prefix}</span>
        <span
          className="relative inline-grid text-left align-baseline"
          aria-live="polite"
          aria-atomic="true"
        >
          <span
            className="invisible col-start-1 row-start-1 whitespace-nowrap"
            aria-hidden
          >
            {longest}
          </span>
          <span className="relative col-start-1 row-start-1 overflow-hidden leading-none">
            {reduceMotion ? (
              <span className={wordClass}>{safeWords[0]}</span>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={current}
                  className={wordClass}
                  initial={{ y: "45%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-45%", opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  {current}
                </motion.span>
              </AnimatePresence>
            )}
          </span>
        </span>
      </span>

      {/* Line 2: payoff — secondary hierarchy */}
      <span className="mt-2 block text-3xl font-semibold tracking-tight text-white/90 md:mt-3 md:text-5xl">
        {secondLine}
      </span>
    </h1>
  );
}
