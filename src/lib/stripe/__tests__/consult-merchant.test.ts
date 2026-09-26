import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE,
  EXPRESS_CONNECT_CAPABILITIES,
  cardPaymentsCapabilityStatus,
  doctorCanAcceptConsultCardPayment,
  isCardPaymentsCapabilityActive,
  requestCardPaymentsIfNeeded,
} from "@/lib/stripe/consult-merchant";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function stripeWith(status: string | null | undefined, onUpdate?: () => void) {
  const calls: { update: number } = { update: 0 };
  const stripe = {
    accounts: {
      async retrieve() {
        return {
          capabilities:
            status === undefined ? undefined : { card_payments: status },
        };
      },
      async update() {
        calls.update += 1;
        onUpdate?.();
        return { capabilities: { card_payments: "pending" } };
      },
    },
  };
  return { stripe, calls };
}

describe("card payments capability", () => {
  it("treats only active as able to take a consult card charge", () => {
    expect(isCardPaymentsCapabilityActive({ card_payments: "active" })).toBe(
      true
    );
    expect(isCardPaymentsCapabilityActive({ card_payments: "pending" })).toBe(
      false
    );
    expect(isCardPaymentsCapabilityActive({ card_payments: "inactive" })).toBe(
      false
    );
    expect(isCardPaymentsCapabilityActive(null)).toBe(false);
    expect(cardPaymentsCapabilityStatus(undefined)).toBe("unknown");
  });

  it("blocks checkout when card_payments is not active", async () => {
    for (const status of ["pending", "inactive", null, undefined] as const) {
      const { stripe } = stripeWith(status);
      const result = await doctorCanAcceptConsultCardPayment(
        stripe,
        "acct_test"
      );
      expect(result).toEqual({
        ok: false,
        error: DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE,
      });
    }
  });

  it("allows checkout when card_payments is active", async () => {
    const { stripe } = stripeWith("active");
    await expect(
      doctorCanAcceptConsultCardPayment(stripe, "acct_test")
    ).resolves.toEqual({ ok: true });
  });

  it("fails closed when Stripe cannot be read", async () => {
    const stripe = {
      accounts: {
        async retrieve() {
          throw new Error("stripe down");
        },
        async update() {
          return { capabilities: { card_payments: "active" } };
        },
      },
    };
    const result = await doctorCanAcceptConsultCardPayment(stripe, "acct_test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE);
    }
  });

  it("requests card_payments only when it is not already active or pending", async () => {
    const active = stripeWith("active");
    await expect(
      requestCardPaymentsIfNeeded(active.stripe, "acct_test")
    ).resolves.toBe("active");
    expect(active.calls.update).toBe(0);

    const pending = stripeWith("pending");
    await expect(
      requestCardPaymentsIfNeeded(pending.stripe, "acct_test")
    ).resolves.toBe("pending");
    expect(pending.calls.update).toBe(0);

    const inactive = stripeWith("inactive");
    await expect(
      requestCardPaymentsIfNeeded(inactive.stripe, "acct_test")
    ).resolves.toBe("pending");
    expect(inactive.calls.update).toBe(1);

    const missing = stripeWith(undefined);
    await requestCardPaymentsIfNeeded(missing.stripe, "acct_test");
    expect(missing.calls.update).toBe(1);
  });

  it("requests card_payments and transfers on new Express accounts", () => {
    expect(EXPRESS_CONNECT_CAPABILITIES.card_payments).toEqual({
      requested: true,
    });
    expect(EXPRESS_CONNECT_CAPABILITIES.transfers).toEqual({
      requested: true,
    });
  });
});

describe("consult charges set on_behalf_of", () => {
  it("sets on_behalf_of on standard, deposit, guest, and signed-in booking checkout", () => {
    const booking = read("src/actions/booking.ts");
    expect(booking.match(/checkout\.sessions\.create/g)?.length).toBe(1);
    expect(booking).toContain("on_behalf_of: doctor.stripe_account_id");
    expect(booking).toContain("destination: doctor.stripe_account_id");
    expect(booking).toContain("customer_email: guestEmail || undefined");
    expect(booking).toContain('payment_mode: isDeposit ? "deposit" : "full"');

    const skipAt = booking.indexOf("confirmBookingWithoutStripeCheckout");
    const walletAt = booking.indexOf("walletOnly: true");
    const gateAt = booking.indexOf("await doctorCanAcceptConsultCardPayment");
    const createAt = booking.indexOf("checkout.sessions.create");
    expect(skipAt).toBeGreaterThan(-1);
    expect(walletAt).toBeGreaterThan(skipAt);
    expect(gateAt).toBeGreaterThan(walletAt);
    expect(createAt).toBeGreaterThan(gateAt);
    expect(booking.slice(gateAt, createAt)).toContain("BOOKING_STATUSES.EXPIRED");
    expect(booking.indexOf("on_behalf_of:")).toBeGreaterThan(createAt);
  });

  it("sets on_behalf_of on follow-up checkout behind the care-plan kill switch", () => {
    const src = read("src/actions/follow-up.ts");
    const fn = src.slice(src.indexOf("export async function createInvitationCheckout"));
    expect(fn.indexOf("isCarePlansEnabled")).toBeGreaterThan(-1);
    expect(fn.indexOf("isCarePlansEnabled")).toBeLessThan(
      fn.indexOf("doctorCanAcceptConsultCardPayment")
    );
    expect(fn).toContain("on_behalf_of: doctor.stripe_account_id");
    expect(fn).toContain("destination: doctor.stripe_account_id");
  });

  it("sets on_behalf_of on admin consult payment links and checks capability before resend expiry", () => {
    const src = read("src/actions/admin.ts");
    expect(src.match(/on_behalf_of: doctor\.stripe_account_id/g)?.length).toBe(2);
    expect(src.match(/await doctorCanAcceptConsultCardPayment/g)?.length).toBe(2);

    const resend = src.slice(src.indexOf("export async function adminResendPaymentLink"));
    const gateAt = resend.indexOf("doctorCanAcceptConsultCardPayment");
    const expireAt = resend.indexOf("checkout.sessions.expire");
    const behalfAt = resend.indexOf("on_behalf_of:");
    expect(gateAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(expireAt);
    expect(behalfAt).toBeGreaterThan(expireAt);
  });

  it("sets on_behalf_of on the clinic reschedule balance PaymentIntent", () => {
    const src = read("src/actions/clinic-booking.ts");
    const gateAt = src.indexOf("await doctorCanAcceptConsultCardPayment");
    const createAt = src.indexOf("paymentIntents.create");
    expect(gateAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(gateAt);
    expect(src).toContain("on_behalf_of: newDoctor.stripe_account_id");
  });
});

describe("platform charges do not set on_behalf_of", () => {
  it("leaves subscriptions, annual plans, coupons, offers, wallet, and invoices alone", () => {
    for (const rel of [
      "src/actions/doctor.ts",
      "src/actions/license.ts",
      "src/actions/auth.ts",
      "src/actions/wallet.ts",
      "src/actions/coupon.ts",
      "src/actions/referral.ts",
      "src/actions/invoices.ts",
      "src/lib/gp/reassign.ts",
    ]) {
      expect(read(rel), rel).not.toContain("on_behalf_of");
    }
  });

  it("does not modify disabled treatment-plan checkout", () => {
    const src = read("src/actions/treatment-plan.ts");
    expect(src).not.toContain("on_behalf_of");
    expect(src).toContain("isCarePlansEnabled");
    expect(src).toContain("destination: doctor.stripe_account_id");
  });
});

describe("onboarding requests both capabilities", () => {
  it("requests card_payments and transfers on create, and card_payments again for existing accounts", () => {
    const doctor = read("src/actions/doctor.ts");
    expect(doctor).toContain("capabilities: EXPRESS_CONNECT_CAPABILITIES");
    expect(doctor).toContain("requestCardPaymentsIfNeeded");
    const createAt = doctor.indexOf("accounts.create");
    const existingAt = doctor.indexOf("await requestCardPaymentsIfNeeded");
    expect(createAt).toBeGreaterThan(-1);
    expect(existingAt).toBeGreaterThan(createAt);

    const payments = read(
      "src/app/[locale]/(doctor)/doctor-dashboard/payments/page.tsx"
    );
    expect(payments).toContain("requestCardPaymentsIfNeeded");
    const dashboard = read("src/app/[locale]/(doctor)/doctor-dashboard/page.tsx");
    expect(dashboard).toContain("requestCardPaymentsIfNeeded");
  });
});
