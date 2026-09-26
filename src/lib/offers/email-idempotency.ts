export type ServiceEmailEvent = "trial_reminder_7d" | "price_change_30d";

export function trialReminderKey(stripeSubscriptionId: string): string {
  return `trial_reminder_7d:${stripeSubscriptionId}`;
}

export function priceChangeNoticeKey(stripeScheduleId: string): string {
  return `price_change_30d:${stripeScheduleId}`;
}

export type ServiceEmailClaim = {
  idempotencyKey: string;
  eventKind: ServiceEmailEvent;
  stripeSubscriptionId: string | null;
  recipientEmail: string;
};

export interface ServiceEmailLog {
  claim(row: ServiceEmailClaim): Promise<"claimed" | "duplicate">;
  complete(idempotencyKey: string, status: "sent" | "suppressed"): Promise<void>;
  release(idempotencyKey: string): Promise<void>;
  /** Audit-only row. Must not reuse the send idempotency key. */
  recordSuppressed(row: ServiceEmailClaim): Promise<void>;
}

/** Separate key so a suppressed audit row cannot block a later real send. */
export function suppressedAuditKey(idempotencyKey: string, at: Date = new Date()): string {
  return `${idempotencyKey}:suppressed:${at.toISOString()}`;
}

export type DeliverInput = {
  claim: ServiceEmailClaim;
  allowed: boolean;
  subject: string;
  html: string;
};

export type DeliverStatus = "sent" | "suppressed" | "duplicate" | "failed";

/**
 * Insert-then-send. A unique key means a retry cannot email twice.
 * A failed send releases the pending row so a later run can try again.
 * A recipient outside the current allowlist releases that pending row and
 * writes a separate suppressed audit row, so turning the allowlist off later
 * can still send that reminder.
 */
export async function deliverIdempotentServiceEmail(
  log: ServiceEmailLog,
  send: (input: { to: string; subject: string; html: string }) => Promise<{ success: boolean }>,
  input: DeliverInput
): Promise<DeliverStatus> {
  const claimed = await log.claim(input.claim);
  if (claimed === "duplicate") return "duplicate";

  if (!input.allowed) {
    await log.release(input.claim.idempotencyKey);
    await log.recordSuppressed(input.claim);
    return "suppressed";
  }

  try {
    const result = await send({
      to: input.claim.recipientEmail,
      subject: input.subject,
      html: input.html,
    });
    if (!result.success) {
      await log.release(input.claim.idempotencyKey);
      return "failed";
    }
    await log.complete(input.claim.idempotencyKey, "sent");
    return "sent";
  } catch {
    await log.release(input.claim.idempotencyKey);
    return "failed";
  }
}
