import { describe, expect, it } from "vitest";
import { formatGbpFromPence, firstYearPence } from "@/lib/offers/money";
import {
  endOfLondonDay,
  formatOfferDate,
  noticeDueAt,
  priceNoticeDue,
  priceSwitchAt,
  trialEndFrom,
  trialReminderDue,
} from "@/lib/offers/dates";
import { renderOfferCopy } from "@/lib/offers/template";
import {
  LIVE_LICENCE_ERROR,
  liveLicenceBlocksCheckout,
  offerConflictsWithFoundingFree,
  validateOfferDraft,
  validateOfferForCheckout,
  type CheckoutOffer,
} from "@/lib/offers/validation";
import { buildOfferCheckoutFields } from "@/lib/offers/checkout";
import { decideSubscriptionCancel, stripeCancelParams } from "@/lib/offers/cancel";
import {
  deliverIdempotentServiceEmail,
  priceChangeNoticeKey,
  suppressedAuditKey,
  trialReminderKey,
  type ServiceEmailLog,
} from "@/lib/offers/email-idempotency";
import {
  isUniqueLicenceConflict,
  orphanedOfferAuditRow,
} from "@/lib/offers/orphan-offer-alert";
import { chooseServiceRecipient, isServiceEmailRecipientAllowed } from "@/lib/offers/allowlist";
import { isOfferAdminEmail, parseOfferAdminEmails } from "@/lib/offers/admin-auth";
import { assertStripeTestSecret } from "@/lib/offers/stripe-mode";
import { EXAMPLE_OFFERS } from "@/lib/offers/examples";
import { fallbackAnnualPence, pickAnnualAmountPence } from "@/lib/offers/current-price";
import {
  INVITE_USED_ERROR,
  SECOND_OFFER_ERROR,
  attributionClaimOutcome,
  refuseUsedInvite,
  runCheckoutAfterAttributionClaim,
} from "@/lib/offers/attribution-claim";
import { unitAmountPence } from "@/lib/offers/subscription-price";
import {
  assertInviteSendsNoEmail,
  specialtyBenefitsEmailHook,
} from "@/lib/offers/specialty-benefits-email";

const NOW = new Date("2026-09-26T12:00:00.000Z");
const REDEEM = new Date("2026-12-31T23:59:59.000Z");

function percentOffer(overrides: Partial<CheckoutOffer> = {}): CheckoutOffer {
  return {
    id: "offer-50",
    kind: "percent_first_year",
    percentOff: 50,
    trialDays: null,
    eligiblePlans: ["starter_annual", "professional_annual"],
    redeemBy: REDEEM,
    active: true,
    stripePromotionCodeId: "promo_test",
    ...overrides,
  };
}

describe("offer validation", () => {
  it("accepts a 50% first-year offer on annual Solo and Pro", () => {
    const result = validateOfferDraft({
      name: "50% off first year",
      kind: "percent_first_year",
      percentOff: 50,
      trialDays: null,
      eligiblePlans: ["starter_annual", "professional_annual"],
      redeemBy: REDEEM,
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects clinic plans and monthly plans", () => {
    const clinic = validateOfferDraft({
      name: "Clinic deal",
      kind: "percent_first_year",
      percentOff: 50,
      trialDays: null,
      eligiblePlans: ["clinic"],
      redeemBy: REDEEM,
      now: NOW,
    });
    expect(clinic.ok).toBe(false);
    if (!clinic.ok) expect(clinic.code).toBe("clinic_excluded");

    const monthly = validateOfferDraft({
      name: "Monthly deal",
      kind: "percent_first_year",
      percentOff: 25,
      trialDays: null,
      eligiblePlans: ["starter"],
      redeemBy: REDEEM,
      now: NOW,
    });
    expect(monthly.ok).toBe(false);
    if (!monthly.ok) expect(monthly.code).toBe("not_annual");
  });

  it("rejects a percent offer without a percent and a trial without days", () => {
    const percent = validateOfferDraft({
      name: "Broken percent",
      kind: "percent_first_year",
      percentOff: null,
      trialDays: null,
      eligiblePlans: ["starter_annual"],
      redeemBy: REDEEM,
      now: NOW,
    });
    expect(percent.ok).toBe(false);
    if (!percent.ok) expect(percent.code).toBe("percent_required");

    const trial = validateOfferDraft({
      name: "Broken trial",
      kind: "free_trial",
      percentOff: null,
      trialDays: null,
      eligiblePlans: ["professional_annual"],
      redeemBy: REDEEM,
      now: NOW,
    });
    expect(trial.ok).toBe(false);
    if (!trial.ok) expect(trial.code).toBe("trial_required");
  });

  it("rejects a redeem-by date in the past", () => {
    const result = validateOfferDraft({
      name: "Expired",
      kind: "free_trial",
      percentOff: null,
      trialDays: 90,
      eligiblePlans: ["starter_annual"],
      redeemBy: new Date("2026-01-01T00:00:00.000Z"),
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("expired");
  });

  it("documents the three example offers as valid drafts", () => {
    for (const example of EXAMPLE_OFFERS) {
      const result = validateOfferDraft({
        name: example.name,
        kind: example.kind,
        percentOff: example.percentOff,
        trialDays: example.trialDays,
        eligiblePlans: example.eligiblePlans,
        redeemBy: REDEEM,
        now: NOW,
      });
      expect(result.ok).toBe(true);
    }
  });
});

describe("one offer per doctor", () => {
  const base = {
    offer: percentOffer(),
    planId: "starter_annual",
    now: NOW,
    foundingFree: false,
    existingOfferId: null,
    extraPromotionCode: null,
  };

  it("rejects a second promotion code when an offer is attached", () => {
    const result = validateOfferForCheckout({
      ...base,
      extraPromotionCode: "FOUNDING",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("second_code");
  });

  it("rejects a different offer already on the account", () => {
    const result = validateOfferForCheckout({
      ...base,
      existingOfferId: "offer-other",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("second_offer");
  });

  it("rejects the same offer once it is already attached", () => {
    const result = validateOfferForCheckout({
      ...base,
      existingOfferId: "offer-50",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("second_offer");
  });

  it("rejects Founding Free, including an explicit free tier", () => {
    const stacked = validateOfferForCheckout({ ...base, foundingFree: true });
    expect(stacked.ok).toBe(false);
    if (!stacked.ok) expect(stacked.code).toBe("founding_free");
    expect(
      offerConflictsWithFoundingFree({
        tier: "free",
        foundingMember: false,
      })
    ).toBe(true);
    expect(
      offerConflictsWithFoundingFree({
        tier: "starter",
        foundingMember: true,
        licenseTier: "professional",
      })
    ).toBe(true);
    expect(
      offerConflictsWithFoundingFree({
        tier: "starter",
        foundingMember: false,
        licenseTier: "starter",
      })
    ).toBe(false);
  });
});

describe("offer copy", () => {
  const solo = fallbackAnnualPence("starter");
  const pro = fallbackAnnualPence("professional");

  it("formats first-year pounds from the price catalogue", () => {
    expect(solo).toBe(199000);
    expect(pro).toBe(299000);
    expect(formatGbpFromPence(solo)).toBe("£1,990");
    expect(formatGbpFromPence(pro)).toBe("£2,990");
    expect(formatGbpFromPence(firstYearPence(solo, 50))).toBe("£995");
    expect(formatGbpFromPence(firstYearPence(pro, 50))).toBe("£1,495");
    expect(formatGbpFromPence(firstYearPence(solo, 25))).toBe("£1,492.50");
    expect(formatGbpFromPence(firstYearPence(pro, 25))).toBe("£2,242.50");
    expect(pickAnnualAmountPence(210000, solo)).toBe(210000);
    expect(pickAnnualAmountPence(null, solo)).toBe(199000);
  });

  it("renders the legal percent template", () => {
    const copy = renderOfferCopy({
      kind: "percent_first_year",
      percentOff: 50,
      trialDays: null,
      redeemBy: new Date("2026-09-26T12:00:00.000Z"),
      trialStartsAt: NOW,
      soloFullPence: solo,
      proFullPence: pro,
    });
    expect(copy.emphasis).toBe("50% off your first year.");
    expect(copy.body).toBe(
      "Annual Solo is £995 for year one, then renews automatically at £1,990 a year unless you cancel. Annual Pro is £1,495 for year one, then renews automatically at £2,990 a year unless you cancel."
    );
    expect(copy.redeemLine).toBe(
      "Redeem by Saturday 26 September 2026. Prices exclude VAT."
    );
    expect(copy.smallPrint).toBe(
      "For business customers only. One code per account. Can't be combined with Founding Free. No cash value."
    );
  });

  it("renders the legal trial template with a London date", () => {
    const copy = renderOfferCopy({
      kind: "free_trial",
      percentOff: null,
      trialDays: 90,
      redeemBy: new Date("2026-09-26T12:00:00.000Z"),
      trialStartsAt: NOW,
      soloFullPence: solo,
      proFullPence: pro,
    });
    const trialEnd = formatOfferDate(trialEndFrom(NOW, 90));
    expect(trialEnd).toBe("Friday 25 December 2026");
    expect(copy.emphasis).toBe("Free until Friday 25 December 2026.");
    expect(copy.body).toContain(
      "We'll charge £1,990 (Solo) or £2,990 (Pro) on Friday 25 December 2026"
    );
    expect(copy.body).toContain("We'll email you 7 days before.");
  });

  it("formats dates in Europe/London", () => {
    expect(formatOfferDate(new Date("2026-09-26T12:00:00.000Z"))).toBe(
      "Saturday 26 September 2026"
    );
    expect(formatOfferDate(new Date("2026-09-25T23:30:00.000Z"))).toBe(
      "Saturday 26 September 2026"
    );
    expect(formatOfferDate(new Date("2026-09-26T23:30:00.000Z"))).toBe(
      "Sunday 27 September 2026"
    );
    const end = endOfLondonDay("2026-09-26");
    expect(end).not.toBeNull();
    expect(formatOfferDate(end!)).toBe("Saturday 26 September 2026");
  });
});

describe("checkout fields", () => {
  const common = {
    priceId: "price_annual",
    organizationId: "org",
    doctorId: "doc",
    tier: "starter",
    planId: "starter_annual",
    inviteId: "inv",
    specialtySlug: "cardiology",
    seatCount: "1",
    maxSeats: "1",
  };

  it("collects a card and applies a once-duration promotion code without a second code box", () => {
    const fields = buildOfferCheckoutFields({
      ...common,
      offer: percentOffer(),
    });
    expect(fields.payment_method_collection).toBe("always");
    expect(fields.allow_promotion_codes).toBeUndefined();
    expect(fields.discounts).toEqual([{ promotion_code: "promo_test" }]);
    expect(fields.subscription_data.metadata.billing_period).toBe("annual");
    expect(fields.subscription_data.metadata.offer_id).toBe("offer-50");
    expect(fields.metadata.attribution_specialty).toBe("cardiology");
  });

  it("puts trial days on the subscription and disables promotion codes", () => {
    const fields = buildOfferCheckoutFields({
      ...common,
      offer: percentOffer({
        id: "offer-trial",
        kind: "free_trial",
        percentOff: null,
        trialDays: 90,
        stripePromotionCodeId: null,
      }),
    });
    expect(fields.allow_promotion_codes).toBe(false);
    expect(fields.discounts).toBeUndefined();
    expect(fields.subscription_data.trial_period_days).toBe(90);
    expect(fields.payment_method_collection).toBe("always");
  });
});

describe("cancel behaviour", () => {
  const periodEnd = "2027-09-26T12:00:00.000Z";
  const trialEnd = "2026-12-25T12:00:00.000Z";

  it("ends a trial with no charge and no refund", () => {
    const decision = decideSubscriptionCancel({
      tier: "starter",
      status: "trialing",
      billingPeriod: "annual",
      offerId: "offer-trial",
      trialEndsAt: trialEnd,
      periodEnd,
      cancelAtPeriodEnd: false,
    });
    expect(decision.action).toBe("cancel_at_trial_end");
    if (decision.action === "cancel_at_trial_end") {
      expect(decision.refund).toBe(false);
      expect(decision.accessEndsAt).toBe(trialEnd);
      expect(stripeCancelParams(decision)).toEqual({
        cancel_at: Math.floor(new Date(trialEnd).getTime() / 1000),
        proration_behavior: "none",
      });
    }
  });

  it("keeps a paid annual year until period end with no refund and no renewal", () => {
    const decision = decideSubscriptionCancel({
      tier: "professional",
      status: "active",
      billingPeriod: "annual",
      offerId: "offer-50",
      trialEndsAt: null,
      periodEnd,
      cancelAtPeriodEnd: false,
    });
    expect(decision.action).toBe("cancel_at_period_end");
    if (decision.action === "cancel_at_period_end") {
      expect(decision.refund).toBe(false);
      expect(decision.accessEndsAt).toBe(periodEnd);
      expect(stripeCancelParams(decision)).toEqual({
        cancel_at_period_end: true,
        proration_behavior: "none",
      });
    }
  });

  it("leaves annual plans that have no offer on the existing billing path", () => {
    expect(
      decideSubscriptionCancel({
        tier: "starter",
        status: "active",
        billingPeriod: "annual",
        offerId: null,
        trialEndsAt: null,
        periodEnd,
        cancelAtPeriodEnd: false,
      }).action
    ).toBe("unchanged");
  });

  it("does not change monthly or Founding Free cancellation", () => {
    expect(
      decideSubscriptionCancel({
        tier: "starter",
        status: "active",
        billingPeriod: "monthly",
        offerId: null,
        trialEndsAt: null,
        periodEnd,
        cancelAtPeriodEnd: false,
      }).action
    ).toBe("unchanged");
    expect(
      decideSubscriptionCancel({
        tier: "free",
        status: "active",
        billingPeriod: null,
        offerId: null,
        trialEndsAt: null,
        periodEnd,
        cancelAtPeriodEnd: false,
      }).action
    ).toBe("unchanged");
    expect(stripeCancelParams({ action: "unchanged", reason: "no" })).toBeNull();
  });
});

describe("price change timing", () => {
  it("switches at the next renewal when it is at least 30 days away", () => {
    const periodEnd = new Date("2026-11-26T12:00:00.000Z");
    const switchAt = priceSwitchAt(periodEnd, NOW);
    expect(switchAt.toISOString()).toBe(periodEnd.toISOString());
    const due = noticeDueAt(switchAt);
    expect(due.toISOString()).toBe("2026-10-27T12:00:00.000Z");
    expect(priceNoticeDue(due, switchAt, new Date("2026-10-27T12:00:00.000Z"))).toBe(true);
    expect(priceNoticeDue(due, switchAt, new Date("2026-10-01T12:00:00.000Z"))).toBe(false);
  });

  it("waits a further year when the next renewal is inside 30 days", () => {
    const periodEnd = new Date("2026-10-01T12:00:00.000Z");
    const switchAt = priceSwitchAt(periodEnd, NOW);
    expect(switchAt.toISOString()).toBe("2027-10-01T12:00:00.000Z");
    expect(switchAt.getTime() - NOW.getTime()).toBeGreaterThanOrEqual(
      30 * 24 * 60 * 60 * 1000
    );
  });
});

describe("idempotent service emails", () => {
  function memoryLog(): ServiceEmailLog & { rows: Map<string, string>; sends: string[] } {
    const rows = new Map<string, string>();
    return {
      rows,
      sends: [],
      async claim(row) {
        if (rows.has(row.idempotencyKey)) return "duplicate";
        rows.set(row.idempotencyKey, "pending");
        return "claimed";
      },
      async complete(key, status) {
        rows.set(key, status);
      },
      async release(key) {
        if (rows.get(key) === "pending") rows.delete(key);
      },
      async recordSuppressed(row) {
        const auditKey = suppressedAuditKey(row.idempotencyKey, new Date("2026-09-26T12:00:00.000Z"));
        rows.set(auditKey, "suppressed");
      },
    };
  }

  it("sends once and ignores a retry", async () => {
    const log = memoryLog();
    const send = async (input: { to: string }) => {
      log.sends.push(input.to);
      return { success: true };
    };
    const claim = {
      idempotencyKey: trialReminderKey("sub_1"),
      eventKind: "trial_reminder_7d" as const,
      stripeSubscriptionId: "sub_1",
      recipientEmail: "dbd.demo.email@gmail.com",
    };
    expect(
      await deliverIdempotentServiceEmail(log, send, {
        claim,
        allowed: true,
        subject: "Trial",
        html: "<p>Trial</p>",
      })
    ).toBe("sent");
    expect(
      await deliverIdempotentServiceEmail(log, send, {
        claim,
        allowed: true,
        subject: "Trial",
        html: "<p>Trial</p>",
      })
    ).toBe("duplicate");
    expect(log.sends).toEqual(["dbd.demo.email@gmail.com"]);
    expect(log.rows.get(trialReminderKey("sub_1"))).toBe("sent");
  });

  it("suppresses anyone outside the Softsmoke allowlist without blocking a later send", async () => {
    const log = memoryLog();
    const send = async (input: { to: string }) => {
      log.sends.push(input.to);
      return { success: true };
    };
    const claim = {
      idempotencyKey: priceChangeNoticeKey("sched_1"),
      eventKind: "price_change_30d" as const,
      stripeSubscriptionId: "sub_1",
      recipientEmail: "doctor@example.com",
    };
    expect(
      await deliverIdempotentServiceEmail(log, send, {
        claim,
        allowed: false,
        subject: "Price",
        html: "<p>Price</p>",
      })
    ).toBe("suppressed");
    const sendKey = priceChangeNoticeKey("sched_1");
    expect(log.rows.get(sendKey)).toBeUndefined();
    expect(log.rows.get(suppressedAuditKey(sendKey, new Date("2026-09-26T12:00:00.000Z")))).toBe(
      "suppressed"
    );
    expect(
      await deliverIdempotentServiceEmail(log, send, {
        claim: { ...claim, recipientEmail: "dbd.demo.email@gmail.com" },
        allowed: true,
        subject: "Price",
        html: "<p>Price</p>",
      })
    ).toBe("sent");
    expect(log.sends).toEqual(["dbd.demo.email@gmail.com"]);
  });

  it("releases a failed send so a later run can deliver once", async () => {
    const log = memoryLog();
    let attempts = 0;
    const send = async () => {
      attempts += 1;
      return { success: attempts > 1 };
    };
    const claim = {
      idempotencyKey: trialReminderKey("sub_2"),
      eventKind: "trial_reminder_7d" as const,
      stripeSubscriptionId: "sub_2",
      recipientEmail: "dbd.demo.email@gmail.com",
    };
    expect(
      await deliverIdempotentServiceEmail(log, send, {
        claim,
        allowed: true,
        subject: "Trial",
        html: "<p></p>",
      })
    ).toBe("failed");
    expect(
      await deliverIdempotentServiceEmail(log, send, {
        claim,
        allowed: true,
        subject: "Trial",
        html: "<p></p>",
      })
    ).toBe("sent");
    expect(attempts).toBe(2);
  });

  it("only allows the Softsmoke tester address", () => {
    expect(isServiceEmailRecipientAllowed("dbd.demo.email@gmail.com")).toBe(true);
    expect(isServiceEmailRecipientAllowed("DBD.demo.email@gmail.com")).toBe(true);
    expect(isServiceEmailRecipientAllowed("doctor@clinic.example")).toBe(false);
    expect(
      chooseServiceRecipient(["doctor@clinic.example", "dbd.demo.email@gmail.com"])
    ).toEqual({ to: "dbd.demo.email@gmail.com", allowed: true });
    expect(chooseServiceRecipient(["doctor@clinic.example"])).toEqual({
      to: "doctor@clinic.example",
      allowed: false,
    });
  });

  it("sends the trial reminder only inside the 7-day window", () => {
    const trialEnd = new Date("2026-12-25T12:00:00.000Z");
    expect(trialReminderDue(trialEnd, new Date("2026-12-18T12:00:00.000Z"))).toBe(true);
    expect(trialReminderDue(trialEnd, new Date("2026-12-10T12:00:00.000Z"))).toBe(false);
    expect(trialReminderDue(trialEnd, trialEnd)).toBe(false);
  });
});

describe("one live licence per practice", () => {
  it("refuses checkout when the practice already has a paying licence", () => {
    expect(liveLicenceBlocksCheckout([{ status: "active" }])).toBe(LIVE_LICENCE_ERROR);
    expect(liveLicenceBlocksCheckout([{ status: "trialing" }])).toBe(LIVE_LICENCE_ERROR);
    expect(liveLicenceBlocksCheckout([{ status: "past_due" }])).toBe(LIVE_LICENCE_ERROR);
    expect(
      liveLicenceBlocksCheckout([
        { status: "cancelled" },
        { status: "active" },
      ])
    ).toBe(LIVE_LICENCE_ERROR);
  });

  it("allows checkout when the practice has no live licence", () => {
    expect(liveLicenceBlocksCheckout([])).toBeNull();
    expect(liveLicenceBlocksCheckout([{ status: "cancelled" }])).toBeNull();
    expect(liveLicenceBlocksCheckout([{ status: "incomplete" }])).toBeNull();
    expect(liveLicenceBlocksCheckout([{ status: null }])).toBeNull();
  });
});

describe("orphaned offer subscription admin flag", () => {
  it("treats a unique-index failure as an admin flag", () => {
    expect(isUniqueLicenceConflict({ code: "23505", message: "duplicate key" })).toBe(true);
    expect(
      isUniqueLicenceConflict({
        message: 'duplicate key value violates unique constraint "idx_licenses_one_live_offer_per_org"',
      })
    ).toBe(true);
    expect(isUniqueLicenceConflict({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isUniqueLicenceConflict(null)).toBe(false);
  });

  it("writes an audit row an admin can find", () => {
    const row = orphanedOfferAuditRow(
      "11111111-1111-1111-1111-111111111111",
      "AUDIT_SYSTEM_ACTOR_ID",
      {
        organizationId: "22222222-2222-2222-2222-222222222222",
        subscriptionId: "sub_live",
        offerId: "offer-50",
        detail: "duplicate key",
      }
    );
    expect(row.action).toBe("offer_subscription_orphaned");
    expect(row.target_type).toBe("organization");
    expect(row.target_id).toBe("22222222-2222-2222-2222-222222222222");
    expect(row.metadata.stripe_subscription_id).toBe("sub_live");
    expect(row.metadata.actor_kind).toBe("system");
  });
});

describe("one offer claim before Stripe", () => {
  it("refuses a second offer on unique violation and does not create Checkout", async () => {
    const calls: string[] = [];
    await expect(
      runCheckoutAfterAttributionClaim({
        claim: async () => {
          calls.push("claim");
          return attributionClaimOutcome({
            errorCode: "23505",
            existing: { inviteId: "invite-a", offerId: "offer-50", doctorId: "doc-1" },
            attempted: { inviteId: "invite-b", offerId: "offer-25", doctorId: "doc-1" },
          });
        },
        createSession: async () => {
          calls.push("stripe");
          return { checkoutUrl: "https://checkout.stripe.com/test" };
        },
      })
    ).rejects.toThrow(SECOND_OFFER_ERROR);
    expect(calls).toEqual(["claim"]);
  });

  it("allows the same invite to resume checkout after the row already exists", () => {
    const outcome = attributionClaimOutcome({
      errorCode: "23505",
      existing: { inviteId: "invite-a", offerId: "offer-50", doctorId: "doc-1" },
      attempted: { inviteId: "invite-a", offerId: "offer-50", doctorId: "doc-1" },
    });
    expect(outcome.ok).toBe(true);
  });

  it("refuses a signup link that has already been used", () => {
    expect(refuseUsedInvite(null)).toBeNull();
    expect(refuseUsedInvite("2026-09-26T12:00:00.000Z")).toBe(INVITE_USED_ERROR);
  });
});

describe("trial reminder price", () => {
  it("quotes the subscription unit amount, not a missing catalogue price", () => {
    expect(unitAmountPence(149_500)).toBe(149_500);
    expect(unitAmountPence(null)).toBeNull();
    expect(unitAmountPence(0)).toBeNull();
  });
});

describe("founder gate and Stripe test mode", () => {
  it("denies an empty offer-admin allowlist", () => {
    expect(parseOfferAdminEmails(" Founder@Example.com , other@example.com ")).toEqual([
      "founder@example.com",
      "other@example.com",
    ]);
    expect(isOfferAdminEmail("founder@example.com", [])).toBe(false);
    expect(isOfferAdminEmail("founder@example.com", ["founder@example.com"])).toBe(true);
    expect(isOfferAdminEmail("nope@example.com", ["founder@example.com"])).toBe(false);
  });

  it("refuses live Stripe keys", () => {
    expect(() => assertStripeTestSecret("sk_live_abc")).toThrow(/sk_test_/);
    expect(() => assertStripeTestSecret(undefined)).toThrow(/sk_test_/);
    expect(() => assertStripeTestSecret("sk_test_abc")).not.toThrow();
  });

  it("does not send the specialty benefits email", () => {
    const hook = specialtyBenefitsEmailHook({
      specialtySlug: "cardiology",
      doctorEmail: "doctor@example.com",
      offerId: "offer-50",
    });
    expect(hook).toEqual({ send: false, reason: "not_drafted" });
    expect(() => assertInviteSendsNoEmail(hook)).not.toThrow();
    expect(() => assertInviteSendsNoEmail({ send: true })).toThrow(/must not send/);
  });
});
