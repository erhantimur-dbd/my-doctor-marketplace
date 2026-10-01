import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkoutSessionShouldFulfill,
  giftCardPaymentMatches,
  walletTopUpCredit,
} from "@/lib/stripe/checkout-fulfillment";

describe("checkoutSessionShouldFulfill", () => {
  it("fulfills a paid payment session", () => {
    expect(
      checkoutSessionShouldFulfill({ mode: "payment", payment_status: "paid" })
    ).toBe(true);
  });

  it("does not fulfill an unpaid completed session", () => {
    expect(
      checkoutSessionShouldFulfill({
        mode: "payment",
        payment_status: "unpaid",
      })
    ).toBe(false);
  });

  it("does not treat a free payment session as paid stored value", () => {
    expect(
      checkoutSessionShouldFulfill({
        mode: "payment",
        payment_status: "no_payment_required",
      })
    ).toBe(false);
  });

  it("fulfills a subscription that a coupon made free", () => {
    expect(
      checkoutSessionShouldFulfill({
        mode: "subscription",
        payment_status: "no_payment_required",
      })
    ).toBe(true);
  });

  it("does not claim a subscription whose first invoice is unpaid", () => {
    expect(
      checkoutSessionShouldFulfill({
        mode: "subscription",
        payment_status: "unpaid",
      })
    ).toBe(false);
  });
});

describe("walletTopUpCredit", () => {
  it("uses the Stripe charged amount and currency", () => {
    expect(
      walletTopUpCredit({ amount_total: 5000, currency: "gbp" })
    ).toEqual({ amountCents: 5000, currency: "GBP" });
  });

  it("does not fall back to a metadata amount when Stripe charged nothing", () => {
    expect(walletTopUpCredit({ amount_total: 0, currency: "gbp" })).toBeNull();
    expect(walletTopUpCredit({ amount_total: null, currency: "gbp" })).toBeNull();
  });
});

describe("giftCardPaymentMatches", () => {
  it("requires the charged amount and currency to match the pending card", () => {
    const card = { amount_cents: 5000, currency: "GBP" };
    expect(
      giftCardPaymentMatches(card, { amount_total: 5000, currency: "gbp" })
    ).toBe(true);
    expect(
      giftCardPaymentMatches(card, { amount_total: 100, currency: "gbp" })
    ).toBe(false);
    expect(
      giftCardPaymentMatches(card, { amount_total: 5000, currency: "eur" })
    ).toBe(false);
  });
});

describe("stripe webhook wiring", () => {
  const route = readFileSync(
    join(process.cwd(), "src/app/api/webhooks/stripe/route.ts"),
    "utf8"
  );

  it("shares fulfillment between completed and async_payment_succeeded", () => {
    expect(route).toContain('case "checkout.session.completed":');
    expect(route).toContain('case "checkout.session.async_payment_succeeded":');
    const completed = route.indexOf('case "checkout.session.completed":');
    const asyncPaid = route.indexOf(
      'case "checkout.session.async_payment_succeeded":'
    );
    const gate = route.indexOf("checkoutSessionShouldFulfill(session)");
    expect(completed).toBeGreaterThan(-1);
    expect(asyncPaid).toBeGreaterThan(completed);
    expect(gate).toBeGreaterThan(asyncPaid);
  });

  it("credits wallet top-ups from walletTopUpCredit only", () => {
    const start = route.indexOf('session.metadata?.type === "wallet_top_up"');
    const end = route.indexOf('session.metadata?.type === "gift_card_purchase"');
    const block = route.slice(start, end);
    expect(block).toContain("walletTopUpCredit(session)");
    expect(block).not.toContain("metadata.amount_cents");
  });

  it("activates a gift card only after giftCardPaymentMatches", () => {
    const start = route.indexOf('session.metadata?.type === "gift_card_purchase"');
    const end = route.indexOf("const bookingId = session.metadata?.booking_id");
    const block = route.slice(start, end);
    expect(block).toContain("giftCardPaymentMatches");
    expect(block.indexOf("giftCardPaymentMatches")).toBeLessThan(
      block.indexOf('status: "active"')
    );
  });
});
