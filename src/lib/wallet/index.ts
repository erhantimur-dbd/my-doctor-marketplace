/**
 * Patient wallet service — manages credit balances for instant refunds.
 *
 * Uses admin client (service role) + SECURITY DEFINER RPCs for atomic
 * balance updates. All mutations are recorded in the wallet_transactions ledger.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type WalletSourceType =
  | "refund"
  | "cancel_rebook"
  | "referral"
  | "promotion"
  | "admin_manual"
  | "top_up"
  | "gift_card"
  | "loyalty";

interface CreditParams {
  patientId: string;
  currency: string;
  amountCents: number;
  sourceType: WalletSourceType;
  sourceBookingId?: string;
  description?: string;
  expiresAt?: string; // ISO timestamp — for promotional credits
}

interface DebitParams {
  patientId: string;
  currency: string;
  amountCents: number;
  sourceType: WalletSourceType;
  targetBookingId?: string;
  description?: string;
}

interface WalletBalance {
  balance_cents: number;
  currency: string;
}

interface WalletTransaction {
  id: string;
  type: "credit" | "debit";
  amount_cents: number;
  currency: string;
  balance_after_cents: number;
  source_type: string;
  source_booking_id: string | null;
  target_booking_id: string | null;
  description: string | null;
  created_at: string;
}

/**
 * Get wallet balance for a patient in a specific currency.
 * Returns 0 if no wallet exists yet.
 */
export async function getWalletBalance(
  patientId: string,
  currency: string
): Promise<WalletBalance> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("patient_wallet")
    .select("balance_cents, currency")
    .eq("patient_id", patientId)
    .eq("currency", currency.toUpperCase())
    .maybeSingle();

  return {
    balance_cents: data?.balance_cents || 0,
    currency: currency.toUpperCase(),
  };
}

/**
 * Get all wallet balances for a patient (across all currencies).
 */
export async function getAllWalletBalances(
  patientId: string
): Promise<WalletBalance[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("patient_wallet")
    .select("balance_cents, currency")
    .eq("patient_id", patientId)
    .gt("balance_cents", 0);

  return (data || []).map((w) => ({
    balance_cents: w.balance_cents,
    currency: w.currency,
  }));
}

/**
 * Credit a patient's wallet (add funds) atomically via RPC.
 * Creates wallet row if it doesn't exist (upsert).
 * Returns the new balance.
 */
export async function creditWallet({
  patientId,
  currency,
  amountCents,
  sourceType,
  sourceBookingId,
  description,
  expiresAt,
}: CreditParams): Promise<{ balance_cents: number; transactionId: string }> {
  if (amountCents <= 0) throw new Error("Credit amount must be positive");

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("credit_wallet_atomic", {
    p_patient_id: patientId,
    p_currency: currency,
    p_amount_cents: amountCents,
    p_source_type: sourceType,
    p_source_booking_id: sourceBookingId || null,
    p_target_booking_id: null,
    p_description: description || null,
    p_expires_at: expiresAt || null,
  });

  if (error) {
    throw new Error(error.message || "Failed to credit wallet");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Failed to credit wallet");
  }

  return {
    balance_cents: row.balance_cents,
    transactionId: row.transaction_id,
  };
}

/**
 * Get the effective wallet balance, excluding expired promotional credits.
 * For most cases, use getWalletBalance() which returns the raw balance.
 * This function checks for expired credits and adjusts accordingly.
 */
export async function getEffectiveWalletBalance(
  patientId: string,
  currency: string
): Promise<{ balance_cents: number; expired_cents: number }> {
  const cur = currency.toUpperCase();
  const supabase = createAdminClient();

  // Get raw balance
  const { data: wallet } = await supabase
    .from("patient_wallet")
    .select("balance_cents")
    .eq("patient_id", patientId)
    .eq("currency", cur)
    .maybeSingle();

  if (!wallet || wallet.balance_cents === 0) {
    return { balance_cents: 0, expired_cents: 0 };
  }

  // Sum expired credits that haven't been deducted yet
  const { data: expiredCredits } = await supabase
    .from("wallet_transactions")
    .select("amount_cents")
    .eq("patient_id", patientId)
    .eq("currency", cur)
    .eq("type", "credit")
    .lt("expires_at", new Date().toISOString())
    .not("expires_at", "is", null);

  const expiredCents = (expiredCredits || []).reduce(
    (sum, t) => sum + t.amount_cents,
    0
  );

  // Effective balance = raw balance minus expired (but floor at 0)
  const effectiveBalance = Math.max(0, wallet.balance_cents - expiredCents);

  return { balance_cents: effectiveBalance, expired_cents: expiredCents };
}

/**
 * Debit a patient's wallet (deduct funds for a booking) atomically via RPC.
 * Throws if insufficient balance.
 * Returns the new balance.
 */
export async function debitWallet({
  patientId,
  currency,
  amountCents,
  sourceType,
  targetBookingId,
  description,
}: DebitParams): Promise<{ balance_cents: number; transactionId: string }> {
  if (amountCents <= 0) throw new Error("Debit amount must be positive");

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("debit_wallet_atomic", {
    p_patient_id: patientId,
    p_currency: currency,
    p_amount_cents: amountCents,
    p_source_type: sourceType,
    p_source_booking_id: null,
    p_target_booking_id: targetBookingId || null,
    p_description: description || null,
  });

  if (error) {
    if (error.message?.includes("Insufficient wallet balance")) {
      throw new Error(
        `Insufficient wallet balance. Required: ${amountCents}`
      );
    }
    throw new Error(error.message || "Failed to debit wallet");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Failed to debit wallet");
  }

  return {
    balance_cents: row.balance_cents,
    transactionId: row.transaction_id,
  };
}

/**
 * Get wallet transaction history for a patient.
 */
export async function getWalletTransactions(
  patientId: string,
  limit: number = 50
): Promise<WalletTransaction[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []) as WalletTransaction[];
}
