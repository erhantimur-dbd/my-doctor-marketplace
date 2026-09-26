import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONFIRMATION_PAID_BODY_KEY,
  CONFIRMATION_PENDING_BODY_KEY,
  confirmationCopy,
} from "@/lib/booking/confirmation-copy";

const en = JSON.parse(
  readFileSync(join(process.cwd(), "messages/en.json"), "utf8")
).booking as Record<string, string>;

const PENDING_SENTENCE = /will be confirmed once payment is completed/i;

describe("confirmationCopy", () => {
  it("uses confirmed copy after paid Stripe Checkout", () => {
    const copy = confirmationCopy({
      status: "confirmed",
      paidAt: "2026-09-26T10:00:00.000Z",
      stripePaymentStatus: "paid",
      stripeSessionStatus: "complete",
      lookupMode: "stripe_session",
    });

    expect(copy.paymentPending).toBe(false);
    expect(copy.headingKey).toBe("booking_confirmed");
    expect(copy.bodyKey).toBe(CONFIRMATION_PAID_BODY_KEY);
    expect(en[copy.headingKey]).toBe("Your appointment is confirmed!");
    expect(en[copy.bodyKey]).not.toMatch(PENDING_SENTENCE);
    expect(en[copy.bodyKey]).toMatch(/payment received/i);
    expect(en.payment_confirm_note).toMatch(PENDING_SENTENCE);
  });

  it("keeps pending wording only while payment is still unpaid", () => {
    const copy = confirmationCopy({
      status: "pending_payment",
      paidAt: null,
      stripePaymentStatus: "unpaid",
      stripeSessionStatus: "open",
      lookupMode: "stripe_session",
    });

    expect(copy.paymentPending).toBe(true);
    expect(copy.bodyKey).toBe(CONFIRMATION_PENDING_BODY_KEY);
    expect(en[copy.bodyKey]).toMatch(PENDING_SENTENCE);
    expect(en[copy.headingKey]).not.toMatch(/confirmed!/);
  });

  it("treats a paid Checkout session as settled even if the row is still pending_payment", () => {
    const copy = confirmationCopy({
      status: "pending_payment",
      paidAt: null,
      stripePaymentStatus: "paid",
      stripeSessionStatus: "complete",
      lookupMode: "stripe_session",
    });
    expect(copy.paymentPending).toBe(false);
    expect(en[copy.bodyKey]).not.toMatch(PENDING_SENTENCE);
  });

  it("treats a complete Checkout session as settled", () => {
    const copy = confirmationCopy({
      status: "pending_payment",
      stripePaymentStatus: "unpaid",
      stripeSessionStatus: "complete",
      lookupMode: "stripe_session",
    });
    expect(copy.paymentPending).toBe(false);
  });

  it("treats paid_at as settled without a Stripe session", () => {
    const copy = confirmationCopy({
      status: "pending_payment",
      paidAt: "2026-09-26T10:00:00.000Z",
    });
    expect(copy.paymentPending).toBe(false);
  });

  it("treats confirmed, approved, completed, and pending_approval as settled", () => {
    for (const status of [
      "confirmed",
      "approved",
      "completed",
      "pending_approval",
    ]) {
      const copy = confirmationCopy({ status, paidAt: null });
      expect(copy.paymentPending).toBe(false);
      expect(en[copy.bodyKey]).not.toMatch(PENDING_SENTENCE);
    }
  });

  it("treats wallet and charge-skip returns as settled", () => {
    expect(
      confirmationCopy({
        status: "pending_payment",
        lookupMode: "wallet_booking",
      }).paymentPending
    ).toBe(false);
    expect(
      confirmationCopy({
        status: "pending_payment",
        lookupMode: "direct_confirm",
      }).paymentPending
    ).toBe(false);
  });
});

describe("confirmation page wiring", () => {
  const page = readFileSync(
    join(
      process.cwd(),
      "src/app/[locale]/(public)/booking-confirmation/page.tsx"
    ),
    "utf8"
  );

  it("picks copy from payment state and does not always render the pending sentence", () => {
    expect(page).toContain("confirmationCopy");
    expect(page).not.toMatch(/t\("payment_confirm_note"\)/);
    expect(page).toContain("patientBookingDoctorName");
    expect(page).not.toMatch(/profile\.first_name/);
  });
});
