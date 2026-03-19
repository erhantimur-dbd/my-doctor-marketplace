/**
 * Patient wallet service — manages credit balances for instant refunds.
 *
 * Uses admin client (service role) for all operations to bypass RLS,
 * ensuring atomic balance updates. All mutations are recorded in the
 * immutable wallet_transactions ledger.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type WalletSourceType =
  | "refund"
  | "cancel_rebook"
  | "referral"
  | "promotion"
  | "admin_manual";

interface CreditParams {
  patientId: string;
  currency: string;
  amountCents: number;
  sourceType: WalletSourceType;
  sourceBookingId?: string;
  description?: string;
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
 * Credit a patient's wallet (add funds).
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
}: CreditParams): Promise<{ balance_cents: number; transactionId: string }> {
  if (amountCents <= 0) throw new Error("Credit amount must be positive");

  const cur = currency.toUpperCase();
  const supabase = createAdminClient();

  // Upsert wallet balance
  const { data: existing } = await supabase
    .from("patient_wallet")
    .select("id, balance_cents")
    .eq("patient_id", patientId)
    .eq("currency", cur)
    .maybeSingle();

  let newBalance: number;

  if (existing) {
    newBalance = existing.balance_cents + amountCents;
    await supabase
      .from("patient_wallet")
      .update({
        balance_cents: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    newBalance = amountCents;
    await supabase.from("patient_wallet").insert({
      patient_id: patientId,
      currency: cur,
      balance_cents: newBalance,
    });
  }

  // Record transaction
  const { data: txn } = await supabase
    .from("wallet_transactions")
    .insert({
      patient_id: patientId,
      type: "credit",
      amount_cents: amountCents,
      currency: cur,
      balance_after_cents: newBalance,
      source_type: sourceType,
      source_booking_id: sourceBookingId || null,
      description: description || null,
    })
    .select("id")
    .single();

  return { balance_cents: newBalance, transactionId: txn!.id };
}

/**
 * Debit a patient's wallet (deduct funds for a booking).
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

  const cur = currency.toUpperCase();
  const supabase = createAdminClient();

  const { data: wallet } = await supabase
    .from("patient_wallet")
    .select("id, balance_cents")
    .eq("patient_id", patientId)
    .eq("currency", cur)
    .maybeSingle();

  if (!wallet || wallet.balance_cents < amountCents) {
    throw new Error(
      `Insufficient wallet balance. Available: ${wallet?.balance_cents || 0}, required: ${amountCents}`
    );
  }

  const newBalance = wallet.balance_cents - amountCents;

  await supabase
    .from("patient_wallet")
    .update({
      balance_cents: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id);

  // Record transaction
  const { data: txn } = await supabase
    .from("wallet_transactions")
    .insert({
      patient_id: patientId,
      type: "debit",
      amount_cents: amountCents,
      currency: cur,
      balance_after_cents: newBalance,
      source_type: sourceType,
      target_booking_id: targetBookingId || null,
      description: description || null,
    })
    .select("id")
    .single();

  return { balance_cents: newBalance, transactionId: txn!.id };
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
