import { describe, expect, it } from "vitest";
import { formatSlotTime } from "@/lib/utils/availability";

describe("formatSlotTime", () => {
  it("formats time-only HH:mm:ss with locale", () => {
    const en = formatSlotTime("14:30:00", "en");
    expect(en).toMatch(/14:30|2:30/);
    const de = formatSlotTime("14:30:00", "de");
    // de-DE typically 24h
    expect(de).toMatch(/14:30|14\.30/);
  });

  it("formats ISO timestamps with locale", () => {
    const s = formatSlotTime("2026-03-05T10:00:00+00:00", "en-GB");
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThanOrEqual(4);
  });
});
