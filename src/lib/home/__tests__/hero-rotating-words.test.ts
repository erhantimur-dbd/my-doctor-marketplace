import { describe, expect, it } from "vitest";
import {
  heroWordAt,
  heroWordCycleSequence,
  longestHeroWord,
  nextHeroWordIndex,
  normalizeHeroWords,
} from "@/lib/home/hero-rotating-words";

/** EN list mirrors messages/en.json home.hero_rotating_words — keep in sync for smoke. */
const EN_WORDS = [
  "Doctor",
  "GP",
  "Urologist",
  "Dentist",
  "Physiotherapist",
  "Dermatologist",
  "Cardiologist",
  "Gynaecologist",
  "Paediatrician",
  "Psychologist",
  "ENT Specialist",
];

describe("normalizeHeroWords", () => {
  it("returns Doctor when empty", () => {
    expect(normalizeHeroWords([])).toEqual(["Doctor"]);
    expect(normalizeHeroWords(null)).toEqual(["Doctor"]);
  });

  it("trims and drops blank entries", () => {
    expect(normalizeHeroWords(["  Doctor ", "", "  Dentist"])).toEqual([
      "Doctor",
      "Dentist",
    ]);
  });
});

describe("nextHeroWordIndex", () => {
  it("advances in order and wraps after the last EN word", () => {
    let i = 0;
    const seen: string[] = [heroWordAt(EN_WORDS, i)];
    for (let step = 0; step < EN_WORDS.length; step++) {
      i = nextHeroWordIndex(i, EN_WORDS);
      seen.push(heroWordAt(EN_WORDS, i));
    }
    // Full pass ends back on Doctor
    expect(seen[seen.length - 1]).toBe("Doctor");
    // Intermediate words match EN order
    for (let k = 0; k < EN_WORDS.length; k++) {
      expect(seen[k]).toBe(EN_WORDS[k]);
    }
  });

  it("stays on first word when reduceMotion is true", () => {
    expect(nextHeroWordIndex(0, EN_WORDS, { reduceMotion: true })).toBe(0);
    expect(nextHeroWordIndex(5, EN_WORDS, { reduceMotion: true })).toBe(0);
  });

  it("stays on first word when list has a single entry", () => {
    expect(nextHeroWordIndex(0, ["Doctor"])).toBe(0);
    expect(nextHeroWordIndex(3, ["Doctor"])).toBe(0);
  });
});

describe("heroWordCycleSequence", () => {
  it("produces the full EN sequence then wraps", () => {
    const seq = heroWordCycleSequence(EN_WORDS, EN_WORDS.length);
    expect(seq).toEqual([...EN_WORDS, "Doctor"]);
  });

  it("with reduceMotion stays on first word for every step", () => {
    const seq = heroWordCycleSequence(EN_WORDS, 4, { reduceMotion: true });
    expect(seq).toEqual(["Doctor", "Doctor", "Doctor", "Doctor", "Doctor"]);
  });
});

describe("longestHeroWord", () => {
  it("picks a longest specialty label so the role slot can reserve width", () => {
    const longest = longestHeroWord(EN_WORDS);
    expect(longest.length).toBe(Math.max(...EN_WORDS.map((w) => w.length)));
    // Sanity: at least as long as known multi-word specialty
    expect(longest.length).toBeGreaterThanOrEqual("ENT Specialist".length);
  });
});
