import { describe, expect, it } from "vitest";
import {
  isWalletOnlyConfirmation,
  resolveConfirmationLookup,
} from "@/lib/booking/confirmation-params";

describe("resolveConfirmationLookup", () => {
  it("uses Stripe session when session_id is present", () => {
    const r = resolveConfirmationLookup({
      session_id: "cs_test_abc",
      booking_id: "should-ignore",
      wallet: "true",
    });
    expect(r).toEqual({ mode: "stripe_session", sessionId: "cs_test_abc" });
  });

  it("resolves wallet-only URL from createBookingAndCheckout", () => {
    // Mirrors booking.ts: booking-confirmation?booking_id=${id}&wallet=true
    const r = resolveConfirmationLookup({
      booking_id: "bk_123",
      wallet: "true",
    });
    expect(r).toEqual({ mode: "wallet_booking", bookingId: "bk_123" });
    expect(isWalletOnlyConfirmation({ booking_id: "bk_123", wallet: "true" })).toBe(
      true
    );
  });

  it("rejects empty query (would previously redirect home for wallet pay)", () => {
    expect(resolveConfirmationLookup({})).toEqual({ mode: "invalid" });
    expect(resolveConfirmationLookup({ session_id: "  " })).toEqual({
      mode: "invalid",
    });
  });

  it("accepts booking_id without wallet flag when no session", () => {
    const r = resolveConfirmationLookup({ booking_id: "bk_only" });
    expect(r.mode).toBe("wallet_booking");
    if (r.mode === "wallet_booking") {
      expect(r.bookingId).toBe("bk_only");
    }
  });
});
