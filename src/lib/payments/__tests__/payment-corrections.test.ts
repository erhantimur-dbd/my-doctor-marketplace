import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOCTOR_PAYMENT_ERROR_NOTICE,
  PATIENT_PAYMENT_ERROR_NOTICE,
  checkoutSubmitNotice,
  paymentErrorNoticesEnabled,
  termsClausePath,
} from "@/lib/legal/payment-error-notices";
import {
  CORRECTION_MONEY_ACTIONS,
  type CorrectionGuardState,
  approvalsSatisfied,
  assertCanRecreateFounding,
  assertCanSetClearRisk,
  assertMoneyMovement,
  assertNoOpenDispute,
  assertWithinTwelveMonths,
  distinctApprovalCount,
  hasDirectorApproval,
} from "@/lib/payments/correction-guards";
import {
  destinationFeeWithOffset,
  offsetRestoreCents,
  transferAmountWithOffset,
} from "@/lib/payments/payout-offset";
import {
  planOffsetReserve,
  reserveDoctorOffsetCents,
  type OffsetRow,
} from "@/lib/payments/payout-offset-store";
import { correctionReversalIdempotencyKey } from "@/lib/payments/correction-execute";
import { consultCardClawbackIdempotencyKey } from "@/lib/stripe/consult-refund";
import { paymentCorrectionNoticeEmail } from "@/lib/email/payment-correction-notice";
import {
  licenseStatusKeepingFounding,
  shouldForfeitFoundingOnDelete,
  shouldSkipFoundingEnforcement,
} from "@/lib/payments/founding-our-error";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

function state(overrides: Partial<CorrectionGuardState> = {}): CorrectionGuardState {
  return {
    party: "doctor",
    direction: "platform_favour",
    createdBy: "creator",
    requiredApprovals: 1,
    approvals: [{ approverId: "approver", inAllowlist: true, director: false }],
    noticeSentAt: "2026-01-01T00:00:00.000Z",
    earliestRecoveryAt: "2026-01-15T00:00:00.000Z",
    clearRisk: false,
    escalatedByDoctorAt: null,
    disputeOpen: false,
    disputeOutcome: null,
    reversalOutcome: "short",
    offsetUncollectible: true,
    patientConsentRecorded: false,
    nowIso: "2026-01-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("payment error notices stay off until Legal publishes", () => {
  it("is off unless the env is exactly true or 1", () => {
    const previous = process.env.PAYMENT_ERROR_NOTICES;
    delete process.env.PAYMENT_ERROR_NOTICES;
    expect(paymentErrorNoticesEnabled()).toBe(false);
    process.env.PAYMENT_ERROR_NOTICES = "";
    expect(paymentErrorNoticesEnabled()).toBe(false);
    process.env.PAYMENT_ERROR_NOTICES = "false";
    expect(paymentErrorNoticesEnabled()).toBe(false);
    process.env.PAYMENT_ERROR_NOTICES = "true";
    expect(paymentErrorNoticesEnabled()).toBe(true);
    expect(checkoutSubmitNotice("patient", "https://example.com", "en")).toEqual({
      submit: {
        message: `${PATIENT_PAYMENT_ERROR_NOTICE} https://example.com/en/terms#payment-errors`,
      },
    });
    expect(termsClausePath("doctor")).toBe("/terms#doctor-payment-errors");
    expect(DOCTOR_PAYMENT_ERROR_NOTICE).toContain("Doctor terms");
    if (previous === undefined) delete process.env.PAYMENT_ERROR_NOTICES;
    else process.env.PAYMENT_ERROR_NOTICES = previous;
  });
});

describe("correction guards", () => {
  it("excludes the creator and counts distinct allowlisted approvers", () => {
    expect(
      distinctApprovalCount({
        createdBy: "creator",
        approvals: [
          { approverId: "creator", inAllowlist: true, director: true },
          { approverId: "a", inAllowlist: true, director: false },
          { approverId: "a", inAllowlist: true, director: false },
          { approverId: "outsider", inAllowlist: false, director: true },
        ],
      })
    ).toBe(1);
    expect(
      approvalsSatisfied(
        state({
          requiredApprovals: 2,
          approvals: [
            { approverId: "a", inAllowlist: true, director: false },
            { approverId: "b", inAllowlist: true, director: false },
          ],
        })
      )
    ).toBe(true);
    expect(
      approvalsSatisfied(
        state({
          requiredApprovals: 1,
          escalatedByDoctorAt: "2026-01-02T00:00:00.000Z",
          approvals: [{ approverId: "a", inAllowlist: true, director: false }],
        })
      )
    ).toBe(false);
    expect(
      hasDirectorApproval({
        createdBy: "creator",
        approvals: [{ approverId: "director", inAllowlist: true, director: true }],
      })
    ).toBe(true);
  });

  it("limits clear risk to doctor corrections with a code and a written reason", () => {
    expect(() =>
      assertCanSetClearRisk({
        party: "patient",
        actorIsApprover: true,
        reasonCode: "account_closing",
        reason: "Stripe restricted the account",
      })
    ).toThrow(/doctor/);
    expect(() =>
      assertCanSetClearRisk({
        party: "doctor",
        actorIsApprover: true,
        reasonCode: "other",
        reason: "because",
      })
    ).toThrow(/code/);
    expect(() =>
      assertCanSetClearRisk({
        party: "doctor",
        actorIsApprover: true,
        reasonCode: "insolvency",
        reason: "   ",
      })
    ).toThrow(/reason/);
    expect(() =>
      assertCanSetClearRisk({
        party: "doctor",
        actorIsApprover: false,
        reasonCode: "suspected_fraud",
        reason: "pattern",
      })
    ).toThrow(/approver/);
  });

  it("skips only the 14-day wait under clear risk, and still waits for notice", () => {
    expect(() =>
      assertMoneyMovement(
        state({
          clearRisk: true,
          earliestRecoveryAt: "2026-02-01T00:00:00.000Z",
          nowIso: "2026-01-02T00:00:00.000Z",
          reversalOutcome: null,
        }),
        "transfer_reversal"
      )
    ).not.toThrow();
    expect(() =>
      assertMoneyMovement(
        state({ clearRisk: true, noticeSentAt: null, reversalOutcome: null }),
        "transfer_reversal"
      )
    ).toThrow(/notice/);
  });

  it("takes a patient wallet debit only after recorded consent", () => {
    const patient = state({
      party: "patient",
      direction: "platform_favour",
      reversalOutcome: null,
      offsetUncollectible: false,
    });
    expect(() => assertMoneyMovement(patient, "wallet_debit")).toThrow(/consent/);
    expect(() =>
      assertMoneyMovement({ ...patient, patientConsentRecorded: true }, "wallet_debit")
    ).not.toThrow();
    expect(() => assertMoneyMovement(patient, "direct_request")).not.toThrow();
    expect(() => assertMoneyMovement(patient, "transfer_reversal")).toThrow(/direct request/);
  });

  it("leaves patient-favour refund and wallet credit unchanged", () => {
    const favour = state({
      party: "patient",
      direction: "customer_favour",
      noticeSentAt: null,
      patientConsentRecorded: false,
    });
    expect(() => assertMoneyMovement(favour, "patient_refund")).not.toThrow();
    expect(() => assertMoneyMovement(favour, "wallet_credit")).not.toThrow();
  });

  it("pauses the whole correction while a dispute is open", () => {
    const open = state({ disputeOpen: true, reversalOutcome: null });
    expect(() => assertNoOpenDispute(open)).toThrow(/pauses/);
    expect(() => assertMoneyMovement(open, "transfer_reversal")).toThrow(/pauses/);
    expect(() => assertMoneyMovement(open, "doctor_topup")).toThrow(/pauses/);
    expect(() =>
      assertMoneyMovement(
        state({
          direction: "platform_favour",
          disputeOpen: false,
          disputeOutcome: "customer_wins",
        }),
        "doctor_topup"
      )
    ).not.toThrow();
  });

  it("keeps the doctor recovery order", () => {
    expect(() =>
      assertMoneyMovement(state({ reversalOutcome: null }), "payout_offset")
    ).toThrow(/reversal/);
    expect(() =>
      assertMoneyMovement(state({ offsetUncollectible: false }), "direct_request")
    ).toThrow(/offset/);
  });

  it("rejects payments older than 12 months unless the type is fraud", () => {
    const paid = new Date("2024-01-01T00:00:00.000Z");
    const raised = new Date("2026-01-02T00:00:00.000Z");
    expect(() =>
      assertWithinTwelveMonths({
        errorType: "other",
        relatedPaymentAt: paid,
        createdAt: raised,
      })
    ).toThrow(/12 months/);
    expect(() =>
      assertWithinTwelveMonths({
        errorType: "fraud",
        relatedPaymentAt: paid,
        createdAt: raised,
      })
    ).not.toThrow();
  });

  it("recreates founding only for an approved our-error doctor who already has a place", () => {
    expect(() =>
      assertCanRecreateFounding({
        actorIsApprover: true,
        approvalsMet: true,
        ourError: true,
        party: "doctor",
        hasFoundingNumber: true,
        disputeOpen: false,
      })
    ).not.toThrow();
    expect(() =>
      assertCanRecreateFounding({
        actorIsApprover: true,
        approvalsMet: true,
        ourError: false,
        party: "doctor",
        hasFoundingNumber: true,
        disputeOpen: false,
      })
    ).toThrow(/our-error/);
  });
});

describe("offset, reversal, and notice copy", () => {
  it("reserves nothing once an approved correction is disputed", async () => {
    const now = "2026-02-01T00:00:00.000Z";
    const approved: OffsetRow = {
      id: "c1",
      offsetRemainingCents: 0,
      recoveryStep: 2,
      noticeSentAt: "2026-01-01T00:00:00.000Z",
      earliestRecoveryAt: "2026-01-15T00:00:00.000Z",
      clearRisk: false,
      disputeOpen: false,
      requiredApprovals: 1,
      createdBy: "creator",
      approvals: [{ approverId: "approver", inAllowlist: true, director: false }],
      escalatedByDoctorAt: null,
      reversalShortOrFailed: true,
    };
    const held = [
      { correctionId: "c1", amountCents: 400, status: "reserved" as const },
    ];
    expect(
      planOffsetReserve({ rows: [approved], holds: held, maxCents: 1000, nowIso: now })
        .cents
    ).toBe(400);

    const disputed = planOffsetReserve({
      rows: [{ ...approved, disputeOpen: true }],
      holds: held,
      maxCents: 1000,
      nowIso: now,
    });
    expect(disputed.cents).toBe(0);
    expect(disputed.reservations).toEqual([]);
    expect(disputed.releaseCorrectionIds).toEqual(["c1"]);

    const released: string[][] = [];
    const cents = await reserveDoctorOffsetCents(
      { doctorId: "doc", bookingId: "book", maxCents: 1000 },
      {
        loadRows: async () => [{ ...approved, disputeOpen: true }],
        loadHolds: async () => held,
        release: async (bookingIds) => {
          released.push(bookingIds);
        },
        nowIso: now,
      }
    );
    expect(cents).toBe(0);
    expect(released).toEqual([["book"]]);
  });

  it("restores a refunded share of an applied offset", () => {
    expect(
      offsetRestoreCents({
        holdCents: 1000,
        alreadyRestoredCents: 0,
        refundCents: 5000,
        originalPaidCents: 10000,
      })
    ).toBe(500);
    expect(
      offsetRestoreCents({
        holdCents: 1000,
        alreadyRestoredCents: 500,
        refundCents: 5000,
        originalPaidCents: 10000,
      })
    ).toBe(500);
    expect(
      offsetRestoreCents({
        holdCents: 1000,
        alreadyRestoredCents: 0,
        refundCents: 10000,
        originalPaidCents: 10000,
      })
    ).toBe(1000);
  });

  it("raises the destination fee and shrinks the wallet transfer by the same offset", () => {
    const fee = destinationFeeWithOffset({
      applicationFeeCents: 1500,
      chargeCents: 10000,
      offsetCents: 200,
    });
    expect(fee).toEqual({ applicationFeeCents: 1700, offsetAppliedCents: 200 });
    const capped = destinationFeeWithOffset({
      applicationFeeCents: 9900,
      chargeCents: 10000,
      offsetCents: 500,
    });
    expect(capped.applicationFeeCents).toBe(10000);
    const transfer = transferAmountWithOffset({
      transferCents: 8500,
      offsetCents: 200,
    });
    expect(transfer).toEqual({ transferCents: 8300, offsetAppliedCents: 200 });
  });

  it("uses a stable reversal key that is not the consult clawback key", () => {
    const key = correctionReversalIdempotencyKey("corr", "tr_1", 500);
    expect(key).toBe("payment-correction-reversal-corr-tr_1-500");
    expect(key).not.toBe(consultCardClawbackIdempotencyKey("bk_1", 500));
  });

  it("puts the clear-risk reason in the notice and refuses a blank one", () => {
    const email = paymentCorrectionNoticeEmail({
      party: "doctor",
      reason: "Duplicate payout",
      amountCents: 9900,
      currency: "GBP",
      method: "Offset from a future payout",
      clearRisk: true,
      clearRiskReason: "Stripe is closing the connected account",
    });
    expect(email.html).toContain("Stripe is closing the connected account");
    expect(() =>
      paymentCorrectionNoticeEmail({
        party: "doctor",
        reason: "Duplicate payout",
        amountCents: 9900,
        currency: "GBP",
        method: "Offset",
        clearRisk: true,
        clearRiskReason: " ",
      })
    ).toThrow(/reason/);
  });

  it("keeps a founding place when the failure was ours", () => {
    expect(licenseStatusKeepingFounding({ mapped: "past_due", ourError: true })).toBe(
      "active"
    );
    expect(shouldForfeitFoundingOnDelete({ wasLive: true, ourError: true })).toBe(false);
    expect(shouldSkipFoundingEnforcement(true)).toBe(true);
    expect(shouldForfeitFoundingOnDelete({ wasLive: true, ourError: false })).toBe(true);
  });
});

describe("no correction path charges a saved card", () => {
  it("never creates a PaymentIntent, a charge, or an off-session charge", () => {
    const files = [
      ...walk(join(process.cwd(), "src/lib/payments")),
      join(process.cwd(), "src/actions/payment-corrections.ts"),
      join(process.cwd(), "src/lib/email/payment-correction-notice.ts"),
    ];
    const banned = ["paymentIntents.create", "charges.create", "off_session", "offSession"];
    for (const file of files) {
      if (file.includes(`${join("src", "lib", "payments", "__tests__")}`)) continue;
      const body = readFileSync(file, "utf8");
      for (const token of banned) {
        expect(body, file).not.toContain(token);
      }
    }
    expect(CORRECTION_MONEY_ACTIONS.join(",")).not.toMatch(/charge|payment_intent/i);
    const recreate = read("src/lib/payments/founding-recreate.ts");
    expect(recreate).not.toContain("claim_founding_member");
    expect(recreate).not.toContain("claimFoundingSpot");
    expect(recreate).not.toContain("reserve_founding_spot");
    expect(recreate).not.toContain("reserveFoundingSpot");
    expect(recreate).toContain("founding_offer_forfeited_at: null");
  });

  it("wires notices, offset, our-error, and statement rows without emailing from cron or webhooks", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    const failedAt = webhook.indexOf('case "invoice.payment_failed"');
    const failedSlice = webhook.slice(failedAt, failedAt + 900);
    expect(failedSlice).toContain("noteFoundingInvoiceFailure");
    expect(failedSlice).not.toContain("sendEmail");
    expect(failedSlice).not.toContain("sendCorrectionNotice");
    expect(webhook).toContain("shouldForfeitFoundingOnDelete");
    expect(webhook).toContain("licenseStatusKeepingFounding");
    expect(webhook).toContain("applyOffsetHoldsForBooking");
    expect(webhook).toContain("releaseOffsetHoldsForBookings");

    const cron = read("src/app/api/cron/license-enforcement/route.ts");
    expect(cron).toContain("foundingFailureIsOurError");
    expect(cron).toContain("shouldSkipFoundingEnforcement");
    expect(cron).not.toContain("sendEmail");

    const doctorPay = read(
      "src/app/[locale]/(doctor)/doctor-dashboard/payments/page.tsx"
    );
    expect(doctorPay).toContain("payment_corrections");
    expect(doctorPay).toContain("statement_line");
    expect(doctorPay).toContain("doctor_wallet_credit_transfers");
    const patientPay = read("src/app/[locale]/(patient)/dashboard/payments/page.tsx");
    expect(patientPay).toContain("payment_corrections");

    const migration = read("supabase/migrations/00124_payment_corrections.sql");
    expect(migration).toContain("required_approvals");
    expect(migration).toContain("payment_correction_approvals");
    expect(migration).toContain("approver cannot be the creator");
    expect(migration).toContain("director BOOLEAN");
    expect(migration).toContain("escalated_by_doctor_at");
    expect(migration).toContain("AND party = 'doctor'");
    expect(migration).toContain("account_closing");
    const reserveFn = migration.slice(
      migration.indexOf("FUNCTION public.reserve_correction_offset"),
      migration.indexOf("FUNCTION public.release_reserved_offset_holds")
    );
    const disputeAt = reserveFn.indexOf(
      "v_row.disputed_at IS NOT NULL AND v_row.dispute_resolved_at IS NULL"
    );
    const returnExisting = reserveFn.indexOf("RETURN v_existing");
    expect(disputeAt).toBeGreaterThan(0);
    expect(returnExisting).toBeGreaterThan(disputeAt);
    expect(reserveFn.indexOf("status = 'released'")).toBeLessThan(returnExisting);
    expect(reserveFn).toContain("required_approvals");
    expect(reserveFn).toContain("p.director");
    expect(migration).toContain("restore_offset_for_refund");
    expect(migration).toContain("offset_restored");
    expect(migration).toContain("settled_by_offset");
    expect(migration).toContain("offset_cents");
    expect(read("src/lib/wallet/index.ts")).toContain("payment_correction");
    expect(read(".env.example")).toContain("PAYMENT_ERROR_NOTICES");
  });
});
