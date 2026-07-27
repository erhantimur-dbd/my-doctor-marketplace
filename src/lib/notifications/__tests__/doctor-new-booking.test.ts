import { describe, expect, it } from "vitest";
import {
  getMinutesUntilBooking,
  isBookingWithinNextHour,
} from "../doctor-new-booking";

describe("isBookingWithinNextHour", () => {
  it("returns true when start is 30 minutes from now", () => {
    const now = Date.parse("2026-04-01T12:00:00");
    expect(
      isBookingWithinNextHour("2026-04-01", "12:30:00", now)
    ).toBe(true);
  });

  it("returns true at the 60-minute boundary", () => {
    const now = Date.parse("2026-04-01T12:00:00");
    expect(
      isBookingWithinNextHour("2026-04-01", "13:00:00", now)
    ).toBe(true);
  });

  it("returns false when start is more than an hour away", () => {
    const now = Date.parse("2026-04-01T12:00:00");
    expect(
      isBookingWithinNextHour("2026-04-01", "14:00:00", now)
    ).toBe(false);
  });

  it("returns true if appointment started a few minutes ago", () => {
    const now = Date.parse("2026-04-01T12:05:00");
    expect(
      isBookingWithinNextHour("2026-04-01", "12:00:00", now)
    ).toBe(true);
  });

  it("returns false for far-past appointments", () => {
    const now = Date.parse("2026-04-01T14:00:00");
    expect(
      isBookingWithinNextHour("2026-04-01", "12:00:00", now)
    ).toBe(false);
  });

  it("handles HH:MM without seconds", () => {
    const now = Date.parse("2026-04-01T12:00:00");
    expect(isBookingWithinNextHour("2026-04-01", "12:45", now)).toBe(true);
  });
});

describe("getMinutesUntilBooking", () => {
  it("returns positive minutes until start", () => {
    const now = Date.parse("2026-04-01T12:00:00");
    expect(getMinutesUntilBooking("2026-04-01", "12:30:00", now)).toBe(30);
  });
});
