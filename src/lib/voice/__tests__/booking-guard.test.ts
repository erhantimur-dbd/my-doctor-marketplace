import { describe, expect, it } from "vitest";
import {
  canAutoExecuteVoiceIntent,
  resolveVoiceBookingConfirmation,
} from "@/lib/voice/booking-guard";

describe("voice booking guard", () => {
  it("allows none and navigate_book without confirm", () => {
    expect(canAutoExecuteVoiceIntent({ kind: "none" })).toBe(true);
    expect(
      canAutoExecuteVoiceIntent({
        kind: "navigate_book",
        path: "/en/doctors/x/book",
      })
    ).toBe(true);
  });

  it("never auto-executes confirm_booking", () => {
    expect(
      canAutoExecuteVoiceIntent({
        kind: "confirm_booking",
        bookingPayloadId: "bp_1",
      })
    ).toBe(false);
  });

  it("requires explicit userConfirmed for booking payload", () => {
    const intent = {
      kind: "confirm_booking" as const,
      bookingPayloadId: "bp_42",
    };
    expect(resolveVoiceBookingConfirmation(intent, false)).toBeNull();
    expect(resolveVoiceBookingConfirmation(intent, true)).toBe("bp_42");
    expect(
      resolveVoiceBookingConfirmation({ kind: "none" }, true)
    ).toBeNull();
  });
});
