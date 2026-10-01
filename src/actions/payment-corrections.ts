"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { paymentCorrectionNoticeEmail } from "@/lib/email/payment-correction-notice";
import {
  assertCanRecreateFounding,
  assertCanSetClearRisk,
  assertMoneyMovement,
  assertWithinTwelveMonths,
  approvalsSatisfied,
  type ApprovalRecord,
  type CorrectionGuardState,
  type CorrectionMoneyAction,
  CorrectionGuardError,
} from "@/lib/payments/correction-guards";
import {
  executeDoctorTopup,
  executeFoundingInvoiceRefund,
  executePatientCardRefund,
  executeTransferReversal,
  executeWalletAdjustment,
} from "@/lib/payments/correction-execute";
import { recreateFoundingSubscription } from "@/lib/payments/founding-recreate";
import { adminEmailGateError } from "@/lib/admin/admin-email-allowlist";

type CorrectionRow = {
  id: string;
  party: "patient" | "doctor";
  patient_id: string | null;
  doctor_id: string | null;
  direction: "customer_favour" | "platform_favour";
  amount_cents: number;
  currency: string;
  reason: string;
  error_type: string;
  booking_id: string | null;
  license_id: string | null;
  stripe_charge_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  stripe_invoice_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  created_by: string | null;
  required_approvals: number;
  notice_sent_at: string | null;
  earliest_recovery_at: string | null;
  clear_risk: boolean;
  clear_risk_reason: string | null;
  escalated_by_doctor_at: string | null;
  disputed_at: string | null;
  dispute_resolved_at: string | null;
  dispute_outcome: "customer_wins" | "correction_upheld" | null;
  our_error: boolean;
  recovered_cents: number;
  statement_line: string;
};

async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, user: null };
  if (adminEmailGateError(user.email)) {
    return { error: "Not authorized" as const, user: null };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { error: "Not authorized" as const, user: null };
  }
  return { error: null, user };
}

function guardError(err: unknown): { error: string } {
  if (err instanceof CorrectionGuardError) return { error: err.message };
  if (err instanceof Error) return { error: err.message };
  return { error: "Payment correction failed" };
}

async function loadBundle(id: string): Promise<{
  row: CorrectionRow;
  state: CorrectionGuardState;
  actorIsApprover: boolean;
  actorIsDirector: boolean;
} | null> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("payment_corrections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return null;

  const [{ data: approvalRows }, { data: approverRows }, { data: events }] =
    await Promise.all([
      admin
        .from("payment_correction_approvals")
        .select("approver_id")
        .eq("correction_id", id),
      admin.from("payment_correction_approvers").select("profile_id, director"),
      admin
        .from("payment_correction_events")
        .select("event_type, payload, actor_id, created_at")
        .eq("correction_id", id),
    ]);

  const allowlist = new Map<string, boolean>(
    (approverRows || []).map((approver) => [
      approver.profile_id as string,
      Boolean(approver.director),
    ])
  );
  const approvals: ApprovalRecord[] = (approvalRows || []).map((approval) => ({
    approverId: approval.approver_id as string,
    inAllowlist: allowlist.has(approval.approver_id as string),
    director: allowlist.get(approval.approver_id as string) === true,
  }));

  const reversal = [...(events || [])]
    .reverse()
    .find((event) => event.event_type === "reversal_attempted");
  const outcome = (reversal?.payload as { outcome?: string } | null)?.outcome;
  const reversalOutcome =
    outcome === "full" || outcome === "short" || outcome === "failed"
      ? outcome
      : null;

  const correction = row as CorrectionRow;
  const state: CorrectionGuardState = {
    party: correction.party,
    direction: correction.direction,
    createdBy: correction.created_by,
    requiredApprovals: correction.required_approvals,
    approvals,
    noticeSentAt: correction.notice_sent_at,
    earliestRecoveryAt: correction.earliest_recovery_at,
    clearRisk: correction.clear_risk,
    escalatedByDoctorAt: correction.escalated_by_doctor_at,
    disputeOpen: Boolean(
      correction.disputed_at && !correction.dispute_resolved_at
    ),
    disputeOutcome: correction.dispute_outcome,
    reversalOutcome,
    offsetUncollectible: (events || []).some(
      (event) => event.event_type === "offset_uncollectible"
    ),
    patientConsentRecorded: (events || []).some(
      (event) => event.event_type === "patient_consent_recorded"
    ),
    nowIso: new Date().toISOString(),
  };

  return {
    row: correction,
    state,
    actorIsApprover: false,
    actorIsDirector: false,
  };
}

async function withActor(id: string, actorId: string) {
  const bundle = await loadBundle(id);
  if (!bundle) return null;
  const admin = createAdminClient();
  const { data: approver } = await admin
    .from("payment_correction_approvers")
    .select("director")
    .eq("profile_id", actorId)
    .maybeSingle();
  return {
    ...bundle,
    actorIsApprover: Boolean(approver),
    actorIsDirector: Boolean(approver?.director),
  };
}

async function writeEvent(
  correctionId: string,
  actorId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const admin = createAdminClient();
  await admin.from("payment_correction_events").insert({
    correction_id: correctionId,
    event_type: eventType,
    actor_id: actorId,
    payload,
  });
  await admin.from("audit_log").insert({
    actor_id: actorId,
    action: eventType,
    target_type: "payment_correction",
    target_id: correctionId,
    metadata: payload,
  });
}

function refresh() {
  revalidatePath("/admin/payment-corrections");
}

export async function createPaymentCorrection(formData: FormData) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };

  const party = String(formData.get("party") || "");
  const direction = String(formData.get("direction") || "");
  const amountCents = Number(formData.get("amount_cents") || 0);
  const currency = String(formData.get("currency") || "GBP").toUpperCase();
  const reason = String(formData.get("reason") || "").trim();
  const errorType = String(formData.get("error_type") || "");
  const related = String(formData.get("related_payment_at") || "");
  const requiredApprovals = Number(formData.get("required_approvals") || 1);
  const patientId = String(formData.get("patient_id") || "") || null;
  const doctorId = String(formData.get("doctor_id") || "") || null;
  const bookingId = String(formData.get("booking_id") || "") || null;
  const licenseId = String(formData.get("license_id") || "") || null;
  const ourError = formData.get("our_error") === "true";

  if (party !== "patient" && party !== "doctor") {
    return { error: "Party must be a patient or a doctor" };
  }
  if (direction !== "customer_favour" && direction !== "platform_favour") {
    return { error: "Direction is required" };
  }
  if (!reason) return { error: "Reason is required" };
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { error: "Amount must be a positive number of cents" };
  }

  const relatedPaymentAt = related ? new Date(related) : null;
  const createdAt = new Date();
  try {
    assertWithinTwelveMonths({
      errorType,
      relatedPaymentAt:
        relatedPaymentAt && !Number.isNaN(relatedPaymentAt.getTime())
          ? relatedPaymentAt
          : null,
      createdAt,
    });
  } catch (err) {
    return guardError(err);
  }

  const statementLine = (
    String(formData.get("statement_line") || "").trim() ||
    `Correction: ${reason}`
  ).slice(0, 180);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_corrections")
    .insert({
      party,
      patient_id: patientId,
      doctor_id: doctorId,
      direction,
      amount_cents: amountCents,
      currency,
      reason,
      error_type: errorType,
      booking_id: bookingId,
      license_id: licenseId,
      stripe_charge_id: String(formData.get("stripe_charge_id") || "") || null,
      stripe_payment_intent_id:
        String(formData.get("stripe_payment_intent_id") || "") || null,
      stripe_transfer_id: String(formData.get("stripe_transfer_id") || "") || null,
      stripe_refund_id: String(formData.get("stripe_refund_id") || "") || null,
      stripe_payout_id: String(formData.get("stripe_payout_id") || "") || null,
      stripe_invoice_id: String(formData.get("stripe_invoice_id") || "") || null,
      stripe_subscription_id:
        String(formData.get("stripe_subscription_id") || "") || null,
      related_payment_at: relatedPaymentAt?.toISOString() || null,
      required_approvals: Math.max(1, requiredApprovals),
      our_error: ourError,
      statement_line: statementLine,
      created_by: auth.user.id,
      source: "admin",
      status: "flagged",
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message || "Could not create the correction" };
  await writeEvent(data.id, auth.user.id, "flagged", { reason, amountCents });
  refresh();
  return { id: data.id as string };
}

export async function approvePaymentCorrection(correctionId: string) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const bundle = await withActor(correctionId, auth.user.id);
  if (!bundle) return { error: "Correction not found" };
  if (!bundle.actorIsApprover) {
    return { error: "Only a named approver can approve" };
  }
  if (bundle.row.created_by === auth.user.id) {
    return { error: "The approver cannot be the creator" };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("payment_correction_approvals").insert({
    correction_id: correctionId,
    approver_id: auth.user.id,
  });
  if (error) return { error: error.message };
  await writeEvent(correctionId, auth.user.id, "approval_recorded", {});
  const again = await loadBundle(correctionId);
  if (
    again &&
    approvalsSatisfied(again.state) &&
    (again.row.status === "flagged" || again.row.status === "notified")
  ) {
    await admin
      .from("payment_corrections")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", correctionId);
  }
  refresh();
  return { ok: true as const };
}

async function recipientEmail(row: CorrectionRow): Promise<string | null> {
  const admin = createAdminClient();
  if (row.party === "patient" && row.patient_id) {
    const { data } = await admin
      .from("profiles")
      .select("email")
      .eq("id", row.patient_id)
      .maybeSingle();
    return data?.email || null;
  }
  if (row.doctor_id) {
    const { data: doctor } = await admin
      .from("doctors")
      .select("profile_id")
      .eq("id", row.doctor_id)
      .maybeSingle();
    if (!doctor?.profile_id) return null;
    const { data } = await admin
      .from("profiles")
      .select("email")
      .eq("id", doctor.profile_id)
      .maybeSingle();
    return data?.email || null;
  }
  return null;
}

export async function sendCorrectionNotice(correctionId: string) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const bundle = await withActor(correctionId, auth.user.id);
  if (!bundle) return { error: "Correction not found" };
  if (!approvalsSatisfied(bundle.state)) {
    return { error: "Send the notice only after the required approvals" };
  }
  const method =
    bundle.row.direction === "customer_favour"
      ? "Refund or top-up"
      : bundle.row.party === "doctor"
        ? "Transfer reversal, then a deduction from future payouts, then a direct request"
        : "A request to repay. We will not charge your card.";
  let email: { subject: string; html: string };
  try {
    email = paymentCorrectionNoticeEmail({
      party: bundle.row.party,
      reason: bundle.row.reason,
      amountCents: bundle.row.amount_cents,
      currency: bundle.row.currency,
      method,
      clearRisk: bundle.row.clear_risk,
      clearRiskReason: bundle.row.clear_risk_reason,
    });
  } catch (err) {
    return guardError(err);
  }
  const to = await recipientEmail(bundle.row);
  if (!to) return { error: "No email address for this customer" };
  const sent = await sendEmail({ to, subject: email.subject, html: email.html });
  if (!sent.success) return { error: sent.error || "Email failed" };
  const noticeSentAt = new Date();
  const earliest = new Date(noticeSentAt);
  if (!bundle.row.clear_risk) earliest.setUTCDate(earliest.getUTCDate() + 14);
  const admin = createAdminClient();
  await admin
    .from("payment_corrections")
    .update({
      notice_sent_at: noticeSentAt.toISOString(),
      earliest_recovery_at: earliest.toISOString(),
      status: bundle.state.disputeOpen ? bundle.row.status : "notified",
      updated_at: noticeSentAt.toISOString(),
    })
    .eq("id", correctionId);
  await writeEvent(correctionId, auth.user.id, "notice_sent", {
    to,
    clearRisk: bundle.row.clear_risk,
    clearRiskReason: bundle.row.clear_risk_reason,
  });
  refresh();
  return { ok: true as const };
}

export async function setClearRisk(formData: FormData) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const correctionId = String(formData.get("correction_id") || "");
  const bundle = await withActor(correctionId, auth.user.id);
  if (!bundle) return { error: "Correction not found" };
  const reasonCode = String(formData.get("clear_risk_reason_code") || "");
  const reason = String(formData.get("clear_risk_reason") || "");
  try {
    assertCanSetClearRisk({
      party: bundle.row.party,
      actorIsApprover: bundle.actorIsApprover,
      reasonCode,
      reason,
    });
  } catch (err) {
    return guardError(err);
  }
  const patch: Record<string, unknown> = {
    clear_risk: true,
    clear_risk_reason_code: reasonCode,
    clear_risk_reason: reason.trim(),
    updated_at: new Date().toISOString(),
  };
  if (bundle.row.notice_sent_at) {
    patch.earliest_recovery_at = bundle.row.notice_sent_at;
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_corrections")
    .update(patch)
    .eq("id", correctionId);
  if (error) return { error: error.message };
  await writeEvent(correctionId, auth.user.id, "clear_risk_set", {
    reasonCode,
    reason: reason.trim(),
  });
  refresh();
  return { ok: true as const };
}

export async function openDispute(formData: FormData) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const correctionId = String(formData.get("correction_id") || "");
  const bundle = await loadBundle(correctionId);
  if (!bundle) return { error: "Correction not found" };
  const now = new Date();
  const replyDue = new Date(now);
  replyDue.setUTCDate(replyDue.getUTCDate() + 14);
  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_corrections")
    .update({
      status: "disputed",
      disputed_at: now.toISOString(),
      dispute_reason: String(formData.get("dispute_reason") || "").trim(),
      dispute_reply_due_at: replyDue.toISOString(),
      disputed_amount_cents: bundle.row.amount_cents,
      dispute_resolved_at: null,
      dispute_outcome: null,
      updated_at: now.toISOString(),
    })
    .eq("id", correctionId);
  if (error) return { error: error.message };
  await writeEvent(correctionId, auth.user.id, "dispute_opened", {});
  refresh();
  return { ok: true as const };
}

export async function resolveDispute(formData: FormData) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const correctionId = String(formData.get("correction_id") || "");
  const outcome = String(formData.get("dispute_outcome") || "");
  const findings = String(formData.get("dispute_findings") || "").trim();
  if (outcome !== "customer_wins" && outcome !== "correction_upheld") {
    return { error: "Dispute outcome is required" };
  }
  if (!findings) return { error: "Findings are required" };
  const bundle = await withActor(correctionId, auth.user.id);
  if (!bundle) return { error: "Correction not found" };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("payment_corrections")
    .update({
      dispute_resolved_at: now,
      dispute_outcome: outcome,
      dispute_findings: findings,
      status: approvalsSatisfied(bundle.state) ? "approved" : "notified",
      director_reviewed_by: bundle.actorIsDirector ? auth.user.id : null,
      director_reviewed_at: bundle.actorIsDirector ? now : null,
      updated_at: now,
    })
    .eq("id", correctionId);
  if (error) return { error: error.message };
  await writeEvent(correctionId, auth.user.id, "dispute_resolved", { outcome });
  refresh();
  return { ok: true as const };
}

export async function escalateDoctorDispute(correctionId: string) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const bundle = await loadBundle(correctionId);
  if (!bundle) return { error: "Correction not found" };
  if (bundle.row.party !== "doctor") {
    return { error: "Only a doctor dispute can be escalated" };
  }
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_corrections")
    .update({ escalated_by_doctor_at: now, updated_at: now })
    .eq("id", correctionId);
  if (error) return { error: error.message };
  await writeEvent(correctionId, auth.user.id, "dispute_escalated", {});
  refresh();
  return { ok: true as const };
}

export async function recordPatientConsent(formData: FormData) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const correctionId = String(formData.get("correction_id") || "");
  const how = String(formData.get("how") || "").trim();
  if (!how) return { error: "Say how consent was given" };
  const bundle = await loadBundle(correctionId);
  if (!bundle || bundle.row.party !== "patient") {
    return { error: "Consent is recorded on patient corrections" };
  }
  await writeEvent(correctionId, auth.user.id, "patient_consent_recorded", {
    recorded_by: auth.user.id,
    recorded_at: new Date().toISOString(),
    how,
  });
  refresh();
  return { ok: true as const };
}

export async function recordCustomerResponse(formData: FormData) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const correctionId = String(formData.get("correction_id") || "");
  const response = String(formData.get("customer_response") || "").trim();
  if (!response) return { error: "Response is required" };
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_corrections")
    .update({
      customer_response: response,
      customer_responded_at: now,
      updated_at: now,
    })
    .eq("id", correctionId);
  if (error) return { error: error.message };
  await writeEvent(correctionId, auth.user.id, "customer_response", { response });
  refresh();
  return { ok: true as const };
}

async function guardAction(
  correctionId: string,
  actorId: string,
  action: CorrectionMoneyAction
) {
  const bundle = await withActor(correctionId, actorId);
  if (!bundle) return { error: "Correction not found" as const, bundle: null };
  try {
    assertMoneyMovement(bundle.state, action);
  } catch (err) {
    return { error: guardError(err).error, bundle: null };
  }
  return { error: null, bundle };
}

async function transferIdFor(row: CorrectionRow): Promise<string | null> {
  if (row.stripe_transfer_id) return row.stripe_transfer_id;
  if (!row.booking_id) return null;
  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("stripe_destination_transfer_id")
    .eq("id", row.booking_id)
    .maybeSingle();
  if (booking?.stripe_destination_transfer_id) {
    return booking.stripe_destination_transfer_id as string;
  }
  const { data: credit } = await admin
    .from("doctor_wallet_credit_transfers")
    .select("stripe_transfer_id")
    .eq("booking_id", row.booking_id)
    .maybeSingle();
  return (credit?.stripe_transfer_id as string | null) || null;
}

export async function runTransferReversal(formData: FormData) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const correctionId = String(formData.get("correction_id") || "");
  const amountCents = Number(formData.get("amount_cents") || 0);
  const guarded = await guardAction(correctionId, auth.user.id, "transfer_reversal");
  if (!guarded.bundle) return { error: guarded.error || "Not allowed" };
  const transferId = await transferIdFor(guarded.bundle.row);
  if (!transferId) return { error: "No Stripe transfer to reverse" };
  const amount =
    amountCents > 0 ? amountCents : guarded.bundle.row.amount_cents;
  try {
    const reversal = await executeTransferReversal({
      correctionId,
      transferId,
      amountCents: amount,
    });
    const outcome =
      amount >= guarded.bundle.row.amount_cents - guarded.bundle.row.recovered_cents
        ? "full"
        : "short";
    const admin = createAdminClient();
    const now = new Date().toISOString();
    await admin
      .from("payment_corrections")
      .update({
        recovery_method: "transfer_reversal",
        recovery_step: 1,
        recovered_cents: guarded.bundle.row.recovered_cents + amount,
        stripe_refund_id: reversal.reversalId,
        status: outcome === "full" ? "settled" : "recovering",
        settled_at: outcome === "full" ? now : null,
        updated_at: now,
      })
      .eq("id", correctionId);
    await writeEvent(correctionId, auth.user.id, "reversal_attempted", {
      outcome,
      amountCents: amount,
      reversalId: reversal.reversalId,
      transferId,
    });
  } catch (err) {
    await writeEvent(correctionId, auth.user.id, "reversal_attempted", {
      outcome: "failed",
      message: err instanceof Error ? err.message : "reversal failed",
    });
    const admin = createAdminClient();
    await admin
      .from("payment_corrections")
      .update({
        recovery_step: 1,
        status: "recovering",
        updated_at: new Date().toISOString(),
      })
      .eq("id", correctionId);
    refresh();
    return guardError(err);
  }
  refresh();
  return { ok: true as const };
}

export async function startPayoutOffset(correctionId: string) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const guarded = await guardAction(correctionId, auth.user.id, "payout_offset");
  if (!guarded.bundle) return { error: guarded.error || "Not allowed" };
  const remaining = Math.max(
    0,
    guarded.bundle.row.amount_cents - guarded.bundle.row.recovered_cents
  );
  if (remaining <= 0) return { error: "Nothing left to offset" };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("payment_corrections")
    .update({
      recovery_method: "payout_offset",
      recovery_step: 2,
      offset_remaining_cents: remaining,
      status: "recovering",
      updated_at: now,
    })
    .eq("id", correctionId);
  if (error) return { error: error.message };
  await writeEvent(correctionId, auth.user.id, "offset_started", {
    amountCents: remaining,
  });
  refresh();
  return { ok: true as const };
}

export async function markOffsetUncollectible(formData: FormData) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const correctionId = String(formData.get("correction_id") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "Say why a future payout cannot collect this" };
  const bundle = await withActor(correctionId, auth.user.id);
  if (!bundle) return { error: "Correction not found" };
  if (
    bundle.state.reversalOutcome !== "short" &&
    bundle.state.reversalOutcome !== "failed"
  ) {
    return { error: "Reversal must be tried before an offset is abandoned" };
  }
  await writeEvent(correctionId, auth.user.id, "offset_uncollectible", { reason });
  refresh();
  return { ok: true as const };
}

export async function sendDirectRequest(correctionId: string) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const guarded = await guardAction(correctionId, auth.user.id, "direct_request");
  if (!guarded.bundle) return { error: guarded.error || "Not allowed" };
  const to = await recipientEmail(guarded.bundle.row);
  if (!to) return { error: "No email address for this customer" };
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 30);
  const sent = await sendEmail({
    to,
    subject: "Please repay a payment correction",
    html: `<p>${guarded.bundle.row.reason}</p><p>Please repay within 30 days. We will not charge your card.</p>`,
  });
  if (!sent.success) return { error: sent.error || "Email failed" };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("payment_corrections")
    .update({
      recovery_method: "direct_request",
      recovery_step: 3,
      direct_request_sent_at: now,
      direct_request_due_at: due.toISOString(),
      status: "recovering",
      updated_at: now,
    })
    .eq("id", correctionId);
  await writeEvent(correctionId, auth.user.id, "direct_request_sent", { to });
  refresh();
  return { ok: true as const };
}

export async function runFavourableCorrection(correctionId: string) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const bundle = await withActor(correctionId, auth.user.id);
  if (!bundle) return { error: "Correction not found" };
  const row = bundle.row;
  try {
    if (row.party === "patient" && row.direction === "customer_favour") {
      if (row.error_type === "patient_credit_in_error") {
        assertMoneyMovement(bundle.state, "wallet_credit");
        if (!row.patient_id) return { error: "Patient is required" };
        await executeWalletAdjustment({
          patientId: row.patient_id,
          currency: row.currency,
          amountCents: row.amount_cents,
          direction: "credit",
          bookingId: row.booking_id,
          description: row.statement_line,
        });
      } else {
        assertMoneyMovement(bundle.state, "patient_refund");
        const refund = await executePatientCardRefund({
          correctionId,
          bookingId: row.booking_id || "",
          paymentIntentId: row.stripe_payment_intent_id,
          stripeChargeId: row.stripe_charge_id,
          amountCents: row.amount_cents,
        });
        await writeEvent(correctionId, auth.user.id, "refund_issued", refund);
      }
    } else if (row.party === "doctor" && row.error_type === "founding_payment") {
      assertMoneyMovement(bundle.state, "doctor_topup");
      const refund = await executeFoundingInvoiceRefund({
        correctionId,
        amountCents: row.amount_cents,
        stripeChargeId: row.stripe_charge_id,
        stripeInvoiceId: row.stripe_invoice_id,
      });
      await writeEvent(correctionId, auth.user.id, "refund_issued", refund);
    } else if (
      row.party === "doctor" &&
      (row.direction === "customer_favour" ||
        bundle.state.disputeOutcome === "customer_wins")
    ) {
      assertMoneyMovement(bundle.state, "doctor_topup");
      if (!row.doctor_id) return { error: "Doctor is required" };
      const admin = createAdminClient();
      const { data: doctor } = await admin
        .from("doctors")
        .select("stripe_account_id")
        .eq("id", row.doctor_id)
        .maybeSingle();
      if (!doctor?.stripe_account_id) {
        return { error: "Doctor has no Stripe account for a top-up" };
      }
      const transfer = await executeDoctorTopup({
        correctionId,
        amountCents: row.amount_cents,
        currency: row.currency,
        destinationAccountId: doctor.stripe_account_id,
      });
      await writeEvent(correctionId, auth.user.id, "doctor_topup", transfer);
    } else {
      return { error: "This correction is not a customer-favour repayment" };
    }
  } catch (err) {
    return guardError(err);
  }
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("payment_corrections")
    .update({
      status: "settled",
      settled_at: now,
      recovered_cents: row.amount_cents,
      updated_at: now,
    })
    .eq("id", correctionId);
  await writeEvent(correctionId, auth.user.id, "settled", {});
  refresh();
  return { ok: true as const };
}

export async function runWalletDebit(correctionId: string) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const guarded = await guardAction(correctionId, auth.user.id, "wallet_debit");
  if (!guarded.bundle) return { error: guarded.error || "Not allowed" };
  if (!guarded.bundle.row.patient_id) return { error: "Patient is required" };
  try {
    await executeWalletAdjustment({
      patientId: guarded.bundle.row.patient_id,
      currency: guarded.bundle.row.currency,
      amountCents: guarded.bundle.row.amount_cents,
      direction: "debit",
      bookingId: guarded.bundle.row.booking_id,
      description: guarded.bundle.row.statement_line,
    });
  } catch (err) {
    return guardError(err);
  }
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("payment_corrections")
    .update({
      recovery_method: "wallet_adjustment",
      status: "settled",
      settled_at: now,
      updated_at: now,
    })
    .eq("id", correctionId);
  await writeEvent(correctionId, auth.user.id, "wallet_adjusted", { direction: "debit" });
  refresh();
  return { ok: true as const };
}

export async function settleCorrection(correctionId: string) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const now = new Date().toISOString();
  const admin = createAdminClient();
  await admin
    .from("payment_corrections")
    .update({ status: "settled", settled_at: now, updated_at: now })
    .eq("id", correctionId);
  await writeEvent(correctionId, auth.user.id, "settled", {});
  refresh();
  return { ok: true as const };
}

export async function waiveCorrection(correctionId: string) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const admin = createAdminClient();
  await admin
    .from("payment_corrections")
    .update({ status: "waived", updated_at: new Date().toISOString() })
    .eq("id", correctionId);
  await writeEvent(correctionId, auth.user.id, "waived", {});
  refresh();
  return { ok: true as const };
}

export async function setOurErrorFlag(correctionId: string, ourError: boolean) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_corrections")
    .update({ our_error: ourError, updated_at: new Date().toISOString() })
    .eq("id", correctionId);
  if (error) return { error: error.message };
  await writeEvent(correctionId, auth.user.id, "our_error_set", { ourError });
  refresh();
  return { ok: true as const };
}

export async function recreateFoundingFromCorrection(correctionId: string) {
  const auth = await requireAdminUser();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const bundle = await withActor(correctionId, auth.user.id);
  if (!bundle) return { error: "Correction not found" };
  if (!bundle.row.doctor_id) return { error: "Doctor is required" };
  const admin = createAdminClient();
  const { data: doctor } = await admin
    .from("doctors")
    .select("id, organization_id, founding_member_number")
    .eq("id", bundle.row.doctor_id)
    .maybeSingle();
  if (!doctor?.organization_id) return { error: "Doctor organisation is missing" };
  const { data: org } = await admin
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", doctor.organization_id)
    .maybeSingle();
  if (!org?.stripe_customer_id) return { error: "No Stripe customer for this organisation" };
  try {
    assertCanRecreateFounding({
      actorIsApprover: bundle.actorIsApprover,
      approvalsMet: approvalsSatisfied(bundle.state),
      ourError: bundle.row.our_error,
      party: bundle.row.party,
      hasFoundingNumber: Boolean(doctor.founding_member_number),
      disputeOpen: bundle.state.disputeOpen,
    });
    const created = await recreateFoundingSubscription({
      correctionId,
      doctorId: doctor.id,
      organizationId: doctor.organization_id,
      customerId: org.stripe_customer_id,
    });
    await writeEvent(correctionId, auth.user.id, "founding_subscription_recreated", created);
  } catch (err) {
    return guardError(err);
  }
  refresh();
  return { ok: true as const };
}
