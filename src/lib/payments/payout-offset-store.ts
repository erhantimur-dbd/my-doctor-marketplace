import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/logger";
import { destinationFeeWithOffset } from "@/lib/payments/payout-offset";

type OffsetRow = {
  id: string;
  offset_remaining_cents: number;
};

function missingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42883") {
    return true;
  }
  const message = error.message || "";
  return message.includes("payment_corrections") && message.includes("does not exist");
}

/**
 * Cents already reserved or applied for this booking. A retry must reuse them
 * so the Stripe idempotency key keeps the same transfer amount.
 */
export async function heldOffsetCentsForBooking(bookingId: string): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("payment_correction_offset_holds")
      .select("amount_cents, status")
      .eq("booking_id", bookingId)
      .in("status", ["reserved", "applied"]);
    if (error) {
      if (missingRelation(error)) return 0;
      throw new Error(error.message);
    }
    return (data || []).reduce(
      (sum, row) => sum + Number(row.amount_cents || 0),
      0
    );
  } catch (err) {
    log.error("[payment-correction] offset hold lookup failed", { err, bookingId });
    return 0;
  }
}

async function eligibleOffsetRows(doctorId: string): Promise<OffsetRow[]> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("payment_corrections")
    .select("id, offset_remaining_cents, clear_risk, earliest_recovery_at")
    .eq("doctor_id", doctorId)
    .eq("party", "doctor")
    .eq("direction", "platform_favour")
    .gte("recovery_step", 2)
    .gt("offset_remaining_cents", 0)
    .not("notice_sent_at", "is", null)
    .order("created_at", { ascending: true });
  if (error) {
    if (missingRelation(error)) return [];
    throw new Error(error.message);
  }
  return (data || []).filter((row) => {
    if (row.clear_risk) return true;
    return (
      typeof row.earliest_recovery_at === "string" &&
      row.earliest_recovery_at <= now
    );
  }) as OffsetRow[];
}

/** Reserve up to maxCents from ready doctor offsets. Returns cents reserved. */
export async function reserveDoctorOffsetCents(input: {
  doctorId: string;
  bookingId: string;
  maxCents: number;
}): Promise<number> {
  const max = Math.max(0, Math.round(input.maxCents));
  if (max === 0) return 0;
  try {
    const already = await heldOffsetCentsForBooking(input.bookingId);
    if (already > 0) return Math.min(already, max);

    const rows = await eligibleOffsetRows(input.doctorId);
    const supabase = createAdminClient();
    let reserved = 0;
    for (const row of rows) {
      const room = max - reserved;
      if (room <= 0) break;
      const take = Math.min(room, row.offset_remaining_cents);
      const { data, error } = await supabase.rpc("reserve_correction_offset", {
        p_correction_id: row.id,
        p_booking_id: input.bookingId,
        p_amount: take,
      });
      if (error) {
        if (missingRelation(error)) return reserved;
        log.error("[payment-correction] reserve offset failed", {
          err: error,
          correctionId: row.id,
        });
        continue;
      }
      reserved += Number(data || 0);
    }
    return reserved;
  } catch (err) {
    log.error("[payment-correction] offset reserve failed; checkout continues", {
      err,
      bookingId: input.bookingId,
    });
    return 0;
  }
}

export async function applicationFeeIncludingOffset(input: {
  doctorId: string;
  bookingId: string;
  chargeCents: number;
  applicationFeeCents: number;
}): Promise<number> {
  const room = Math.max(0, input.chargeCents - input.applicationFeeCents);
  const offsetCents = await reserveDoctorOffsetCents({
    doctorId: input.doctorId,
    bookingId: input.bookingId,
    maxCents: room,
  });
  return destinationFeeWithOffset({
    applicationFeeCents: input.applicationFeeCents,
    chargeCents: input.chargeCents,
    offsetCents,
  }).applicationFeeCents;
}

export async function consumeWalletTransferOffset(input: {
  doctorId: string;
  bookingId: string;
  maxCents: number;
}): Promise<number> {
  return reserveDoctorOffsetCents(input);
}

export async function releaseOffsetHoldsForBookings(
  bookingIds: string[]
): Promise<void> {
  if (bookingIds.length === 0) return;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("release_reserved_offset_holds", {
      p_booking_ids: bookingIds,
    });
    if (error && !missingRelation(error)) {
      log.error("[payment-correction] release offset holds failed", { err: error });
    }
  } catch (err) {
    log.error("[payment-correction] release offset holds failed", { err });
  }
}

export async function applyOffsetHoldsForBooking(bookingId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("apply_reserved_offset_holds", {
      p_booking_id: bookingId,
    });
    if (error && !missingRelation(error)) {
      log.error("[payment-correction] apply offset holds failed", { err: error, bookingId });
    }
  } catch (err) {
    log.error("[payment-correction] apply offset holds failed", { err, bookingId });
  }
}
