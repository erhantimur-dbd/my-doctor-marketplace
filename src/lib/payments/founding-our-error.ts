import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/utils/logger";

export function licenseStatusKeepingFounding(input: {
  mapped: string;
  ourError: boolean;
}): string {
  if (
    input.ourError &&
    (input.mapped === "past_due" || input.mapped === "grace_period")
  ) {
    return "active";
  }
  return input.mapped;
}

export function shouldForfeitFoundingOnDelete(input: {
  wasLive: boolean;
  ourError: boolean;
}): boolean {
  return input.wasLive && !input.ourError;
}

export function shouldSkipFoundingEnforcement(ourError: boolean): boolean {
  return ourError;
}

type QueryError = { code?: string; message?: string } | null;

function tableMissing(error: QueryError): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205";
}

/**
 * An our-error founding correction keeps the £99 place.
 * Waived rows stop protecting. Settled rows still protect: the failure was ours.
 * Does not send email.
 */
export async function foundingFailureIsOurError(
  supabase: SupabaseClient,
  input: { subscriptionId?: string | null; doctorId?: string | null }
): Promise<boolean> {
  if (!input.subscriptionId && !input.doctorId) return false;
  try {
    let query = supabase
      .from("payment_corrections")
      .select("id")
      .eq("our_error", true)
      .eq("party", "doctor")
      .eq("error_type", "founding_payment")
      .neq("status", "waived")
      .limit(1);
    if (input.subscriptionId && input.doctorId) {
      query = query.or(
        `stripe_subscription_id.eq.${input.subscriptionId},doctor_id.eq.${input.doctorId}`
      );
    } else if (input.subscriptionId) {
      query = query.eq("stripe_subscription_id", input.subscriptionId);
    } else if (input.doctorId) {
      query = query.eq("doctor_id", input.doctorId);
    }
    const { data, error } = await query;
    if (error) {
      if (tableMissing(error)) return false;
      log.error("[payment-correction] our-error lookup failed", { err: error });
      return false;
    }
    return Boolean(data && data.length > 0);
  } catch (err) {
    log.error("[payment-correction] our-error lookup failed", { err });
    return false;
  }
}

/** Attach a failed invoice id to an existing correction. Never emails. */
export async function noteFoundingInvoiceFailure(
  supabase: SupabaseClient,
  input: { subscriptionId?: string | null; invoiceId?: string | null }
): Promise<void> {
  if (!input.subscriptionId || !input.invoiceId) return;
  try {
    const { error } = await supabase
      .from("payment_corrections")
      .update({
        stripe_invoice_id: input.invoiceId,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", input.subscriptionId)
      .eq("error_type", "founding_payment")
      .neq("status", "waived");
    if (error && !tableMissing(error)) {
      log.error("[payment-correction] invoice note failed", { err: error });
    }
  } catch (err) {
    log.error("[payment-correction] invoice note failed", { err });
  }
}
