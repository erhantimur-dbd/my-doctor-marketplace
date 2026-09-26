import { describe, expect, it } from "vitest";
import {
  bookingHasRefundableCharge,
  hoursUntilAppointment,
  refundAmountCents,
  refundPercentForPolicy,
  stripeChargedAmountCents,
} from "@/lib/booking/cancellation-refund";

describe("refundPercentForPolicy", () => {
  it("flexible: full refund >24h", () => {
    expect(refundPercentForPolicy("flexible", 25)).toBe(100);
    expect(refundPercentForPolicy("flexible", 24)).toBe(0);
  });

  it("moderate: tiers at 48h / 24h", () => {
    expect(refundPercentForPolicy("moderate", 49)).toBe(100);
    expect(refundPercentForPolicy("moderate", 25)).toBe(50);
    expect(refundPercentForPolicy("moderate", 10)).toBe(0);
  });

  it("strict: full refund >72h", () => {
    expect(refundPercentForPolicy("strict", 73)).toBe(100);
    expect(refundPercentForPolicy("strict", 72)).toBe(0);
  });
});

describe("bookingHasRefundableCharge", () => {
  it("requires payment intent and paid_at (blocks Softsmoke wallet mint)", () => {
    expect(
      bookingHasRefundableCharge({
        stripe_payment_intent_id: null,
        paid_at: "2026-09-26T10:00:00Z",
      })
    ).toBe(false);
    expect(
      bookingHasRefundableCharge({
        stripe_payment_intent_id: "pi_123",
        paid_at: null,
      })
    ).toBe(false);
    expect(
      bookingHasRefundableCharge({
        stripe_payment_intent_id: "pi_123",
        paid_at: "2026-09-26T10:00:00Z",
      })
    ).toBe(true);
  });
});

describe("stripeChargedAmountCents / refundAmountCents", () => {
  it("uses deposit when payment_mode is deposit", () => {
    expect(
      stripeChargedAmountCents({
        payment_mode: "deposit",
        deposit_amount_cents: 2000,
        total_amount_cents: 10000,
      })
    ).toBe(2000);
  });

  it("computes percent of charged amount", () => {
    expect(refundAmountCents(10000, 50)).toBe(5000);
    expect(refundAmountCents(10000, 0)).toBe(0);
  });
});

describe("hoursUntilAppointment", () => {
  it("reads ISO start_time without concat Invalid Date", () => {
    const now = new Date("2026-09-26T08:00:00.000Z");
    const hours = hoursUntilAppointment(
      "2026-09-26",
      "2026-09-26T12:00:00.000Z",
      now
    );
    expect(hours).toBe(4);
  });
});

describe("patient cancel dialog wires full cancelBooking", () => {
  it("re-exports shared cancelBooking from booking actions", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const stub = readFileSync(
      join(
        process.cwd(),
        "src/app/[locale]/(patient)/dashboard/bookings/[id]/actions.ts"
      ),
      "utf8"
    );
    expect(stub).toContain('export { cancelBooking } from "@/actions/booking"');
    expect(stub).not.toMatch(/status:\s*"cancelled_patient"/);

    const dialog = readFileSync(
      join(
        process.cwd(),
        "src/app/[locale]/(patient)/dashboard/bookings/[id]/cancel-booking-dialog.tsx"
      ),
      "utf8"
    );
    expect(dialog).toContain('from "@/actions/booking"');
    expect(dialog).toContain("refund_destination");
  });

  it("wallet cancel path reverses transfer and does not Stripe-refund the card", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src/actions/booking.ts"),
      "utf8"
    );
    expect(source).toContain("reverseDestinationTransferToPlatform");
    expect(source).toContain("bookingHasRefundableCharge");
    // Wallet branch must not call refunds.create
    const walletBlock = source.slice(
      source.indexOf('refundDestination === "wallet"'),
      source.indexOf("// Bank refund:")
    );
    expect(walletBlock).not.toContain("refunds.create");
    expect(walletBlock).toContain("creditWallet");
  });
});
