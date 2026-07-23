import { describe, expect, it } from "vitest";
import {
  canAutoExecuteVoiceIntent,
  resolveProposedBookingPath,
  resolveVoiceBookingConfirmation,
  voiceIntentFromProposeBookingOutput,
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

  it("never auto-executes confirm_booking or propose_booking", () => {
    expect(
      canAutoExecuteVoiceIntent({
        kind: "confirm_booking",
        bookingPayloadId: "bp_1",
      })
    ).toBe(false);
    expect(
      canAutoExecuteVoiceIntent({
        kind: "propose_booking",
        draft: {
          doctorSlug: "dr-x",
          doctorName: "Dr X",
          date: "2026-08-01",
          time: "10:00:00",
          consultationType: "video",
          bookPath: "/doctors/dr-x/book?date=2026-08-01&time=10:00:00&type=video",
        },
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

  it("Phase 3: proposeBooking path only after user confirm", () => {
    const draft = {
      doctorSlug: "smith",
      doctorName: "Dr Smith",
      date: "2026-08-01",
      time: "09:30:00",
      consultationType: "in_person" as const,
      bookPath: "/doctors/smith/book?date=2026-08-01&time=09:30:00&type=in_person",
    };
    expect(resolveProposedBookingPath(draft, false)).toBeNull();
    expect(resolveProposedBookingPath(draft, true)).toBe(draft.bookPath);
    expect(
      resolveProposedBookingPath(
        { ...draft, bookPath: "https://evil.example/x" },
        true
      )
    ).toBeNull();

    const intent = voiceIntentFromProposeBookingOutput({
      ok: true,
      draft,
    });
    expect(intent.kind).toBe("propose_booking");
    expect(canAutoExecuteVoiceIntent(intent)).toBe(false);
  });
});
