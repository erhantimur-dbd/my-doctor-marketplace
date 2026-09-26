import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getCommissionCents } from "@/lib/utils/currency";
import { consultDestinationChargeParams } from "@/lib/stripe/consult-charge";
import {
  CLINIC_CANCEL_STATUS,
  DEARER_CHAIN_RESCHEDULE_MESSAGE,
  DOCTOR_CHANGE_RESCHEDULE_MESSAGE,
  addedRefundCents,
  allocateRescheduleRefundCents,
  applyRescheduleBalanceSuccess,
  balanceCommissionForReschedule,
  balanceFeeToRecord,
  clinicCancelMakeWhole,
  createDestinationRefunds,
  dearerChainRescheduleError,
  openBalancePaymentToCancel,
  persistAddedRefund,
  refundIdempotencyKey,
  refundReschedulePairIfPaid,
  rescheduleBalanceApplicationFeeCents,
  rescheduleBalanceSuccessAction,
  rescheduleDoctorChangeError,
  rescheduleRefundLegs,
  rootCommissionFromChain,
  shouldAbandonRescheduleBalance,
  walletCreditOnCancel,
  type RescheduleRefundBooking,
} from "@/lib/booking/reschedule-balance";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("reschedule balance destination charge", () => {
  it("uses the original booking's commission rate, capped at the difference", () => {
    expect(
      rescheduleBalanceApplicationFeeCents({
        priceDiffCents: 1500,
        originalCommissionCents: 600,
        originalFeeBasisCents: 4000,
      })
    ).toBe(225);

    expect(
      rescheduleBalanceApplicationFeeCents({
        priceDiffCents: 2000,
        originalCommissionCents: 1000,
        originalFeeBasisCents: 10000,
      })
    ).toBe(200);

    expect(
      rescheduleBalanceApplicationFeeCents({
        priceDiffCents: 1500,
        originalCommissionCents: 0,
        originalFeeBasisCents: 4000,
      })
    ).toBe(getCommissionCents(1500));

    expect(
      rescheduleBalanceApplicationFeeCents({
        priceDiffCents: 100,
        originalCommissionCents: 5000,
        originalFeeBasisCents: 1000,
      })
    ).toBe(100);
  });

  it("sets on_behalf_of to the doctor's account on the destination charge", () => {
    const params = consultDestinationChargeParams({
      destinationAccountId: "acct_doctor",
      applicationFeeCents: 225,
    });
    expect(params).toEqual({
      application_fee_amount: 225,
      on_behalf_of: "acct_doctor",
      transfer_data: { destination: "acct_doctor" },
    });

    const source = read("src/lib/stripe/consult-charge.ts");
    expect(source).not.toContain("TODO(#56)");
    expect(source).toContain("on_behalf_of: input.destinationAccountId");
  });

  it("writes commission_cents and charges the balance through the consult path", () => {
    const src = read("src/actions/clinic-booking.ts");
    const fn = src.slice(src.indexOf("export async function adminRescheduleBooking"));
    expect(fn).toContain("commission_cents: balanceCommissionCents");
    expect(fn).toContain("consultDestinationChargeParams");
    expect(fn).toContain("applicationFeeCents: balanceCommissionCents");
    expect(fn).toContain("destinationAccountId");
    expect(fn).not.toContain("TODO(#56)");

    const gateAt = fn.indexOf("await doctorCanAcceptConsultCardPayment");
    const createAt = fn.indexOf("paymentIntents.create");
    expect(gateAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(gateAt);
    expect(fn.slice(gateAt, createAt)).toContain(
      "if (!merchant.ok) return { error: merchant.error }"
    );
    expect(fn.slice(gateAt, createAt)).not.toContain("paymentIntents.create");
    expect(fn.slice(createAt)).toContain("...consultDestinationChargeParams");

    const blockAt = fn.indexOf("rescheduleDoctorChangeError");
    const slotUpdateAt = fn.indexOf("doctor_id: parsed.data.new_doctor_id");
    expect(blockAt).toBeGreaterThan(slotUpdateAt);
    expect(createAt).toBeGreaterThan(blockAt);
    expect(fn.slice(0, slotUpdateAt)).not.toContain("rescheduleDoctorChangeError");
    expect(fn).toContain("dearerChainRescheduleError");
    expect(fn).toContain("balanceCommissionForReschedule");
    expect(fn).toContain("idempotencyKey: rescheduleBalanceIdempotencyKey");
  });

  it("sends consult checkout through the same charge parameters", () => {
    for (const rel of [
      "src/actions/booking.ts",
      "src/actions/follow-up.ts",
      "src/actions/admin.ts",
    ]) {
      expect(read(rel), rel).toContain("consultDestinationChargeParams");
      expect(read(rel), rel).toContain("destinationAccountId: doctor.stripe_account_id");
    }
    const treatment = read("src/actions/treatment-plan.ts");
    const invoices = read("src/actions/invoices.ts");
    expect(treatment).not.toContain("consultDestinationChargeParams");
    expect(invoices).not.toContain("consultDestinationChargeParams");
    expect(treatment).not.toMatch(/on_behalf_of\s*:/);
    expect(invoices).not.toMatch(/on_behalf_of\s*:/);
  });
});

describe("doctor change is refused before any charge", () => {
  it("uses the exact message and allows the same doctor", () => {
    expect(rescheduleDoctorChangeError("doctor-a", "doctor-b")).toBe(
      DOCTOR_CHANGE_RESCHEDULE_MESSAGE
    );
    expect(DOCTOR_CHANGE_RESCHEDULE_MESSAGE).toBe(
      "Please cancel and rebook with the other clinician"
    );
    expect(rescheduleDoctorChangeError("doctor-a", "doctor-a")).toBeNull();
    expect(rescheduleDoctorChangeError("", "doctor-a")).toBe(
      DOCTOR_CHANGE_RESCHEDULE_MESSAGE
    );
    expect(rescheduleDoctorChangeError("doctor-a", "doctor-b", 0)).toBeNull();
    expect(rescheduleDoctorChangeError("doctor-a", "doctor-b", -500)).toBeNull();
  });
});

describe("paid reschedule refunds both destination charges", () => {
  const successor: RescheduleRefundBooking = {
    id: "booking-successor",
    rescheduled_from_booking_id: "booking-original",
    reschedule_payment_status: "paid",
    reschedule_payment_intent_id: "pi_balance",
    stripe_payment_intent_id: "pi_balance",
    reschedule_price_diff_cents: 1500,
    total_amount_cents: 5500,
    payment_mode: "full",
    commission_cents: 225,
  };
  const original: RescheduleRefundBooking = {
    id: "booking-original",
    stripe_payment_intent_id: "pi_original",
    total_amount_cents: 4000,
    payment_mode: "full",
    reschedule_payment_status: null,
    commission_cents: 600,
  };

  function stripeFake(
    existing?: Record<
      string,
      Array<{ id: string; amount: number; status?: string }>
    >
  ) {
    const creates: Array<{
      params: Record<string, unknown>;
      idempotencyKey?: string;
    }> = [];
    const stripe = {
      refunds: {
        async list(params: { payment_intent: string }) {
          return { data: existing?.[params.payment_intent] ?? [] };
        },
        async create(
          params: Record<string, unknown>,
          options?: { idempotencyKey?: string }
        ) {
          creates.push({ params, idempotencyKey: options?.idempotencyKey });
          return { id: `re_${creates.length}` };
        },
      },
    };
    return { stripe, creates };
  }

  function loadBooking(id: string) {
    if (id === successor.id) return successor;
    if (id === original.id) return original;
    return null;
  }

  it("reverses the transfer and the application fee on the original charge and the balance", async () => {
    const { stripe, creates } = stripeFake();
    const persisted: Array<{ id: string; amountCents: number }> = [];
    const result = await refundReschedulePairIfPaid(successor, {
      refundPercent: 100,
      stripe,
      loadBooking: async (id) => loadBooking(id),
      findPaidSuccessor: async () => null,
      persistOtherRefund: async (id, amountCents) => {
        persisted.push({ id, amountCents });
      },
    });

    expect(result).toEqual({
      applied: true,
      totalCents: 5500,
      rowRefundCents: 1500,
      refundIds: ["re_1", "re_2"],
      walletCreditCents: 0,
      originalCardCents: 4000,
      balanceCardCents: 1500,
      successorId: "booking-successor",
    });
    expect(creates.map((call) => call.params)).toEqual([
      {
        payment_intent: "pi_original",
        amount: 4000,
        reverse_transfer: true,
        refund_application_fee: true,
      },
      {
        payment_intent: "pi_balance",
        amount: 1500,
        reverse_transfer: true,
        refund_application_fee: true,
      },
    ]);
    expect(creates.map((call) => call.idempotencyKey)).toEqual([
      "refund:booking-original:pi_original:4000:reschedule_pair",
      "refund:booking-successor:pi_balance:1500:reschedule_pair",
    ]);
    expect(persisted).toEqual([
      { id: "booking-original", amountCents: 4000 },
    ]);
  });

  it("scales both charges when the cancellation is partial", async () => {
    expect(
      rescheduleRefundLegs({
        refundPercent: 50,
        balancePaymentIntentId: "pi_balance",
        balanceChargedCents: 1500,
        originalPaymentIntentId: "pi_original",
        originalChargedCents: 4000,
      })
    ).toEqual([
      { paymentIntentId: "pi_original", amountCents: 2000 },
      { paymentIntentId: "pi_balance", amountCents: 750 },
    ]);

    const { stripe, creates } = stripeFake();
    await createDestinationRefunds(stripe, [
      {
        paymentIntentId: "pi_original",
        amountCents: 2000,
        bookingId: "booking-original",
        reason: "partial",
        reverseTransfer: true,
      },
      {
        paymentIntentId: "pi_balance",
        amountCents: 750,
        bookingId: "booking-successor",
        reason: "partial",
        reverseTransfer: true,
      },
    ]);
    expect(creates.every((call) => call.params.reverse_transfer === true)).toBe(
      true
    );
    expect(
      creates.every((call) => call.params.refund_application_fee === true)
    ).toBe(true);
    expect(creates[0]?.idempotencyKey).toBe(
      "refund:booking-original:pi_original:2000:partial"
    );
    expect(creates[1]?.idempotencyKey).toBe(
      "refund:booking-successor:pi_balance:750:partial"
    );
  });

  it("splits an explicit refund across both charges", () => {
    expect(
      allocateRescheduleRefundCents({
        requestedCents: 2750,
        balanceChargedCents: 1500,
        originalChargedCents: 4000,
      })
    ).toEqual({ balanceCents: 750, originalCents: 2000 });
  });

  it("leaves a same-or-cheaper reschedule on the single original charge", async () => {
    const { stripe, creates } = stripeFake();
    const cheaper: RescheduleRefundBooking = {
      id: "booking-original",
      rescheduled_from_booking_id: "booking-original",
      reschedule_payment_status: "not_required",
      stripe_payment_intent_id: "pi_original",
      total_amount_cents: 3500,
      reschedule_price_diff_cents: -500,
    };
    const result = await refundReschedulePairIfPaid(cheaper, {
      refundPercent: 100,
      stripe,
      loadBooking: async () => cheaper,
      findPaidSuccessor: async () => null,
    });
    expect(result).toEqual({ applied: false });
    expect(creates).toEqual([]);
  });

  it("refunds both card charges net of wallet when the clinic cancels", async () => {
    const { stripe, creates } = stripeFake();
    const persisted: Array<{ id: string; amountCents: number }> = [];
    const result = await refundReschedulePairIfPaid(successor, {
      refundPercent: 100,
      netOfWallet: true,
      stripe,
      loadBooking: async (id) => {
        const row = loadBooking(id);
        if (!row || row.id !== original.id) return row;
        return { ...row, wallet_credit_applied_cents: 1000 };
      },
      findPaidSuccessor: async () => null,
      persistOtherRefund: async (id, amountCents) => {
        persisted.push({ id, amountCents });
      },
    });

    expect(result).toEqual({
      applied: true,
      totalCents: 4500,
      rowRefundCents: 1500,
      refundIds: ["re_1", "re_2"],
      walletCreditCents: 1000,
      originalCardCents: 3000,
      balanceCardCents: 1500,
      successorId: "booking-successor",
    });
    expect(creates.map((call) => call.params)).toEqual([
      {
        payment_intent: "pi_original",
        amount: 3000,
        reverse_transfer: true,
        refund_application_fee: true,
      },
      {
        payment_intent: "pi_balance",
        amount: 1500,
        reverse_transfer: true,
        refund_application_fee: true,
      },
    ]);
    expect(persisted).toEqual([
      { id: "booking-original", amountCents: 3000 },
    ]);
  });

  it("returns every pound the patient paid when the clinic cancels, even under a strict late policy", () => {
    const plan = clinicCancelMakeWhole({
      cancellationPolicy: "strict",
      hoursUntilAppointment: 1,
      originalPaymentIntentId: "pi_original",
      originalChargedCents: 4000,
      originalWalletCreditCents: 1000,
      balancePaymentIntentId: "pi_balance",
      balanceChargedCents: 1500,
    });

    expect(plan.status).toBe(CLINIC_CANCEL_STATUS);
    expect(plan.status).toBe("cancelled_doctor");
    expect(plan.refundPercent).toBe(100);
    expect(plan.walletCreditCents).toBe(1000);
    expect(plan.legs).toEqual([
      { paymentIntentId: "pi_original", amountCents: 3000 },
      { paymentIntentId: "pi_balance", amountCents: 1500 },
    ]);
    expect(
      plan.legs.every((leg) => leg.amountCents > 0)
    ).toBe(true);

    const walletOnly = clinicCancelMakeWhole({
      cancellationPolicy: "strict",
      hoursUntilAppointment: 0,
      originalPaymentIntentId: null,
      originalChargedCents: 4000,
      originalWalletCreditCents: 4000,
    });
    expect(walletOnly.legs).toEqual([]);
    expect(walletOnly.walletCreditCents).toBe(4000);
    expect(walletOnly.refundPercent).toBe(100);
    expect(walletOnly.status).toBe("cancelled_doctor");
  });

  it("records clinic cancel as the clinic and refunds the card and the wallet in full", () => {
    const clinic = read("src/actions/clinic-booking.ts");
    const start = clinic.indexOf("export async function adminCancelBooking");
    const end = clinic.indexOf(
      "export async function adminRescheduleBooking",
      start
    );
    const body = clinic.slice(start, end);

    expect(body).toContain("status: CLINIC_CANCEL_STATUS");
    expect(body).toContain("Cancelled by clinic administrator");
    expect(body).toContain("rescheduled_by: membership.user_id");
    expect(body).toContain("refundPercent: 100");
    expect(body).toContain("netOfWallet: true");
    expect(body).toContain("clinicCancelMakeWhole");
    expect(body).toContain("createDestinationRefunds");
    expect(body).toContain("creditWallet");
    expect(body).not.toContain("cancelled_patient");
    expect(body).not.toContain("cancellation_policy");
    expect(body).not.toContain("cancellation_hours");
    expect(body).not.toMatch(/refundPercent\s*=/);
  });

  it("does not add a clinic cancel-with-full-refund button", () => {
    const client = read(
      "src/app/[locale]/(doctor)/doctor-dashboard/organization/bookings/org-bookings-client.tsx"
    );
    expect(client).not.toContain("reschedule-balance");
    expect(client).not.toContain("Cancel with full refund");
    expect(client).not.toContain("DOCTOR_CHANGE_RESCHEDULE_MESSAGE");
    expect(client).toContain("adminCancelBooking");
  });

  it("is used by patient, clinic, and admin refunds", () => {
    const clinic = read("src/actions/clinic-booking.ts");
    const booking = read("src/actions/booking.ts");
    const admin = read("src/actions/admin.ts");
    expect(clinic).toContain("refundReschedulePairIfPaid");
    expect(booking).toContain("refundReschedulePairIfPaid");
    expect(admin.match(/await refundReschedulePairIfPaid/g)?.length).toBe(2);

    const helper = read("src/lib/booking/reschedule-balance.ts");
    expect(helper).toContain("params.reverse_transfer = true");
    expect(helper).toContain("params.refund_application_fee = true");
    expect(booking).toContain("walletCreditOnCancel");
    expect(booking).toContain("refund_amount_cents: addedRefundCents");
    expect(admin).toContain('status: "refunded"');
  });

  it("does not refund a leg the booking row already covers", async () => {
    const { stripe, creates } = stripeFake();
    const result = await refundReschedulePairIfPaid(successor, {
      refundPercent: 100,
      stripe,
      loadBooking: async (id) => {
        const row = loadBooking(id);
        if (!row) return row;
        if (row.id === original.id) {
          return {
            ...row,
            refunded_at: "2026-01-01T00:00:00.000Z",
            refund_amount_cents: 4000,
          };
        }
        return row;
      },
      findPaidSuccessor: async () => null,
      persistOtherRefund: async () => {},
    });
    expect(result).toMatchObject({
      applied: true,
      originalCardCents: 0,
      balanceCardCents: 1500,
      totalCents: 1500,
    });
    expect(creates).toHaveLength(1);
    expect(creates[0]?.params.payment_intent).toBe("pi_balance");
    expect(creates[0]?.idempotencyKey).toContain("pi_balance");
  });

  it("omits reverse flags on a legacy platform balance with no commission", async () => {
    const { stripe, creates } = stripeFake();
    const legacy = { ...successor, commission_cents: 0 };
    await refundReschedulePairIfPaid(legacy, {
      refundPercent: 100,
      stripe,
      loadBooking: async (id) => (id === legacy.id ? legacy : original),
      findPaidSuccessor: async () => null,
      persistOtherRefund: async () => {},
    });
    const balance = creates.find(
      (call) => call.params.payment_intent === "pi_balance"
    );
    const first = creates.find(
      (call) => call.params.payment_intent === "pi_original"
    );
    expect(balance?.params).toEqual({
      payment_intent: "pi_balance",
      amount: 1500,
    });
    expect(first?.params.reverse_transfer).toBe(true);
    expect(first?.params.refund_application_fee).toBe(true);
  });

  it("does not create a second Stripe refund when the charge is already refunded", async () => {
    const { stripe, creates } = stripeFake({
      pi_original: [{ id: "re_existing", amount: 4000, status: "succeeded" }],
      pi_balance: [{ id: "re_balance", amount: 1500, status: "succeeded" }],
    });
    const ids = await createDestinationRefunds(stripe, [
      {
        paymentIntentId: "pi_original",
        amountCents: 4000,
        bookingId: "booking-original",
        reason: "reschedule_pair",
        reverseTransfer: true,
      },
      {
        paymentIntentId: "pi_balance",
        amountCents: 1500,
        bookingId: "booking-successor",
        reason: "reschedule_pair",
        reverseTransfer: true,
      },
    ]);
    expect(creates).toEqual([]);
    expect(ids).toEqual(["re_existing", "re_balance"]);
  });
});

describe("reschedule balance review rules", () => {
  it("takes the commission rate from the first booking in the chain", () => {
    const root = rootCommissionFromChain([
      {
        commissionCents: 225,
        feeBasisCents: 5500,
        rescheduledFromBookingId: "original",
      },
      {
        commissionCents: 600,
        feeBasisCents: 4000,
        rescheduledFromBookingId: null,
      },
    ]);
    expect(root).toEqual({ commissionCents: 600, feeBasisCents: 4000 });
    const fee = balanceCommissionForReschedule({
      chainNewestFirst: [
        {
          commissionCents: 225,
          feeBasisCents: 5500,
          rescheduledFromBookingId: "original",
        },
        {
          commissionCents: 600,
          feeBasisCents: 4000,
          rescheduledFromBookingId: null,
        },
      ],
      priceDiffCents: 1500,
    });
    expect(fee).toBe(225);
    expect(fee).not.toBe(Math.round((1500 * 225) / 5500));
  });

  it("records a fallback fee when a pre-deploy -R still has a zero commission", () => {
    expect(
      balanceFeeToRecord({
        storedCommissionCents: 0,
        priceDiffCents: 1500,
        originalCommissionCents: 600,
        originalFeeBasisCents: 4000,
      })
    ).toBe(225);
    expect(
      balanceFeeToRecord({
        storedCommissionCents: 0,
        priceDiffCents: 1500,
        originalCommissionCents: 0,
        originalFeeBasisCents: 0,
      })
    ).toBe(getCommissionCents(1500));
    expect(
      balanceFeeToRecord({
        storedCommissionCents: 180,
        priceDiffCents: 1500,
        originalCommissionCents: 600,
        originalFeeBasisCents: 4000,
      })
    ).toBe(180);
  });

  it("blocks a second dearer reschedule of a paid -R booking", () => {
    expect(
      dearerChainRescheduleError({
        rescheduled_from_booking_id: "original",
        reschedule_payment_status: "paid",
      })
    ).toBe(DEARER_CHAIN_RESCHEDULE_MESSAGE);
    expect(
      dearerChainRescheduleError({
        rescheduled_from_booking_id: null,
        reschedule_payment_status: null,
      })
    ).toBeNull();
  });

  it("credits wallet spend, and credits the original card only when the destination is the wallet", () => {
    expect(
      walletCreditOnCancel({
        destination: "bank",
        appliedWalletCents: 1000,
        originalCardCents: 3000,
        balanceCardCents: 1500,
      })
    ).toBe(1000);
    expect(
      walletCreditOnCancel({
        destination: "wallet",
        appliedWalletCents: 1000,
        originalCardCents: 3000,
        balanceCardCents: 1500,
      })
    ).toBe(4000);
  });

  it("adds to a stored refund and throws when the database write fails", async () => {
    expect(addedRefundCents(1000, 500)).toBe(1500);
    const writes: number[] = [];
    await persistAddedRefund("booking-1", 500, {
      read: async () => ({ refund_amount_cents: 1000 }),
      write: async (_id, amount) => {
        writes.push(amount);
        return {};
      },
    });
    expect(writes).toEqual([1500]);
    await expect(
      persistAddedRefund("booking-1", 500, {
        read: async () => ({ error: "read failed" }),
        write: async () => ({}),
      })
    ).rejects.toThrow("read failed");
  });

  it("builds an idempotency key from the booking, payment, amount, and reason", () => {
    expect(
      refundIdempotencyKey({
        bookingId: "booking-1",
        paymentIntentId: "pi_1",
        amountCents: 1500,
        reason: "orphan_balance",
      })
    ).toBe("refund:booking-1:pi_1:1500:orphan_balance");
  });

  it("confirms a pending balance, ignores a replay, and refunds an orphan payment", () => {
    expect(
      rescheduleBalanceSuccessAction({
        newStatus: "pending_reschedule_payment",
        originalStatus: "confirmed",
      })
    ).toBe("confirm");
    expect(
      rescheduleBalanceSuccessAction({
        newStatus: "confirmed",
        originalStatus: "confirmed",
      })
    ).toBe("replay");
    expect(
      rescheduleBalanceSuccessAction({
        newStatus: "pending_reschedule_payment",
        originalStatus: "cancelled_patient",
      })
    ).toBe("refund_orphan");
    expect(
      rescheduleBalanceSuccessAction({
        newStatus: "cancelled_doctor",
        originalStatus: "cancelled_patient",
        balanceRefundedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toBe("replay");
  });

  it("does not abandon a reschedule balance on the first card decline", () => {
    expect(
      shouldAbandonRescheduleBalance({
        eventType: "payment_intent.payment_failed",
        paymentIntentStatus: "requires_payment_method",
      })
    ).toBe(false);
    expect(
      shouldAbandonRescheduleBalance({
        eventType: "payment_intent.canceled",
        paymentIntentStatus: "canceled",
      })
    ).toBe(true);
    expect(
      shouldAbandonRescheduleBalance({
        eventType: "payment_intent.payment_failed",
        paymentIntentStatus: "canceled",
      })
    ).toBe(true);
  });

  it("cancels the open balance PaymentIntent for a waiting -R or its original", () => {
    expect(
      openBalancePaymentToCancel({
        bookingId: "new",
        bookingStatus: "pending_reschedule_payment",
        bookingPaymentIntentId: "pi_open",
      })
    ).toEqual({ closeBookingId: null, paymentIntentId: "pi_open" });
    expect(
      openBalancePaymentToCancel({
        bookingId: "original",
        bookingStatus: "confirmed",
        pendingSuccessor: {
          id: "new",
          status: "pending_reschedule_payment",
          paymentIntentId: "pi_open",
        },
      })
    ).toEqual({ closeBookingId: "new", paymentIntentId: "pi_open" });
    expect(
      openBalancePaymentToCancel({
        bookingId: "original",
        bookingStatus: "confirmed",
        pendingSuccessor: null,
      })
    ).toBeNull();
  });

  it("refunds the balance when the original was already cancelled and does not refund a replay", async () => {
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const fees: unknown[] = [];
    const alerts: string[] = [];
    const creates: Array<{ idempotencyKey?: string }> = [];
    const stripe = {
      refunds: {
        async list() {
          return { data: [] };
        },
        async create(
          _params: Record<string, unknown>,
          options?: { idempotencyKey?: string }
        ) {
          creates.push({ idempotencyKey: options?.idempotencyKey });
          return { id: "re_orphan" };
        },
      },
    };

    const orphan = await applyRescheduleBalanceSuccess({
      newBooking: {
        id: "new-booking",
        status: "pending_reschedule_payment",
        commission_cents: 225,
        reschedule_price_diff_cents: 1500,
        doctor_id: "doctor-1",
        currency: "gbp",
      },
      originalBooking: {
        id: "original-booking",
        status: "cancelled_patient",
        commission_cents: 600,
        consultation_fee_cents: 4000,
      },
      paymentIntentId: "pi_balance",
      stripe,
      updateBooking: async (id, patch) => {
        updates.push({ id, patch });
        return 1;
      },
      insertPlatformFee: async (row) => {
        fees.push(row);
      },
      alertAdmin: async (message) => {
        alerts.push(message);
      },
    });
    expect(orphan).toBe("refund_orphan");
    expect(fees).toEqual([]);
    expect(creates[0]?.idempotencyKey).toBe(
      "refund:new-booking:pi_balance:1500:orphan_balance"
    );
    expect(alerts).toHaveLength(1);
    expect(updates.some((row) => row.id === "new-booking" && row.patch.refunded_at)).toBe(
      true
    );
    expect(
      updates.some((row) => row.patch.status === "confirmed")
    ).toBe(false);

    const replayFees: unknown[] = [];
    const replay = await applyRescheduleBalanceSuccess({
      newBooking: {
        id: "new-booking",
        status: "confirmed",
        commission_cents: 225,
        reschedule_price_diff_cents: 1500,
        doctor_id: "doctor-1",
        currency: "gbp",
      },
      originalBooking: {
        id: "original-booking",
        status: "cancelled_doctor",
        commission_cents: 600,
        consultation_fee_cents: 4000,
      },
      paymentIntentId: "pi_balance",
      stripe,
      updateBooking: async () => {
        throw new Error("replay must not write");
      },
      insertPlatformFee: async (row) => {
        replayFees.push(row);
      },
      alertAdmin: async () => {
        throw new Error("replay must not alert");
      },
    });
    expect(replay).toBe("replay");
    expect(replayFees).toEqual([]);
  });

  it("writes the fallback fee when confirming a -R that still has a zero commission", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const fees: Array<{ amount_cents: number }> = [];
    const outcome = await applyRescheduleBalanceSuccess({
      newBooking: {
        id: "new-booking",
        status: "pending_reschedule_payment",
        commission_cents: 0,
        reschedule_price_diff_cents: 1500,
        doctor_id: "doctor-1",
        currency: "gbp",
      },
      originalBooking: {
        id: "original-booking",
        status: "confirmed",
        commission_cents: 600,
        consultation_fee_cents: 4000,
      },
      paymentIntentId: "pi_balance",
      stripe: {
        refunds: {
          async create() {
            throw new Error("confirm must not refund");
          },
        },
      },
      updateBooking: async (id, patch, match) => {
        updates.push({ id, patch, match });
        if (match?.statusIn) return 1;
        if (match?.status === "pending_reschedule_payment") return 1;
        return 1;
      },
      insertPlatformFee: async (row) => {
        fees.push(row);
      },
      alertAdmin: async () => {},
    });
    expect(outcome).toBe("confirm");
    expect(fees).toEqual([
      expect.objectContaining({ amount_cents: 225, booking_id: "new-booking" }),
    ]);
    expect(updates.some((row) => row.patch && (row.patch as { commission_cents?: number }).commission_cents === 225)).toBe(
      true
    );
  });
});
