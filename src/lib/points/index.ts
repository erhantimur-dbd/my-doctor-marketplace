/**
 * Patient loyalty points service.
 * Manages earning and redeeming points for booking discounts.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { calculatePointsEarned } from "@/lib/constants/loyalty-points";

interface EarnPointsParams {
  patientId: string;
  bookingId: string;
  amountCents: number; // booking amount in cents
  description?: string;
}

interface RedeemPointsParams {
  patientId: string;
  points: number;
  bookingId?: string;
  description?: string;
}

interface PointsBalance {
  available_points: number;
  lifetime_points: number;
}

interface PointsTransaction {
  id: string;
  type: "earn" | "redeem";
  points: number;
  balance_after: number;
  source: string;
  booking_id: string | null;
  description: string | null;
  created_at: string;
}

/**
 * Get points balance for a patient.
 */
export async function getPointsBalance(patientId: string): Promise<PointsBalance> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("patient_points")
    .select("available_points, lifetime_points")
    .eq("patient_id", patientId)
    .single();

  return data || { available_points: 0, lifetime_points: 0 };
}

/**
 * Earn points from a completed booking.
 */
export async function earnPoints({ patientId, bookingId, amountCents, description }: EarnPointsParams): Promise<number> {
  const supabase = createAdminClient();

  // Get current balance to determine tier multiplier
  const balance = await getPointsBalance(patientId);
  const pointsEarned = calculatePointsEarned(amountCents, balance.lifetime_points);

  if (pointsEarned <= 0) return 0;

  const newAvailable = balance.available_points + pointsEarned;
  const newLifetime = balance.lifetime_points + pointsEarned;

  // Upsert points balance
  await supabase
    .from("patient_points")
    .upsert(
      {
        patient_id: patientId,
        available_points: newAvailable,
        lifetime_points: newLifetime,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patient_id" }
    );

  // Record transaction
  await supabase.from("points_transactions").insert({
    patient_id: patientId,
    type: "earn",
    points: pointsEarned,
    balance_after: newAvailable,
    source: "booking",
    booking_id: bookingId,
    description: description || `Earned ${pointsEarned} points`,
  });

  return pointsEarned;
}

/**
 * Earn bonus points (referrals, promotions, etc.)
 */
export async function earnBonusPoints(
  patientId: string,
  points: number,
  source: string,
  description: string
): Promise<void> {
  const supabase = createAdminClient();
  const balance = await getPointsBalance(patientId);

  const newAvailable = balance.available_points + points;
  const newLifetime = balance.lifetime_points + points;

  await supabase
    .from("patient_points")
    .upsert(
      {
        patient_id: patientId,
        available_points: newAvailable,
        lifetime_points: newLifetime,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patient_id" }
    );

  await supabase.from("points_transactions").insert({
    patient_id: patientId,
    type: "earn",
    points,
    balance_after: newAvailable,
    source,
    booking_id: null,
    description,
  });
}

/**
 * Redeem points for a discount.
 * Returns the number of points actually redeemed (may be less than requested if insufficient balance).
 */
export async function redeemPoints({ patientId, points, bookingId, description }: RedeemPointsParams): Promise<number> {
  const supabase = createAdminClient();
  const balance = await getPointsBalance(patientId);

  const redeemable = Math.min(points, balance.available_points);
  if (redeemable <= 0) return 0;

  const newAvailable = balance.available_points - redeemable;

  await supabase
    .from("patient_points")
    .update({
      available_points: newAvailable,
      updated_at: new Date().toISOString(),
    })
    .eq("patient_id", patientId);

  await supabase.from("points_transactions").insert({
    patient_id: patientId,
    type: "redeem",
    points: redeemable,
    balance_after: newAvailable,
    source: "redemption",
    booking_id: bookingId || null,
    description: description || `Redeemed ${redeemable} points`,
  });

  return redeemable;
}

/**
 * Get points transaction history.
 */
export async function getPointsTransactions(patientId: string, limit = 50): Promise<PointsTransaction[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("points_transactions")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as PointsTransaction[]) || [];
}
