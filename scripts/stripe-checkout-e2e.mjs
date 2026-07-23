/**
 * Drive a real Stripe Checkout Session using the same shape as
 * createBookingAndCheckout (destination charge fields optional without Connect).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-checkout-e2e.mjs
 *
 * Writes JSON summary to stdout; exit 0 on success.
 */
import Stripe from "stripe";
import { writeFileSync } from "node:fs";

const key = process.env.STRIPE_SECRET_KEY || "";
const outPath = process.env.E2E_OUT || "";

function log(obj) {
  const line = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  console.log(line);
  if (outPath) {
    writeFileSync(outPath, line + "\n", { flag: "a" });
  }
}

if (!key) {
  log({
    ok: false,
    error: "STRIPE_SECRET_KEY not set",
    fallback: "run booking confirmation + checkout shape unit contracts",
  });
  process.exit(2);
}

const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
const origin = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360-app.vercel.app";
const locale = "en";
const bookingId = `e2e-booking-${Date.now()}`;

const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [
    {
      price_data: {
        currency: "gbp",
        product_data: {
          name: "E2E Consultation with Dr. Test",
          description: "Automated GTM Checkout path check",
        },
        unit_amount: 5000,
      },
      quantity: 1,
    },
  ],
  // Match shipped booking success_url shape (session_id placeholder)
  success_url: `${origin}/${locale}/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/${locale}/doctors`,
  metadata: {
    booking_id: bookingId,
    booking_number: "E2E-TEST",
    payment_mode: "full",
    is_guest: "1",
    patient_id: "e2e-patient",
  },
});

const result = {
  ok: true,
  mode: session.mode,
  id: session.id,
  url: session.url,
  success_url: session.success_url,
  metadata_booking_id: session.metadata?.booking_id,
  keyMode: key.startsWith("sk_live") ? "live" : "test",
  // Wallet confirmation shape from booking.ts (documented contract)
  wallet_confirmation_example: `${origin}/${locale}/booking-confirmation?booking_id=${bookingId}&wallet=true`,
};

log(result);

if (session.mode !== "payment") process.exit(1);
if (!session.success_url?.includes("session_id=")) process.exit(1);
if (!session.metadata?.booking_id) process.exit(1);

process.exit(0);
