import { formatAppointmentWindow } from "@/lib/utils/appointment-window";

/**
 * Admin booking time. `start_time` / `end_time` are timestamptz, so slicing
 * the first five characters yields the year ("2026-"). Use the same
 * Europe/London window as checkout and patient notifications.
 */
export function formatAdminBookingTime(
  start: string | null | undefined,
  end?: string | null,
  appointmentDate?: string | null
): string {
  const startRaw = (start ?? "").trim();
  if (!startRaw) return "Time to be confirmed";
  return formatAppointmentWindow(startRaw, end, { appointmentDate });
}

/**
 * Consult checkout writes the 15% fee to `bookings.commission_cents` and
 * leaves `platform_fee_cents` at 0. Older rows may only have
 * `platform_fee_cents`. `platform_fees.amount_cents` is the ledger written
 * after payment, used when both booking columns are empty.
 */
export function resolveAdminPlatformFeeCents(input: {
  commissionCents?: number | null;
  platformFeeCents?: number | null;
  recordedFeeCents?: number | null;
}): number {
  const commission = Math.max(0, Math.round(Number(input.commissionCents || 0)));
  if (commission > 0) return commission;
  const platform = Math.max(0, Math.round(Number(input.platformFeeCents || 0)));
  if (platform > 0) return platform;
  return Math.max(0, Math.round(Number(input.recordedFeeCents || 0)));
}

export function adminDoctorPayoutCents(
  totalAmountCents: number | null | undefined,
  platformFeeCents: number
): number {
  const total = Math.max(0, Math.round(Number(totalAmountCents || 0)));
  const fee = Math.max(0, Math.round(platformFeeCents));
  return Math.max(0, total - fee);
}

export function sumRecordedPlatformFees(
  rows: readonly { amount_cents?: number | null }[] | null | undefined
): number {
  return (rows ?? []).reduce(
    (sum, row) => sum + Math.max(0, Math.round(Number(row.amount_cents || 0))),
    0
  );
}
