/**
 * Phase B structural checks against the real booking Checkout call site.
 * Ensures GTM payment path still uses Connect destination charges and does not
 * hardcode payment_method_types (Stripe dynamic methods best practice).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveConfirmationLookup } from "@/lib/booking/confirmation-params";

const bookingActionPath = join(process.cwd(), "src/actions/booking.ts");

describe("patient booking Stripe Checkout shape (source contract)", () => {
  const source = readFileSync(bookingActionPath, "utf8");

  it("creates Checkout sessions without payment_method_types", () => {
    expect(source).toContain("checkout.sessions.create");
    expect(source).not.toMatch(/payment_method_types\s*:/);
  });

  it("uses Connect destination charges for doctor payouts", () => {
    expect(source).toContain("application_fee_amount");
    expect(source).toContain("transfer_data");
    expect(source).toContain("destination: doctor.stripe_account_id");
  });

  it("returns Softsmoke charge-skip confirm URL the confirmation page accepts", () => {
    expect(source).toContain(
      "booking-confirmation?booking_id=${booking.id}&confirm=1"
    );
    const lookup = resolveConfirmationLookup({
      booking_id: "example-id",
      confirm: "1",
    });
    expect(lookup.mode).toBe("direct_confirm");
  });

  it("persists Checkout session id for cleanup soft-expire", () => {
    expect(source).toContain("stripe_checkout_session_id: session.id");
  });

  it("returns wallet-only success URL the confirmation page accepts", () => {
    expect(source).toContain(
      "booking-confirmation?booking_id=${booking.id}&wallet=true"
    );
    const lookup = resolveConfirmationLookup({
      booking_id: "example-id",
      wallet: "true",
    });
    expect(lookup.mode).toBe("wallet_booking");
  });

  it("returns Stripe success_url with session_id placeholder", () => {
    expect(source).toContain(
      "booking-confirmation?session_id={CHECKOUT_SESSION_ID}"
    );
    const lookup = resolveConfirmationLookup({
      session_id: "cs_test_placeholder",
    });
    expect(lookup.mode).toBe("stripe_session");
  });

  it("persists stripe_checkout_session_id after Checkout session create", () => {
    const createAt = source.indexOf("checkout.sessions.create");
    const persistAt = source.indexOf("stripe_checkout_session_id: session.id");
    expect(createAt).toBeGreaterThan(-1);
    expect(persistAt).toBeGreaterThan(createAt);
    expect(source.slice(createAt, persistAt)).toContain("adminSupabase");
  });

  it("webhook guest claim uses sendGuestAccountClaimEmail (magic path)", () => {
    const webhook = readFileSync(
      join(process.cwd(), "src/app/api/webhooks/stripe/route.ts"),
      "utf8"
    );
    expect(webhook).toContain("sendGuestAccountClaimEmail");
    const claim = readFileSync(
      join(process.cwd(), "src/lib/auth/guest-claim.ts"),
      "utf8"
    );
    expect(claim).toContain('selectGuestClaimLinkType("magiclink")');
    expect(claim).toContain("magiclink");
  });
});
