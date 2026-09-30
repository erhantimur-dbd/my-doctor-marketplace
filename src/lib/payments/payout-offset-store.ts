import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/logger";
import { destinationFeeWithOffset } from "@/lib/payments/payout-offset";
import {
  isCorrectionOffsetEligible,
  offsetRecoveryGateOpen,
  type ApprovalRecord,
} from "@/lib/payments/correction-guards";

export type OffsetRow = {
  id: string;
  offsetRemainingCents: number;
  recoveryStep: number;
  noticeSentAt: string | null;
  earliestRecoveryAt: string | null;
  clearRisk: boolean;
  disputeOpen: boolean;
  requiredApprovals: number;
  createdBy: string | null;
  approvals: ApprovalRecord[];
  escalatedByDoctorAt: string | null;
  reversalShortOrFailed: boolean;
};

export type OffsetHoldSnapshot = {
  correctionId: string;
  amountCents: number;
  status: "reserved" | "applied" | "released";
};

export function planOffsetReserve(input: {
  rows: OffsetRow[];
  holds: OffsetHoldSnapshot[];
  maxCents: number;
  nowIso: string;
}): {
  cents: number;
  /** Corrections whose reserved holds must be released (dispute or approvals). */
  releaseCorrectionIds: string[];
  reservations: { correctionId: string; amount: number }[];
} {
  const eligible = input.rows.filter((row) =>
    isCorrectionOffsetEligible({
      recoveryStep: row.recoveryStep,
      noticeSentAt: row.noticeSentAt,
      earliestRecoveryAt: row.earliestRecoveryAt,
      clearRisk: row.clearRisk,
      disputeOpen: row.disputeOpen,
      requiredApprovals: row.requiredApprovals,
      createdBy: row.createdBy,
      approvals: row.approvals,
      escalatedByDoctorAt: row.escalatedByDoctorAt,
      reversalShortOrFailed: row.reversalShortOrFailed,
      nowIso: input.nowIso,
    })
  );
  const blockedIds = new Set(
    input.rows
      .filter((row) => !offsetRecoveryGateOpen(row))
      .map((row) => row.id)
  );
  const releaseCorrectionIds = [
    ...new Set(
      input.holds
        .filter(
          (hold) => hold.status === "reserved" && blockedIds.has(hold.correctionId)
        )
        .map((hold) => hold.correctionId)
    ),
  ];
  const held = input.holds
    .filter(
      (hold) =>
        (hold.status === "reserved" || hold.status === "applied") &&
        !blockedIds.has(hold.correctionId)
    )
    .reduce((sum, hold) => sum + hold.amountCents, 0);
  if (held > 0) {
    return {
      cents: Math.min(held, input.maxCents),
      releaseCorrectionIds,
      reservations: [],
    };
  }
  let left = input.maxCents;
  const reservations: { correctionId: string; amount: number }[] = [];
  for (const row of eligible) {
    if (left <= 0) break;
    const take = Math.min(left, row.offsetRemainingCents);
    if (take <= 0) continue;
    reservations.push({ correctionId: row.id, amount: take });
    left -= take;
  }
  return {
    cents: input.maxCents - left,
    releaseCorrectionIds,
    reservations,
  };
}

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

type OffsetStoreDeps = {
  loadRows?: (doctorId: string) => Promise<OffsetRow[]>;
  loadHolds?: (bookingId: string) => Promise<OffsetHoldSnapshot[]>;
  reserve?: (input: {
    correctionId: string;
    bookingId: string;
    amount: number;
  }) => Promise<number>;
  release?: (bookingIds: string[]) => Promise<void>;
  nowIso?: string;
};

async function loadOffsetRows(doctorId: string): Promise<OffsetRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_corrections")
    .select(
      `id, offset_remaining_cents, clear_risk, earliest_recovery_at, notice_sent_at,
       required_approvals, created_by, escalated_by_doctor_at, disputed_at, dispute_resolved_at,
       recovery_step,
       approvals:payment_correction_approvals(approver_id)`
    )
    .eq("doctor_id", doctorId)
    .eq("party", "doctor")
    .eq("direction", "platform_favour")
    .gte("recovery_step", 2)
    .not("notice_sent_at", "is", null)
    .order("created_at", { ascending: true });
  if (error) {
    if (missingRelation(error)) return [];
    throw new Error(error.message);
  }
  const corrections = data || [];
  const ids = corrections.map((row) => row.id as string);
  const { data: approvers, error: approverError } = await supabase
    .from("payment_correction_approvers")
    .select("profile_id, director");
  if (approverError && !missingRelation(approverError)) {
    throw new Error(approverError.message);
  }
  const allowlist = new Map(
    (approvers || []).map((row) => [
      row.profile_id as string,
      Boolean(row.director),
    ])
  );
  let reversalIds = new Set<string>();
  if (ids.length > 0) {
    const { data: events, error: eventError } = await supabase
      .from("payment_correction_events")
      .select("correction_id, payload")
      .eq("event_type", "reversal_attempted")
      .in("correction_id", ids);
    if (eventError && !missingRelation(eventError)) {
      throw new Error(eventError.message);
    }
    reversalIds = new Set(
      (events || [])
        .filter((event) => {
          const outcome = (event.payload as { outcome?: string } | null)?.outcome;
          return outcome === "short" || outcome === "failed";
        })
        .map((event) => event.correction_id as string)
    );
  }
  return corrections.map((row) => {
    const approvalIds = (
      (row.approvals as { approver_id?: string }[] | null) || []
    )
      .map((approval) => approval.approver_id)
      .filter((id): id is string => Boolean(id));
    return {
      id: row.id as string,
      offsetRemainingCents: Number(row.offset_remaining_cents || 0),
      recoveryStep: Number(row.recovery_step || 0),
      noticeSentAt: (row.notice_sent_at as string | null) ?? null,
      earliestRecoveryAt: (row.earliest_recovery_at as string | null) ?? null,
      clearRisk: Boolean(row.clear_risk),
      disputeOpen: Boolean(row.disputed_at) && !row.dispute_resolved_at,
      requiredApprovals: Number(row.required_approvals || 1),
      createdBy: (row.created_by as string | null) ?? null,
      escalatedByDoctorAt: (row.escalated_by_doctor_at as string | null) ?? null,
      reversalShortOrFailed: reversalIds.has(row.id as string),
      approvals: approvalIds.map((approverId) => ({
        approverId,
        inAllowlist: allowlist.has(approverId),
        director: allowlist.get(approverId) === true,
      })),
    };
  });
}

async function loadOffsetHolds(bookingId: string): Promise<OffsetHoldSnapshot[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_correction_offset_holds")
    .select("correction_id, amount_cents, status")
    .eq("booking_id", bookingId)
    .in("status", ["reserved", "applied"]);
  if (error) {
    if (missingRelation(error)) return [];
    throw new Error(error.message);
  }
  return (data || []).map((row) => ({
    correctionId: row.correction_id as string,
    amountCents: Number(row.amount_cents || 0),
    status: row.status as OffsetHoldSnapshot["status"],
  }));
}

/** Reserve up to maxCents from ready doctor offsets. Returns cents reserved. */
export async function reserveDoctorOffsetCents(
  input: {
    doctorId: string;
    bookingId: string;
    maxCents: number;
  },
  deps?: OffsetStoreDeps
): Promise<number> {
  const max = Math.max(0, Math.round(input.maxCents));
  if (max === 0) return 0;
  try {
    const rows = await (deps?.loadRows ?? loadOffsetRows)(input.doctorId);
    const holds = await (deps?.loadHolds ?? loadOffsetHolds)(input.bookingId);
    const plan = planOffsetReserve({
      rows,
      holds,
      maxCents: max,
      nowIso: deps?.nowIso ?? new Date().toISOString(),
    });
    if (plan.releaseCorrectionIds.length > 0) {
      if (deps?.release) {
        await deps.release([input.bookingId]);
      } else {
        // reserve_correction_offset releases every reserved hold on a
        // correction that fails the dispute or approval gate, then returns 0.
        for (const correctionId of plan.releaseCorrectionIds) {
          try {
            await (
              deps?.reserve ??
              (async (reservation: {
                correctionId: string;
                bookingId: string;
                amount: number;
              }) => {
                const supabase = createAdminClient();
                const { error } = await supabase.rpc("reserve_correction_offset", {
                  p_correction_id: reservation.correctionId,
                  p_booking_id: reservation.bookingId,
                  p_amount: reservation.amount,
                });
                if (error && !missingRelation(error)) throw error;
                return 0;
              })
            )({
              correctionId,
              bookingId: input.bookingId,
              amount: 1,
            });
          } catch (err) {
            log.error("[payment-correction] release disputed offset failed", {
              err,
              correctionId,
            });
          }
        }
      }
    }
    if (plan.reservations.length === 0) return plan.cents;

    const reserve =
      deps?.reserve ??
      (async (reservation: {
        correctionId: string;
        bookingId: string;
        amount: number;
      }) => {
        const supabase = createAdminClient();
        const { data, error } = await supabase.rpc("reserve_correction_offset", {
          p_correction_id: reservation.correctionId,
          p_booking_id: reservation.bookingId,
          p_amount: reservation.amount,
        });
        if (error) {
          if (missingRelation(error)) return 0;
          throw error;
        }
        return Number(data || 0);
      });

    let reserved = 0;
    for (const reservation of plan.reservations) {
      try {
        reserved += await reserve({
          correctionId: reservation.correctionId,
          bookingId: input.bookingId,
          amount: reservation.amount,
        });
      } catch (err) {
        log.error("[payment-correction] reserve offset failed", {
          err,
          correctionId: reservation.correctionId,
        });
      }
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

/**
 * Put the refunded share of applied offset holds back on the correction.
 * Idempotent per refund id inside restore_offset_for_refund.
 * Missing Supabase env or a missing table returns 0 so a refund write still lands.
 */
export async function restoreAppliedOffsetForRefund(input: {
  bookingId: string;
  refundId: string;
  refundCents: number;
  originalPaidCents: number;
}): Promise<number> {
  const refundId = input.refundId.trim();
  if (!refundId || input.refundCents <= 0 || input.originalPaidCents <= 0) return 0;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return 0;
  }
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("restore_offset_for_refund", {
      p_booking_id: input.bookingId,
      p_refund_id: refundId,
      p_refund_cents: input.refundCents,
      p_original_paid_cents: input.originalPaidCents,
    });
    if (error) {
      if (missingRelation(error)) return 0;
      log.error("[payment-correction] restore offset for refund failed", {
        err: error,
        bookingId: input.bookingId,
        refundId,
      });
      return 0;
    }
    return Number(data || 0);
  } catch (err) {
    log.error("[payment-correction] restore offset for refund failed", {
      err,
      bookingId: input.bookingId,
      refundId,
    });
    return 0;
  }
}
