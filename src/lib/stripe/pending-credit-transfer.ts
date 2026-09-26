/**
 * Reconcile doctor_wallet_credit_transfers left pending after a Stripe call.
 *
 * #61 creates the platform transfer with transfer_group booking_{bookingId}
 * and metadata booking_id + kind wallet_credit_share. This job lists that
 * group on the platform account. It never creates a transfer and never
 * debits the wallet.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { createNotification } from "@/lib/notifications";
import { log } from "@/lib/utils/logger";
import { getStripe } from "@/lib/stripe/client";
import {
  WALLET_CREDIT_SHARE_KIND,
  walletCreditTransferGroup,
  type WalletCreditTransferRecord,
} from "@/lib/stripe/wallet-credit-share";

export const PENDING_TRANSFER_GRACE_MS = 15 * 60 * 1000;

const MISSING_ALERT_KEY = "wallet_credit_transfer_missing";
const RESTORED_ALERT_KEY = "wallet_credit_transfer_paid_credit_restored";

export type PendingTransferAlertKind =
  | "missing_transfer"
  | "paid_but_credit_restored";

export interface ListedPlatformTransfer {
  id: string;
  amount: number;
  destination?: string | null;
  metadata?: Record<string, string> | null;
}

export interface PendingTransferAlert {
  /** True when this run won the once-only claim. */
  claim(key: string): Promise<boolean>;
  release(key: string): Promise<void>;
  send(input: {
    kind: PendingTransferAlertKind;
    bookingId: string;
    doctorId: string;
    amountCents: number;
  }): Promise<void>;
}

export interface PendingCreditTransferDeps {
  now?: Date;
  listTransfers?(input: {
    transferGroup: string;
    destinationAccountId: string | null;
  }): Promise<ListedPlatformTransfer[]>;
  doctorStripeAccountId?(doctorId: string): Promise<string | null>;
  /** Full-credit booking whose wallet credit was credited back. */
  fullCreditWasRestored?(bookingId: string): Promise<boolean>;
  markPaidIfPending?(
    bookingId: string,
    transferId: string
  ): Promise<boolean>;
  alert?: PendingTransferAlert;
}

export function isStalePendingCreditTransfer(
  row: Pick<WalletCreditTransferRecord, "status" | "created_at">,
  now: Date
): boolean {
  if (row.status !== "pending") return false;
  const created = new Date(row.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return now.getTime() - created >= PENDING_TRANSFER_GRACE_MS;
}

export function matchingWalletCreditTransfer(
  row: Pick<WalletCreditTransferRecord, "booking_id" | "amount_cents">,
  transfers: ListedPlatformTransfer[]
): ListedPlatformTransfer | null {
  const match = transfers.find((transfer) => {
    const metadata = transfer.metadata || {};
    return (
      metadata.booking_id === row.booking_id &&
      metadata.kind === WALLET_CREDIT_SHARE_KIND &&
      transfer.amount === row.amount_cents
    );
  });
  return match ?? null;
}

function alertKey(kind: PendingTransferAlertKind, bookingId: string): string {
  const prefix =
    kind === "missing_transfer" ? MISSING_ALERT_KEY : RESTORED_ALERT_KEY;
  return `${prefix}:${bookingId}`;
}

async function alertOnce(
  alert: PendingTransferAlert,
  input: {
    kind: PendingTransferAlertKind;
    bookingId: string;
    doctorId: string;
    amountCents: number;
  }
): Promise<"sent" | "already_sent"> {
  const key = alertKey(input.kind, input.bookingId);
  const claimed = await alert.claim(key);
  if (!claimed) return "already_sent";
  try {
    await alert.send(input);
    return "sent";
  } catch (err) {
    await alert.release(key).catch(() => undefined);
    throw err;
  }
}

export type ReconcileOneResult =
  | { action: "ignored" }
  | { action: "marked_paid"; transferId: string; restoredAlert: "sent" | "already_sent" | "none" }
  | { action: "missing"; alert: "sent" | "already_sent" }
  | { action: "stripe_error" };

/**
 * Inspect one ledger row. Paid rows and rows younger than 15 minutes are
 * left untouched. A found transfer is recorded as paid. A missing transfer
 * stays pending and alerts an admin once.
 */
export async function reconcilePendingCreditTransfer(
  row: WalletCreditTransferRecord,
  deps: PendingCreditTransferDeps = {}
): Promise<ReconcileOneResult> {
  const now = deps.now ?? new Date();
  if (!isStalePendingCreditTransfer(row, now)) {
    return { action: "ignored" };
  }

  const destinationAccountId = deps.doctorStripeAccountId
    ? await deps.doctorStripeAccountId(row.doctor_id)
    : await defaultDoctorStripeAccountId(row.doctor_id);

  let transfers: ListedPlatformTransfer[];
  try {
    const list = deps.listTransfers ?? defaultListTransfers;
    transfers = await list({
      transferGroup: walletCreditTransferGroup(row.booking_id),
      destinationAccountId,
    });
  } catch (err) {
    log.error("[wallet-credit] pending transfer lookup failed", {
      err,
      bookingId: row.booking_id,
    });
    return { action: "stripe_error" };
  }

  const found = matchingWalletCreditTransfer(row, transfers);
  const alert = deps.alert ?? defaultAlert(row.doctor_id);

  if (found) {
    const restored = deps.fullCreditWasRestored
      ? await deps.fullCreditWasRestored(row.booking_id)
      : await defaultFullCreditWasRestored(row.booking_id);

    // Alert before the paid update. A failed send releases the claim and
    // leaves the row pending so the next run can retry. Marking paid first
    // would hide the row from later runs and drop the alert.
    let restoredAlert: "sent" | "already_sent" | "none" = "none";
    if (restored) {
      restoredAlert = await alertOnce(alert, {
        kind: "paid_but_credit_restored",
        bookingId: row.booking_id,
        doctorId: row.doctor_id,
        amountCents: row.amount_cents,
      });
    }

    const mark = deps.markPaidIfPending ?? defaultMarkPaidIfPending;
    await mark(row.booking_id, found.id);
    return { action: "marked_paid", transferId: found.id, restoredAlert };
  }

  const missing = await alertOnce(alert, {
    kind: "missing_transfer",
    bookingId: row.booking_id,
    doctorId: row.doctor_id,
    amountCents: row.amount_cents,
  });
  return { action: "missing", alert: missing };
}

export async function reconcileStalePendingCreditTransfers(
  deps: PendingCreditTransferDeps = {}
): Promise<{
  checked: number;
  markedPaid: number;
  missingAlerts: number;
  restoredAlerts: number;
  ignored: number;
}> {
  const now = deps.now ?? new Date();
  const cutoff = new Date(now.getTime() - PENDING_TRANSFER_GRACE_MS).toISOString();
  const rows = await listStalePending(cutoff);
  let markedPaid = 0;
  let missingAlerts = 0;
  let restoredAlerts = 0;
  let ignored = 0;

  for (const row of rows) {
    const result = await reconcilePendingCreditTransfer(row, { ...deps, now });
    if (result.action === "ignored") ignored += 1;
    if (result.action === "marked_paid") {
      markedPaid += 1;
      if (result.restoredAlert === "sent") restoredAlerts += 1;
    }
    if (result.action === "missing" && result.alert === "sent") missingAlerts += 1;
  }

  return {
    checked: rows.length,
    markedPaid,
    missingAlerts,
    restoredAlerts,
    ignored,
  };
}

async function listStalePending(
  cutoffIso: string
): Promise<WalletCreditTransferRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("doctor_wallet_credit_transfers")
    .select("*")
    .eq("status", "pending")
    .lte("created_at", cutoffIso);
  if (error) throw new Error(error.message);
  return (data || []) as WalletCreditTransferRecord[];
}

async function defaultDoctorStripeAccountId(
  doctorId: string
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("doctors")
    .select("stripe_account_id")
    .eq("id", doctorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.stripe_account_id ?? null;
}

async function defaultListTransfers(input: {
  transferGroup: string;
  destinationAccountId: string | null;
}): Promise<ListedPlatformTransfer[]> {
  const stripe = getStripe();
  const listed = await stripe.transfers.list({
    transfer_group: input.transferGroup,
    ...(input.destinationAccountId
      ? { destination: input.destinationAccountId }
      : {}),
    limit: 20,
  });
  return listed.data.map((transfer) => ({
    id: transfer.id,
    amount: transfer.amount,
    destination:
      typeof transfer.destination === "string"
        ? transfer.destination
        : transfer.destination?.id ?? null,
    metadata: transfer.metadata,
  }));
}

async function defaultMarkPaidIfPending(
  bookingId: string,
  transferId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("doctor_wallet_credit_transfers")
    .update({ status: "paid", stripe_transfer_id: transferId })
    .eq("booking_id", bookingId)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(error.message);
  return Boolean(data && data.length > 0);
}

async function defaultFullCreditWasRestored(bookingId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("stripe_payment_intent_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError) throw new Error(bookingError.message);
  if (booking?.stripe_payment_intent_id) return false;

  const { data: credits, error: creditError } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("source_booking_id", bookingId)
    .eq("type", "credit")
    .limit(1);
  if (creditError) throw new Error(creditError.message);
  return Boolean(credits && credits.length > 0);
}

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function alertCopy(input: {
  kind: PendingTransferAlertKind;
  bookingId: string;
  doctorId: string;
  amountCents: number;
}): { subject: string; text: string } {
  const amount = `${(input.amountCents / 100).toFixed(2)} (${input.amountCents} cents)`;
  const ids = `booking_id ${input.bookingId}, doctor_id ${input.doctorId}, amount ${amount}`;
  if (input.kind === "paid_but_credit_restored") {
    return {
      subject: "Doctor credit transfer needs a human decision",
      text:
        `The doctor's MyDoctors360 credit transfer exists in Stripe, but the patient's wallet credit was already returned. ` +
        `The wallet was not debited again. ${ids}`,
    };
  }
  return {
    subject: "Pending doctor credit transfer was not found in Stripe",
    text:
      `A doctor credit transfer is still pending and no matching Stripe transfer was found. ${ids}`,
  };
}

function defaultAlert(doctorId: string): PendingTransferAlert {
  return {
    async claim(key) {
      const supabase = createAdminClient();
      const { error } = await supabase.from("compliance_notifications_sent").insert({
        doctor_id: doctorId,
        notification_key: key,
      });
      if (!error) return true;
      if (error.code === "23505") return false;
      throw new Error(error.message);
    },
    async release(key) {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("compliance_notifications_sent")
        .delete()
        .eq("doctor_id", doctorId)
        .eq("notification_key", key);
      if (error) throw new Error(error.message);
    },
    async send(input) {
      const { subject, text } = alertCopy(input);
      const html = `<p>${text}</p>`;
      const supabase = createAdminClient();
      const { data: admins, error } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("role", "admin");
      if (error) throw new Error(error.message);

      const emails = new Set(parseAdminEmails());
      for (const admin of admins || []) {
        if (admin.email) emails.add(admin.email);
        await createNotification({
          userId: admin.id,
          type: input.kind,
          title: subject,
          message: text,
          channels: ["in_app"],
          metadata: {
            booking_id: input.bookingId,
            doctor_id: input.doctorId,
            amount_cents: input.amountCents,
          },
        });
      }

      if (emails.size === 0) {
        throw new Error("No admin recipient for the credit transfer alert");
      }

      for (const to of emails) {
        const sent = await sendEmail({ to, subject, html });
        if (!sent.success) {
          throw new Error(sent.error || "Admin alert email failed");
        }
      }
    },
  };
}
