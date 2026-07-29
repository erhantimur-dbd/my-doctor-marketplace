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
 * Doctify-style hero H1: "Find your trusted [Doctor|Urologist|…]" + "Book Instantly".
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
  // Longest word reserves horizontal space so the line doesn't jump
  const longest = useMemo(
    () =>
      safeWords.reduce((a, b) => (b.length > a.length ? b : a), safeWords[0]),
    [safeWords]
  );

  return (
    <h1
      className={cn(
        "mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white md:text-6xl",
        className
      )}
    >
      <span className="block">
        <span>{prefix} </span>
        <span
          className="relative inline-grid align-bottom text-left"
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Invisible sizer for max word width + line height */}
          <span
            className="invisible col-start-1 row-start-1 whitespace-nowrap"
            aria-hidden
          >
            {longest}
          </span>
          <span className="relative col-start-1 row-start-1 overflow-hidden">
            {reduceMotion ? (
              <span className="inline-block whitespace-nowrap underline decoration-white/40 decoration-2 underline-offset-4">
                {safeWords[0]}
              </span>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={current}
                  className="inline-block whitespace-nowrap underline decoration-white/40 decoration-2 underline-offset-4"
                  initial={{ y: "40%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-40%", opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  {current}
                </motion.span>
              </AnimatePresence>
            )}
          </span>
        </span>
      </span>
      <span className="mt-1 block md:mt-2">{secondLine}</span>
    </h1>
  );
}
