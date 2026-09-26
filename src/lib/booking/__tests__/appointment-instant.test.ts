import { describe, expect, it } from "vitest";
import {
  dailyRoomExpiresAtUnixFromBooking,
  isAbsoluteTimestamp,
  resolveBookingInstant,
} from "@/lib/booking/appointment-instant";

describe("resolveBookingInstant", () => {
  it("uses ISO timestamptz as-is (does not concat appointment_date)", () => {
    const d = resolveBookingInstant(
      "2026-09-26",
      "2026-09-26T10:30:00.000Z"
    );
    expect(d.toISOString()).toBe("2026-09-26T10:30:00.000Z");
    expect(Number.isFinite(d.getTime())).toBe(true);
  });

  it("concatenates time-only values with appointment_date", () => {
    const d = resolveBookingInstant("2026-09-26", "10:30:00");
    expect(d.getTime()).toBe(new Date("2026-09-26T10:30:00").getTime());
  });

  it("detects absolute timestamps", () => {
    expect(isAbsoluteTimestamp("2026-09-26T10:30:00+01:00")).toBe(true);
    expect(isAbsoluteTimestamp("2026-09-26 10:30:00+01")).toBe(true);
    expect(isAbsoluteTimestamp("10:30:00")).toBe(false);
    expect(isAbsoluteTimestamp("10:30")).toBe(false);
  });
});

describe("dailyRoomExpiresAtUnixFromBooking", () => {
  it("adds one hour after an ISO end time", () => {
    expect(
      dailyRoomExpiresAtUnixFromBooking(
        "2026-09-26",
        "2026-09-26T10:30:00.000Z"
      )
    ).toBe(Math.floor(new Date("2026-09-26T10:30:00.000Z").getTime() / 1000) + 3600);
  });

  it("adds one hour after a time-only end", () => {
    expect(dailyRoomExpiresAtUnixFromBooking("2026-09-26", "10:30:00")).toBe(
      Math.floor(new Date("2026-09-26T10:30:00").getTime() / 1000) + 3600
    );
  });
});
