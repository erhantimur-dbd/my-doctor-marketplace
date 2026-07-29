/**
 * Pure helpers for homepage hero rotating role words (Doctify-style).
 * Separated from the client component so cycle behaviour is unit-testable.
 */

/** Normalize configured words; always returns at least one entry. */
export function normalizeHeroWords(words: string[] | null | undefined): string[] {
  if (!words || words.length === 0) return ["Doctor"];
  const cleaned = words.map((w) => w.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : ["Doctor"];
}

/**
 * Advance the rotating word index.
 * - With reducedMotion or a single word, always stays on 0 (or clamped index).
 * - Otherwise wraps after the last word.
 */
export function nextHeroWordIndex(
  currentIndex: number,
  words: string[],
  options?: { reduceMotion?: boolean }
): number {
  const list = normalizeHeroWords(words);
  if (options?.reduceMotion || list.length < 2) return 0;
  const safe = ((currentIndex % list.length) + list.length) % list.length;
  return (safe + 1) % list.length;
}

/** Word at index after normalize. */
export function heroWordAt(words: string[], index: number): string {
  const list = normalizeHeroWords(words);
  const safe = ((index % list.length) + list.length) % list.length;
  return list[safe]!;
}

/** Longest word used to reserve horizontal space in the role slot. */
export function longestHeroWord(words: string[]): string {
  const list = normalizeHeroWords(words);
  return list.reduce((a, b) => (b.length > a.length ? b : a), list[0]!);
}

/**
 * Full cycle sequence starting at index 0: [w0, w1, ..., wN-1, w0].
 * Useful for asserting wrap behaviour without a timer.
 */
export function heroWordCycleSequence(
  words: string[],
  steps: number,
  options?: { reduceMotion?: boolean; startIndex?: number }
): string[] {
  const list = normalizeHeroWords(words);
  let i = options?.startIndex ?? 0;
  const out: string[] = [heroWordAt(list, i)];
  for (let step = 0; step < steps; step++) {
    i = nextHeroWordIndex(i, list, options);
    out.push(heroWordAt(list, i));
  }
  return out;
}
