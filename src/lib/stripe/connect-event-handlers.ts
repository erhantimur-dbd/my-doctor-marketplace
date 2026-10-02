import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { sendEmail } from "@/lib/email/client";
import { createNotification } from "@/lib/notifications";

/**
 * Destination charges (on_behalf_of + transfer_data.destination) create the
 * Charge and the Transfer on the platform account. transfer.reversed and
 * charge.dispute.created therefore arrive on the platform webhook with
 * event.account unset. A Connect-endpoint delivery, if one is subscribed,
 * sets event.account. Match on the object id either way.
 *
 * Refund and reversal code already writes doctor_wallet_credit_transfers.reversed_cents.
 * This handler never adds that column on top of the stored value. It sets the
 * column to Stripe's cumulative amount_reversed only when Stripe is ahead,
 * and otherwise stamps reversal_reconciled_at.
 */

const BOOKING_TRANSFER_COLUMNS =
  "id, doctor_id, booking_number, stripe_destination_transfer_id, stripe_reassignment_transfer_id, destination_transfer_reversed_cents";

export interface TransferReversalRecord {
  nextReversedCents: number;
  alreadyRecorded: boolean;
}

/** Stripe amount_reversed is cumulative. Never add it to the stored total. */
export function transferReversalRecord(input: {
  storedReversedCents: number | null | undefined;
  stripeAmountReversedCents: number;
}): TransferReversalRecord {
  const stored = Math.max(0, Math.round(input.storedReversedCents || 0));
  const stripeAmount = Math.max(0, Math.round(input.stripeAmountReversedCents || 0));
  if (stored >= stripeAmount) {
    return { nextReversedCents: stored, alreadyRecorded: true };
  }
  return { nextReversedCents: stripeAmount, alreadyRecorded: false };
}

export function transferAmountReversedCents(transfer: {
  amount_reversed?: number | null;
  reversals?: { data?: Array<{ amount?: number | null }> } | null;
}): number {
  if (
    typeof transfer.amount_reversed === "number" &&
    transfer.amount_reversed > 0
  ) {
    return transfer.amount_reversed;
  }
  const summed = (transfer.reversals?.data ?? []).reduce(
    (sum, row) => sum + (typeof row.amount === "number" ? row.amount : 0),
    0
  );
  return summed;
}

function latestReversal(transfer: Stripe.Transfer): Stripe.TransferReversal | null {
  const rows = transfer.reversals?.data ?? [];
  if (rows.length === 0) return null;
  return rows.reduce((best, row) => (row.created > best.created ? row : best));
}

function reversedAtIso(transfer: Stripe.Transfer, eventCreated: number): string {
  const latest = latestReversal(transfer);
  const unix = latest?.created ?? eventCreated;
  return new Date(unix * 1000).toISOString();
}

function connectedAccountId(transfer: Stripe.Transfer): string | null {
  const destination = transfer.destination;
  if (!destination) return null;
  return typeof destination === "string" ? destination : destination.id;
}

async function doctorAccountMatches(
  supabase: SupabaseClient,
  doctorId: string,
  eventAccount: string | undefined
): Promise<boolean> {
  if (!eventAccount) return true;
  const { data, error } = await supabase
    .from("doctors")
    .select("stripe_account_id")
    .eq("id", doctorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const stored = data?.stripe_account_id;
  if (!stored) return true;
  return stored === eventAccount;
}

async function insertReversalAudit(
  supabase: SupabaseClient,
  row: {
    stripe_event_id: string;
    stripe_transfer_id: string;
    stripe_reversal_id: string | null;
    amount_reversed_cents: number;
    reversed_at: string;
    booking_id: string | null;
    wallet_credit_transfer_id: string | null;
    connected_account_id: string | null;
    match_kind: "booking_destination" | "booking_reassignment" | "wallet_credit";
    already_recorded: boolean;
  }
): Promise<void> {
  const { error } = await supabase
    .from("stripe_transfer_reversal_audits")
    .insert(row);
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function handleTransferReversed(
  supabase: SupabaseClient,
  event: Stripe.Event
): Promise<{ matched: boolean }> {
  const transfer = event.data.object as Stripe.Transfer;
  const transferId = transfer.id;
  const amountReversed = transferAmountReversedCents(transfer);
  const reversedAt = reversedAtIso(transfer, event.created);
  const reversal = latestReversal(transfer);
  const eventAccount = event.account;
  let matched = false;

  const { data: destinationBooking, error: destinationError } = await supabase
    .from("bookings")
    .select(BOOKING_TRANSFER_COLUMNS)
    .eq("stripe_destination_transfer_id", transferId)
    .maybeSingle();
  if (destinationError) throw new Error(destinationError.message);

  const { data: reassignmentBooking, error: reassignmentError } = await supabase
    .from("bookings")
    .select(BOOKING_TRANSFER_COLUMNS)
    .eq("stripe_reassignment_transfer_id", transferId)
    .maybeSingle();
  if (reassignmentError) throw new Error(reassignmentError.message);

  const { data: creditTransfer, error: creditError } = await supabase
    .from("doctor_wallet_credit_transfers")
    .select(
      "id, booking_id, doctor_id, amount_cents, reversed_cents, status, stripe_transfer_id"
    )
    .eq("stripe_transfer_id", transferId)
    .maybeSingle();
  if (creditError) throw new Error(creditError.message);

  if (destinationBooking) {
    matched = true;
    const allowed = await doctorAccountMatches(
      supabase,
      destinationBooking.doctor_id,
      eventAccount
    );
    if (!allowed) {
      console.warn(
        `[Stripe] transfer.reversed ${transferId} skipped: event.account does not match booking ${destinationBooking.id} doctor`
      );
    } else {
      const record = transferReversalRecord({
        storedReversedCents: destinationBooking.destination_transfer_reversed_cents,
        stripeAmountReversedCents: amountReversed,
      });
      const patch: Record<string, unknown> = {
        destination_transfer_reversal_reconciled_at: reversedAt,
      };
      if (!record.alreadyRecorded) {
        patch.destination_transfer_reversed_cents = record.nextReversedCents;
        patch.destination_transfer_reversed_at = reversedAt;
      }
      const { error } = await supabase
        .from("bookings")
        .update(patch)
        .eq("id", destinationBooking.id);
      if (error) throw new Error(error.message);
      await insertReversalAudit(supabase, {
        stripe_event_id: event.id,
        stripe_transfer_id: transferId,
        stripe_reversal_id: reversal?.id ?? null,
        amount_reversed_cents: amountReversed,
        reversed_at: reversedAt,
        booking_id: destinationBooking.id,
        wallet_credit_transfer_id: null,
        connected_account_id: eventAccount ?? connectedAccountId(transfer),
        match_kind: "booking_destination",
        already_recorded: record.alreadyRecorded,
      });
    }
  }

  if (
    reassignmentBooking &&
    reassignmentBooking.id !== destinationBooking?.id
  ) {
    matched = true;
    const allowed = await doctorAccountMatches(
      supabase,
      reassignmentBooking.doctor_id,
      eventAccount
    );
    if (!allowed) {
      console.warn(
        `[Stripe] transfer.reversed ${transferId} skipped: event.account does not match reassignment booking ${reassignmentBooking.id}`
      );
    } else {
      await insertReversalAudit(supabase, {
        stripe_event_id: event.id,
        stripe_transfer_id: transferId,
        stripe_reversal_id: reversal?.id ?? null,
        amount_reversed_cents: amountReversed,
        reversed_at: reversedAt,
        booking_id: reassignmentBooking.id,
        wallet_credit_transfer_id: null,
        connected_account_id: eventAccount ?? connectedAccountId(transfer),
        match_kind: "booking_reassignment",
        already_recorded: false,
      });
    }
  }

  if (creditTransfer) {
    matched = true;
    const allowed = await doctorAccountMatches(
      supabase,
      creditTransfer.doctor_id,
      eventAccount
    );
    if (!allowed) {
      console.warn(
        `[Stripe] transfer.reversed ${transferId} skipped: event.account does not match wallet credit transfer ${creditTransfer.id}`
      );
    } else {
      const record = transferReversalRecord({
        storedReversedCents: creditTransfer.reversed_cents,
        stripeAmountReversedCents: amountReversed,
      });
      const patch: Record<string, unknown> = {
        reversal_reconciled_at: reversedAt,
      };
      if (!record.alreadyRecorded) {
        patch.reversed_cents = record.nextReversedCents;
        patch.status =
          record.nextReversedCents >= creditTransfer.amount_cents
            ? "reversed"
            : "partially_reversed";
      }
      const { error } = await supabase
        .from("doctor_wallet_credit_transfers")
        .update(patch)
        .eq("id", creditTransfer.id);
      if (error) throw new Error(error.message);
      await insertReversalAudit(supabase, {
        stripe_event_id: event.id,
        stripe_transfer_id: transferId,
        stripe_reversal_id: reversal?.id ?? null,
        amount_reversed_cents: amountReversed,
        reversed_at: reversedAt,
        booking_id: creditTransfer.booking_id,
        wallet_credit_transfer_id: creditTransfer.id,
        connected_account_id: eventAccount ?? connectedAccountId(transfer),
        match_kind: "wallet_credit",
        already_recorded: record.alreadyRecorded,
      });
    }
  }

  if (!matched) {
    console.info(
      `[Stripe] transfer.reversed ${transferId} matched no booking or credit transfer`
    );
  }
  return { matched };
}

const OPEN_STRIPE_DISPUTE_STATUSES = new Set([
  "needs_response",
  "under_review",
  "warning_needs_response",
  "warning_under_review",
]);

/** Closed-at is set once, when the status leaves the open set, and is not moved. */
export function stripeDisputeClosedAt(
  status: string,
  existing: string | null | undefined,
  nowIso: string
): string | undefined {
  if (OPEN_STRIPE_DISPUTE_STATUSES.has(status)) return undefined;
  return existing ?? nowIso;
}

function disputeChargeId(dispute: Stripe.Dispute): string | null {
  const charge = dispute.charge;
  if (!charge) return null;
  return typeof charge === "string" ? charge : charge.id;
}

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

async function notifyAdminsOfDispute(input: {
  supabase: SupabaseClient;
  bookingId: string;
  bookingNumber: string | null;
  disputeId: string;
  amountCents: number;
  currency: string;
  reason: string;
  status: string;
}): Promise<void> {
  const label = input.bookingNumber || input.bookingId;
  const subject = `Card dispute opened on booking ${label}`;
  const text =
    `A card dispute was opened. No refund and no transfer reversal were made. ` +
    `dispute ${input.disputeId}, status ${input.status}, reason ${input.reason}, ` +
    `amount ${input.amountCents} ${input.currency.toUpperCase()}, booking ${input.bookingId}.`;
  const html = `<p>${text}</p>`;

  const { data: admins, error } = await input.supabase
    .from("profiles")
    .select("id, email")
    .eq("role", "admin");
  if (error) throw new Error(error.message);

  const emails = new Set(parseAdminEmails());
  for (const admin of admins || []) {
    if (admin.email) emails.add(admin.email);
    const created = await createNotification({
      userId: admin.id,
      type: "charge_dispute_created",
      title: subject,
      message: text,
      channels: ["in_app"],
      metadata: {
        booking_id: input.bookingId,
        dispute_id: input.disputeId,
        amount_cents: input.amountCents,
        reason: input.reason,
        status: input.status,
      },
    });
    if (!created.success) {
      throw new Error("Admin dispute notification was not stored");
    }
  }

  if (emails.size === 0) {
    throw new Error("No admin recipient for the dispute alert");
  }

  for (const to of emails) {
    const sent = await sendEmail({ to, subject, html });
    if (!sent.success) {
      throw new Error(sent.error || "Admin dispute email failed");
    }
  }
}

export async function handleChargeDisputeCreated(
  supabase: SupabaseClient,
  event: Stripe.Event
): Promise<{ matched: boolean }> {
  return syncBookingDispute(supabase, event, true);
}

export async function handleChargeDisputeUpdated(
  supabase: SupabaseClient,
  event: Stripe.Event
): Promise<{ matched: boolean }> {
  return syncBookingDispute(supabase, event, false);
}

async function syncBookingDispute(
  supabase: SupabaseClient,
  event: Stripe.Event,
  notify: boolean
): Promise<{ matched: boolean }> {
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId = disputeChargeId(dispute);
  if (!chargeId) return { matched: false };

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, doctor_id, booking_number, stripe_charge_id, stripe_dispute_closed_at")
    .eq("stripe_charge_id", chargeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!booking) {
    console.info(
      `[Stripe] charge.dispute.created ${dispute.id} charge ${chargeId} matched no booking`
    );
    return { matched: false };
  }

  const allowed = await doctorAccountMatches(
    supabase,
    booking.doctor_id,
    event.account
  );
  if (!allowed) {
    console.warn(
      `[Stripe] charge.dispute.created ${dispute.id} skipped: event.account does not match booking ${booking.id} doctor`
    );
    return { matched: false };
  }

  const createdAt = new Date(dispute.created * 1000).toISOString();
  const closedAt = stripeDisputeClosedAt(
    dispute.status,
    booking.stripe_dispute_closed_at,
    new Date().toISOString()
  );
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      stripe_dispute_id: dispute.id,
      stripe_dispute_status: dispute.status,
      stripe_dispute_amount_cents: dispute.amount,
      stripe_dispute_reason: dispute.reason,
      stripe_dispute_created_at: createdAt,
      stripe_dispute_account_id: event.account ?? null,
      ...(closedAt ? { stripe_dispute_closed_at: closedAt } : {}),
    })
    .eq("id", booking.id);
  if (updateError) throw new Error(updateError.message);

  if (!notify) return { matched: true };

  await notifyAdminsOfDispute({
    supabase,
    bookingId: booking.id,
    bookingNumber: booking.booking_number ?? null,
    disputeId: dispute.id,
    amountCents: dispute.amount,
    currency: dispute.currency || "gbp",
    reason: dispute.reason || "unknown",
    status: dispute.status,
  });

  return { matched: true };
}
