import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getCommissionCents } from "@/lib/utils/currency";
import { consultDestinationChargeParams } from "@/lib/stripe/consult-charge";
import {
  CLINIC_CANCEL_STATUS,
  DOCTOR_CHANGE_RESCHEDULE_MESSAGE,
  allocateRescheduleRefundCents,
  clinicCancelMakeWhole,
  createDestinationRefunds,
  refundReschedulePairIfPaid,
  rescheduleBalanceApplicationFeeCents,
  rescheduleDoctorChangeError,
  rescheduleRefundLegs,
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
    const refundAt = fn.indexOf("refunds.create");
    expect(blockAt).toBeGreaterThan(-1);
    expect(refundAt).toBeGreaterThan(blockAt);
    expect(slotUpdateAt).toBeGreaterThan(blockAt);
    expect(createAt).toBeGreaterThan(blockAt);
    expect(fn.slice(0, slotUpdateAt)).toContain(
      "if (doctorChangeError) return { error: doctorChangeError }"
    );
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
  };
  const original: RescheduleRefundBooking = {
    id: "booking-original",
    stripe_payment_intent_id: "pi_original",
    total_amount_cents: 4000,
    payment_mode: "full",
    reschedule_payment_status: null,
  };

  function stripeFake() {
    const creates: Array<Record<string, unknown>> = [];
    const stripe = {
      refunds: {
        async create(params: {
          payment_intent: string;
          amount: number;
          reverse_transfer: true;
          refund_application_fee: true;
        }) {
          creates.push(params);
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
    });
    expect(creates).toEqual([
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
      { paymentIntentId: "pi_original", amountCents: 2000 },
      { paymentIntentId: "pi_balance", amountCents: 750 },
    ]);
    expect(creates.every((call) => call.reverse_transfer === true)).toBe(true);
    expect(creates.every((call) => call.refund_application_fee === true)).toBe(
      true
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
    });
    expect(creates).toEqual([
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

  it("offers cancel with full refund next to the doctor-change message", () => {
    const client = read(
      "src/app/[locale]/(doctor)/doctor-dashboard/organization/bookings/org-bookings-client.tsx"
    );
    expect(client).toContain('from "@/lib/booking/reschedule-copy"');
    expect(client).not.toContain("reschedule-balance");
    expect(client).toContain("DOCTOR_CHANGE_RESCHEDULE_MESSAGE");
    expect(client).toContain("Cancel with full refund");
    expect(client).toContain("adminCancelBooking");
    expect(client).toContain(
      "Cancelled by the clinic to rebook with another clinician"
    );
  });

  it("is used by patient, clinic, and admin refunds", () => {
    const clinic = read("src/actions/clinic-booking.ts");
    const booking = read("src/actions/booking.ts");
    const admin = read("src/actions/admin.ts");
    expect(clinic).toContain("refundReschedulePairIfPaid");
    expect(booking).toContain("refundReschedulePairIfPaid");
    expect(admin.match(/await refundReschedulePairIfPaid/g)?.length).toBe(2);

    const helper = read("src/lib/booking/reschedule-balance.ts");
    expect(helper).toContain("reverse_transfer: true");
    expect(helper).toContain("refund_application_fee: true");
  });
});
