import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONSULT_PAYMENT_METHOD_TYPES,
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

/** Argument text of each `callee(` call, with strings and template braces ignored. */
function callArgs(src: string, callee: string): string[] {
  const args: string[] = [];
  let from = 0;
  while (from < src.length) {
    const at = src.indexOf(callee, from);
    if (at < 0) break;
    const paren = src.indexOf("(", at + callee.length);
    if (paren < 0) break;
    if (paren - (at + callee.length) > 5) {
      from = at + callee.length;
      continue;
    }
    args.push(sliceBalanced(src, paren));
    from = paren + 1;
  }
  return args;
}

function sliceBalanced(src: string, openIndex: number): string {
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const openCh = src[openIndex];
  const closeCh = pairs[openCh];
  let depth = 0;
  let i = openIndex;
  let quote: "'" | '"' | "`" | null = null;
  while (i < src.length) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (quote === "`" && ch === "$" && src[i + 1] === "{") {
        const inner = sliceBalanced(src, i + 1);
        i += 2 + inner.length;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl < 0 ? src.length : nl + 1;
      continue;
    }
    if (ch === openCh) depth += 1;
    if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) return src.slice(openIndex + 1, i);
    }
    i += 1;
  }
  throw new Error(`unbalanced ${openCh} at ${openIndex}`);
}

function enclosingFunction(src: string, index: number): string {
  const matches = [...src.slice(0, index).matchAll(/export async function (\w+)/g)];
  return matches.at(-1)?.[1] ?? "";
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

  it("expires a follow-up booking with the patient message when the doctor has no Stripe account", () => {
    const src = read("src/actions/follow-up.ts");
    const fn = src.slice(src.indexOf("export async function createInvitationCheckout"));
    const missingAt = fn.indexOf("if (!doctor.stripe_account_id)");
    const gateAt = fn.indexOf("await doctorCanAcceptConsultCardPayment");
    expect(missingAt).toBeGreaterThan(-1);
    expect(gateAt).toBeGreaterThan(missingAt);
    const branch = fn.slice(missingAt, gateAt);
    expect(branch).toContain("BOOKING_STATUSES.EXPIRED");
    expect(branch).toContain("DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE");
    expect(branch).not.toContain("Doctor payment setup is incomplete.");
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

  it("blocks the clinic reschedule balance when card_payments is inactive and does not set on_behalf_of", () => {
    // Platform charge with no transfer. Miles is converting this to a
    // destination charge separately; until then the doctor's name must not
    // appear on the statement. The capability check stays in front of it.
    const src = read("src/actions/clinic-booking.ts");
    const fn = src.slice(src.indexOf("export async function adminRescheduleBooking"));
    expect(fn).not.toContain("on_behalf_of");
    expect(fn).not.toContain("transfer_data");
    const gateAt = fn.indexOf("await doctorCanAcceptConsultCardPayment");
    const createAt = fn.indexOf("paymentIntents.create");
    expect(gateAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(gateAt);
    expect(fn.slice(gateAt, createAt)).toContain(
      "if (!merchant.ok) return { error: merchant.error }"
    );
  });

  it("does not debit or reserve a partial wallet when the capability check refuses the charge", () => {
    const booking = read("src/actions/booking.ts");
    const fn = booking.slice(
      booking.indexOf("export async function createBookingAndCheckout")
    );
    const gateAt = fn.indexOf("await doctorCanAcceptConsultCardPayment");
    const refusalEnd = fn.indexOf("return { error: merchant.error }");
    const partialReserve = fn.indexOf(
      ".update({ wallet_credit_applied_cents: walletCreditToApply })"
    );
    const debitAt = fn.indexOf("await debitWallet(");
    const walletOnlyAt = fn.indexOf("walletOnly: true");

    expect(debitAt).toBeGreaterThan(-1);
    expect(debitAt).toBeLessThan(walletOnlyAt);
    expect(walletOnlyAt).toBeLessThan(gateAt);
    expect(refusalEnd).toBeGreaterThan(gateAt);
    expect(partialReserve).toBeGreaterThan(refusalEnd);

    const refused = fn.slice(gateAt, refusalEnd);
    expect(refused).not.toContain("debitWallet");
    expect(refused).not.toContain("wallet_credit_applied_cents");

    for (const rel of [
      "src/actions/follow-up.ts",
      "src/actions/admin.ts",
      "src/actions/clinic-booking.ts",
      "src/actions/invoices.ts",
      "src/actions/treatment-plan.ts",
    ]) {
      const src = read(rel);
      const combinesWalletAndGate =
        src.includes("doctorCanAcceptConsultCardPayment") &&
        (src.includes("debitWallet") || src.includes("wallet_credit_applied_cents"));
      expect(combinesWalletAndGate, rel).toBe(false);
    }
  });
});

describe("consult charges are card-only", () => {
  it("exports payment method types as exactly card", () => {
    expect(CONSULT_PAYMENT_METHOD_TYPES).toEqual(["card"]);
  });

  it("sets payment_method_types to that list on every consult session and intent, and keeps on_behalf_of where it was set", () => {
    const cardOnly = /payment_method_types:\s*CONSULT_PAYMENT_METHOD_TYPES\b/;
    const behalf = "on_behalf_of: doctor.stripe_account_id";

    const bookingSrc = read("src/actions/booking.ts");
    const bookingCalls = callArgs(bookingSrc, "checkout.sessions.create");
    expect(bookingCalls).toHaveLength(1);
    expect(enclosingFunction(bookingSrc, bookingSrc.indexOf("checkout.sessions.create"))).toBe(
      "createBookingAndCheckout"
    );
    // Full payment, deposit, guest, and signed-in all share this one session.
    expect(bookingCalls[0]).toMatch(cardOnly);
    expect(bookingCalls[0]).toContain(behalf);
    expect(bookingCalls[0]).toContain('payment_mode: isDeposit ? "deposit" : "full"');
    expect(bookingCalls[0]).toContain('is_guest: isGuest ? "1" : "0"');
    expect(bookingCalls[0]).toContain("customer_email: guestEmail || undefined");
    expect(bookingCalls[0]).not.toContain("automatic_payment_methods");

    const followUpSrc = read("src/actions/follow-up.ts");
    const followUpAt = followUpSrc.indexOf("checkout.sessions.create");
    const followUpCalls = callArgs(followUpSrc, "checkout.sessions.create");
    expect(followUpCalls).toHaveLength(1);
    expect(enclosingFunction(followUpSrc, followUpAt)).toBe("createInvitationCheckout");
    expect(followUpCalls[0]).toMatch(cardOnly);
    expect(followUpCalls[0]).toContain(behalf);
    expect(followUpCalls[0]).not.toContain("automatic_payment_methods");

    const adminSrc = read("src/actions/admin.ts");
    const adminCalls = callArgs(adminSrc, "checkout.sessions.create");
    expect(adminCalls).toHaveLength(2);
    const adminFns = [...adminSrc.matchAll(/checkout\.sessions\.create/g)].map((match) =>
      enclosingFunction(adminSrc, match.index ?? -1)
    );
    expect(adminFns).toEqual(["adminCreateBookingOnBehalf", "adminResendPaymentLink"]);
    for (const arg of adminCalls) {
      expect(arg).toMatch(cardOnly);
      expect(arg).toContain(behalf);
      expect(arg).not.toContain("automatic_payment_methods");
    }

    const clinicSrc = read("src/actions/clinic-booking.ts");
    const clinicAt = clinicSrc.indexOf("paymentIntents.create");
    const clinicCalls = callArgs(clinicSrc, "paymentIntents.create");
    expect(clinicCalls).toHaveLength(1);
    expect(enclosingFunction(clinicSrc, clinicAt)).toBe("adminRescheduleBooking");
    expect(clinicCalls[0]).toMatch(cardOnly);
    expect(clinicCalls[0]).not.toContain("on_behalf_of");
    expect(clinicCalls[0]).not.toContain("automatic_payment_methods");
  });

  it("leaves non-consult checkouts on dynamic payment methods", () => {
    for (const rel of [
      "src/actions/doctor.ts",
      "src/actions/license.ts",
      "src/actions/auth.ts",
      "src/actions/wallet.ts",
      "src/actions/coupon.ts",
      "src/actions/referral.ts",
      "src/actions/invoices.ts",
      "src/actions/treatment-plan.ts",
      "src/lib/gp/reassign.ts",
    ]) {
      const src = read(rel);
      expect(src, rel).not.toContain("CONSULT_PAYMENT_METHOD_TYPES");
      expect(src, rel).not.toMatch(/payment_method_types\s*:/);
    }
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
