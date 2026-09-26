/**
 * Live Stripe test-mode scenarios for the reschedule destination-charge
 * work (PR #58). Softsmoke Express only. Creates and refunds real test
 * PaymentIntents; does not touch unrelated Softsmoke patient bookings.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { consultDestinationChargeParams } from "@/lib/stripe/consult-charge";
import {
  CONSULT_PAYMENT_METHOD_TYPES,
  doctorCanAcceptConsultCardPayment,
} from "@/lib/stripe/consult-merchant";
import { getCommissionCents } from "@/lib/utils/currency";
import {
  CLINIC_CANCEL_STATUS,
  DOCTOR_CHANGE_RESCHEDULE_MESSAGE,
  balanceCommissionForReschedule,
  dearerChainRescheduleError,
  DEARER_CHAIN_RESCHEDULE_MESSAGE,
  refundReschedulePairIfPaid,
  refundReversesTransfer,
  rescheduleBalanceIdempotencyKey,
  rescheduleDoctorChangeError,
} from "@/lib/booking/reschedule-balance";

const SOFTSMOKE_DOCTOR_ID = "8a9b6ac9-f6f1-4b6a-b108-837a704444dc";
const SOFTSMOKE_ORG_ID = "888d1925-3c0a-40f6-9440-43b32ef3f1a0";
/** Other Softsmoke-org clinician used only for the doctor-change refusal check. */
const OTHER_DOCTOR_ID = "e0000000-0000-0000-0000-000000000002";

const ORIGINAL_FEE_CENTS = 4000;
const DEARER_FEE_CENTS = 5000;
const PRICE_DIFF_CENTS = DEARER_FEE_CENTS - ORIGINAL_FEE_CENTS;

export type ScenarioStepResult = {
  name: string;
  ok: boolean;
  detail: Record<string, unknown>;
  error?: string;
};

export type ScenarioRunResult = {
  ok: boolean;
  keyMode: "test" | "live" | "missing";
  steps: ScenarioStepResult[];
  bookingIds: string[];
  paymentIntentIds: string[];
};

function stamp(): string {
  return Date.now().toString(36).toUpperCase();
}

async function resolvePatientId(
  admin: ReturnType<typeof createAdminClient>
): Promise<string> {
  const { data } = await admin
    .from("bookings")
    .select("patient_id")
    .eq("doctor_id", SOFTSMOKE_DOCTOR_ID)
    .not("patient_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (data?.patient_id) return data.patient_id as string;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", "dbd.demo.email@gmail.com")
    .maybeSingle();
  if (!profile?.id) {
    throw new Error("No Softsmoke patient profile available for scenarios");
  }
  return profile.id as string;
}

async function createConfirmedDestinationCharge(input: {
  amountCents: number;
  applicationFeeCents: number;
  destinationAccountId: string;
  description: string;
  metadata: Record<string, string>;
  idempotencyKey: string;
}): Promise<{ id: string; transferDataDestination: string | null; onBehalfOf: string | null; applicationFee: number | null }> {
  const stripe = getStripe();
  const merchant = await doctorCanAcceptConsultCardPayment(
    stripe,
    input.destinationAccountId
  );
  if (!merchant.ok) {
    throw new Error(merchant.error);
  }

  const intent = await stripe.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: "gbp",
      payment_method_types: CONSULT_PAYMENT_METHOD_TYPES,
      payment_method: "pm_card_visa",
      confirm: true,
      description: input.description,
      metadata: input.metadata,
      ...consultDestinationChargeParams({
        destinationAccountId: input.destinationAccountId,
        applicationFeeCents: input.applicationFeeCents,
      }),
    },
    { idempotencyKey: input.idempotencyKey }
  );

  if (intent.status !== "succeeded") {
    throw new Error(
      `PaymentIntent ${intent.id} status is ${intent.status}, expected succeeded`
    );
  }

  const transferDest = intent.transfer_data?.destination;
  const onBehalf = intent.on_behalf_of;
  return {
    id: intent.id,
    transferDataDestination:
      typeof transferDest === "string"
        ? transferDest
        : transferDest?.id ?? null,
    onBehalfOf:
      typeof onBehalf === "string" ? onBehalf : onBehalf?.id ?? null,
    applicationFee: intent.application_fee_amount ?? null,
  };
}

async function insertOriginalBooking(input: {
  admin: ReturnType<typeof createAdminClient>;
  patientId: string;
  bookingNumber: string;
  paymentIntentId: string;
  commissionCents: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
}): Promise<string> {
  const { data, error } = await input.admin
    .from("bookings")
    .insert({
      booking_number: input.bookingNumber,
      patient_id: input.patientId,
      doctor_id: SOFTSMOKE_DOCTOR_ID,
      organization_id: SOFTSMOKE_ORG_ID,
      appointment_date: input.appointmentDate,
      start_time: input.startTime,
      end_time: input.endTime,
      duration_minutes: 30,
      consultation_type: "video",
      status: "confirmed",
      currency: "GBP",
      consultation_fee_cents: ORIGINAL_FEE_CENTS,
      platform_fee_cents: 0,
      commission_cents: input.commissionCents,
      total_amount_cents: ORIGINAL_FEE_CENTS,
      payment_mode: "full",
      stripe_payment_intent_id: input.paymentIntentId,
      paid_at: new Date().toISOString(),
      is_guest: true,
      wallet_credit_applied_cents: 0,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message || "Failed to insert original booking");
  }
  return data.id as string;
}

async function insertBalanceBooking(input: {
  admin: ReturnType<typeof createAdminClient>;
  patientId: string;
  originalBookingId: string;
  bookingNumber: string;
  paymentIntentId: string;
  balanceCommissionCents: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
}): Promise<string> {
  const { data, error } = await input.admin
    .from("bookings")
    .insert({
      booking_number: input.bookingNumber,
      patient_id: input.patientId,
      doctor_id: SOFTSMOKE_DOCTOR_ID,
      organization_id: SOFTSMOKE_ORG_ID,
      appointment_date: input.appointmentDate,
      start_time: input.startTime,
      end_time: input.endTime,
      duration_minutes: 30,
      consultation_type: "video",
      status: "confirmed",
      currency: "GBP",
      consultation_fee_cents: DEARER_FEE_CENTS,
      platform_fee_cents: 0,
      commission_cents: input.balanceCommissionCents,
      total_amount_cents: DEARER_FEE_CENTS,
      payment_mode: "full",
      stripe_payment_intent_id: input.paymentIntentId,
      reschedule_payment_intent_id: input.paymentIntentId,
      paid_at: new Date().toISOString(),
      rescheduled_from_booking_id: input.originalBookingId,
      reschedule_price_diff_cents: PRICE_DIFF_CENTS,
      reschedule_payment_status: "paid",
      rescheduled_at: new Date().toISOString(),
      is_guest: true,
      wallet_credit_applied_cents: 0,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message || "Failed to insert balance booking");
  }
  return data.id as string;
}

async function markOriginalCancelled(
  admin: ReturnType<typeof createAdminClient>,
  originalId: string
): Promise<void> {
  await admin
    .from("bookings")
    .update({
      status: "cancelled_doctor",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: "Replaced by paid dearer-slot reschedule (e2e)",
    })
    .eq("id", originalId);
}

async function loadDoctorStripeAccount(
  admin: ReturnType<typeof createAdminClient>
): Promise<string> {
  const { data } = await admin
    .from("doctors")
    .select("stripe_account_id")
    .eq("id", SOFTSMOKE_DOCTOR_ID)
    .single();
  const accountId = (data?.stripe_account_id as string | null) ?? "";
  if (!accountId.startsWith("acct_")) {
    throw new Error("Softsmoke doctor has no real Stripe Connect account");
  }
  return accountId;
}

function futureSlot(hoursFromNow: number): {
  appointmentDate: string;
  startTime: string;
  endTime: string;
} {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const appointmentDate = start.toISOString().slice(0, 10);
  return {
    appointmentDate,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

async function createPaidDearerPair(input: {
  admin: ReturnType<typeof createAdminClient>;
  patientId: string;
  destinationAccountId: string;
  label: string;
}): Promise<{
  originalId: string;
  balanceId: string;
  originalPi: string;
  balancePi: string;
  originalCommission: number;
  balanceCommission: number;
  transferDataDestination: string | null;
  onBehalfOf: string | null;
}> {
  const tag = `${input.label}-${stamp()}`;
  const originalCommission = getCommissionCents(ORIGINAL_FEE_CENTS);
  const slot1 = futureSlot(48);
  const originalPi = await createConfirmedDestinationCharge({
    amountCents: ORIGINAL_FEE_CENTS,
    applicationFeeCents: originalCommission,
    destinationAccountId: input.destinationAccountId,
    description: `E2E Softsmoke original ${tag}`,
    metadata: {
      type: "e2e_reschedule_scenario",
      label: input.label,
      leg: "original",
    },
    idempotencyKey: `e2e-orig-${tag}`,
  });

  const originalId = await insertOriginalBooking({
    admin: input.admin,
    patientId: input.patientId,
    bookingNumber: `E2E-${tag}`,
    paymentIntentId: originalPi.id,
    commissionCents: originalCommission,
    ...slot1,
  });

  const chain = [
    {
      commissionCents: originalCommission,
      feeBasisCents: ORIGINAL_FEE_CENTS,
      rescheduledFromBookingId: null as string | null,
    },
  ];
  const balanceCommission = balanceCommissionForReschedule({
    chainNewestFirst: chain,
    priceDiffCents: PRICE_DIFF_CENTS,
  });

  const slot2 = futureSlot(72);
  const balancePi = await createConfirmedDestinationCharge({
    amountCents: PRICE_DIFF_CENTS,
    applicationFeeCents: balanceCommission,
    destinationAccountId: input.destinationAccountId,
    description: `E2E Softsmoke balance ${tag}`,
    metadata: {
      type: "reschedule_balance",
      original_booking_id: originalId,
      leg: "balance",
      label: input.label,
    },
    idempotencyKey: rescheduleBalanceIdempotencyKey({
      bookingId: originalId,
      priceDiffCents: PRICE_DIFF_CENTS,
      startTime: slot2.startTime,
    }),
  });

  const balanceId = await insertBalanceBooking({
    admin: input.admin,
    patientId: input.patientId,
    originalBookingId: originalId,
    bookingNumber: `E2E-${tag}-R`,
    paymentIntentId: balancePi.id,
    balanceCommissionCents: balanceCommission,
    ...slot2,
  });

  await markOriginalCancelled(input.admin, originalId);

  return {
    originalId,
    balanceId,
    originalPi: originalPi.id,
    balancePi: balancePi.id,
    originalCommission,
    balanceCommission,
    transferDataDestination: balancePi.transferDataDestination,
    onBehalfOf: balancePi.onBehalfOf,
  };
}

/**
 * Runs the four post-merge Softsmoke Stripe scenarios.
 * Safe to call more than once; each run creates its own bookings.
 */
export async function runStripeRescheduleScenarios(): Promise<ScenarioRunResult> {
  const steps: ScenarioStepResult[] = [];
  const bookingIds: string[] = [];
  const paymentIntentIds: string[] = [];

  const secret = process.env.STRIPE_SECRET_KEY || "";
  const keyMode: ScenarioRunResult["keyMode"] = !secret
    ? "missing"
    : secret.startsWith("sk_live")
      ? "live"
      : "test";

  if (keyMode !== "test") {
    return {
      ok: false,
      keyMode,
      steps: [
        {
          name: "preflight",
          ok: false,
          detail: {},
          error:
            keyMode === "missing"
              ? "STRIPE_SECRET_KEY is not set"
              : "Refusing to run scenarios against a live Stripe key",
        },
      ],
      bookingIds,
      paymentIntentIds,
    };
  }

  const admin = createAdminClient();
  const destinationAccountId = await loadDoctorStripeAccount(admin);
  const patientId = await resolvePatientId(admin);

  // ── 1. Same-doctor dearer reschedule (destination balance charge) ──
  try {
    const pair = await createPaidDearerPair({
      admin,
      patientId,
      destinationAccountId,
      label: "DEARER",
    });
    bookingIds.push(pair.originalId, pair.balanceId);
    paymentIntentIds.push(pair.originalPi, pair.balancePi);

    const destinationOk =
      pair.transferDataDestination === destinationAccountId &&
      pair.onBehalfOf === destinationAccountId &&
      (pair.balanceCommission ?? 0) > 0;

    steps.push({
      name: "same_doctor_dearer_reschedule",
      ok: destinationOk,
      detail: {
        originalBookingId: pair.originalId,
        balanceBookingId: pair.balanceId,
        originalPaymentIntentId: pair.originalPi,
        balancePaymentIntentId: pair.balancePi,
        priceDiffCents: PRICE_DIFF_CENTS,
        balanceCommissionCents: pair.balanceCommission,
        transfer_data_destination: pair.transferDataDestination,
        on_behalf_of: pair.onBehalfOf,
        expectedDestination: destinationAccountId,
      },
      error: destinationOk
        ? undefined
        : "Balance PaymentIntent was not a destination charge to Softsmoke",
    });
  } catch (err) {
    steps.push({
      name: "same_doctor_dearer_reschedule",
      ok: false,
      detail: {},
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── 2. Doctor-change refusal (before any refund / charge) ──
  try {
    const refused = rescheduleDoctorChangeError(
      SOFTSMOKE_DOCTOR_ID,
      OTHER_DOCTOR_ID,
      PRICE_DIFF_CENTS
    );
    const sameDoctor = rescheduleDoctorChangeError(
      SOFTSMOKE_DOCTOR_ID,
      SOFTSMOKE_DOCTOR_ID,
      PRICE_DIFF_CENTS
    );
    const ok =
      refused === DOCTOR_CHANGE_RESCHEDULE_MESSAGE && sameDoctor === null;
    steps.push({
      name: "doctor_change_refusal",
      ok,
      detail: {
        differentDoctorMessage: refused,
        sameDoctorMessage: sameDoctor,
        expected: DOCTOR_CHANGE_RESCHEDULE_MESSAGE,
      },
      error: ok
        ? undefined
        : "Doctor-change gate did not match expected refusal copy",
    });
  } catch (err) {
    steps.push({
      name: "doctor_change_refusal",
      ok: false,
      detail: {},
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── 3. Clinic cancel of a paid dearer pair (full refund both legs) ──
  try {
    const pair = await createPaidDearerPair({
      admin,
      patientId,
      destinationAccountId,
      label: "CLINIC",
    });
    bookingIds.push(pair.originalId, pair.balanceId);
    paymentIntentIds.push(pair.originalPi, pair.balancePi);

    const { data: balanceRow } = await admin
      .from("bookings")
      .select(
        "id, payment_mode, deposit_amount_cents, total_amount_cents, wallet_credit_applied_cents, stripe_payment_intent_id, reschedule_payment_intent_id, reschedule_price_diff_cents, reschedule_payment_status, rescheduled_from_booking_id, commission_cents, refund_amount_cents, refunded_at, status"
      )
      .eq("id", pair.balanceId)
      .single();

    if (!balanceRow) throw new Error("Balance booking missing after insert");

    const pairRefund = await refundReschedulePairIfPaid(balanceRow, {
      refundPercent: 100,
      netOfWallet: true,
    });

    if (!pairRefund.applied || "error" in pairRefund) {
      throw new Error(
        "error" in pairRefund && pairRefund.error
          ? pairRefund.error
          : "Clinic cancel did not apply the pair refund"
      );
    }

    await admin
      .from("bookings")
      .update({
        status: CLINIC_CANCEL_STATUS,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: "Cancelled by clinic administrator (e2e)",
        refund_amount_cents: pairRefund.rowRefundCents,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", pair.balanceId);

    const stripe = getStripe();
    const originalRefunds = await stripe.refunds.list({
      payment_intent: pair.originalPi,
      limit: 10,
    });
    const balanceRefunds = await stripe.refunds.list({
      payment_intent: pair.balancePi,
      limit: 10,
    });
    const originalRefunded = originalRefunds.data.reduce(
      (sum, r) => sum + (r.amount ?? 0),
      0
    );
    const balanceRefunded = balanceRefunds.data.reduce(
      (sum, r) => sum + (r.amount ?? 0),
      0
    );

    const ok =
      pairRefund.totalCents === ORIGINAL_FEE_CENTS + PRICE_DIFF_CENTS &&
      originalRefunded === ORIGINAL_FEE_CENTS &&
      balanceRefunded === PRICE_DIFF_CENTS &&
      refundReversesTransfer({
        commission_cents: pair.balanceCommission,
        rescheduled_from_booking_id: pair.originalId,
        reschedule_payment_status: "paid",
      });

    steps.push({
      name: "clinic_cancel",
      ok,
      detail: {
        balanceBookingId: pair.balanceId,
        originalBookingId: pair.originalId,
        refundIds: pairRefund.refundIds,
        totalCents: pairRefund.totalCents,
        originalCardCents: pairRefund.originalCardCents,
        balanceCardCents: pairRefund.balanceCardCents,
        stripeOriginalRefunded: originalRefunded,
        stripeBalanceRefunded: balanceRefunded,
        status: CLINIC_CANCEL_STATUS,
      },
      error: ok
        ? undefined
        : "Clinic cancel did not fully refund both destination charges",
    });
  } catch (err) {
    steps.push({
      name: "clinic_cancel",
      ok: false,
      detail: {},
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ── 4. Refund of a booking that already has a paid balance ──
  try {
    const pair = await createPaidDearerPair({
      admin,
      patientId,
      destinationAccountId,
      label: "REFUND",
    });
    bookingIds.push(pair.originalId, pair.balanceId);
    paymentIntentIds.push(pair.originalPi, pair.balancePi);

    const chainBlock = dearerChainRescheduleError({
      rescheduled_from_booking_id: pair.originalId,
      reschedule_payment_status: "paid",
    });

    const { data: balanceRow } = await admin
      .from("bookings")
      .select(
        "id, payment_mode, deposit_amount_cents, total_amount_cents, wallet_credit_applied_cents, stripe_payment_intent_id, reschedule_payment_intent_id, reschedule_price_diff_cents, reschedule_payment_status, rescheduled_from_booking_id, commission_cents, refund_amount_cents, refunded_at, status"
      )
      .eq("id", pair.balanceId)
      .single();
    if (!balanceRow) throw new Error("Balance booking missing for refund scenario");

    const pairRefund = await refundReschedulePairIfPaid(balanceRow, {
      refundPercent: 100,
      netOfWallet: true,
    });
    if (!pairRefund.applied || "error" in pairRefund) {
      throw new Error(
        "error" in pairRefund && pairRefund.error
          ? pairRefund.error
          : "Paid-balance refund did not apply"
      );
    }

    await admin
      .from("bookings")
      .update({
        status: "refunded",
        refund_amount_cents: pairRefund.rowRefundCents,
        refunded_at: new Date().toISOString(),
      })
      .eq("id", pair.balanceId);

    const ok =
      chainBlock === DEARER_CHAIN_RESCHEDULE_MESSAGE &&
      pairRefund.totalCents === ORIGINAL_FEE_CENTS + PRICE_DIFF_CENTS &&
      pairRefund.refundIds.length >= 1;

    steps.push({
      name: "refund_paid_balance_booking",
      ok,
      detail: {
        balanceBookingId: pair.balanceId,
        originalBookingId: pair.originalId,
        dearerChainBlockedMessage: chainBlock,
        refundIds: pairRefund.refundIds,
        totalCents: pairRefund.totalCents,
        originalCardCents: pairRefund.originalCardCents,
        balanceCardCents: pairRefund.balanceCardCents,
      },
      error: ok
        ? undefined
        : "Paid -R refund or dearer-chain block did not behave as expected",
    });
  } catch (err) {
    steps.push({
      name: "refund_paid_balance_booking",
      ok: false,
      detail: {},
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    ok: steps.every((step) => step.ok),
    keyMode,
    steps,
    bookingIds,
    paymentIntentIds,
  };
}
