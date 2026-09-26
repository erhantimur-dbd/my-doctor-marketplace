/**
 * MyDoctors360 activity statement — pure month aggregation.
 *
 * This is a record of consult fees that settled on a doctor's Stripe
 * Connected Account, kept for their records.
 *
 * Fee model (verified against checkout, not assumed):
 *
 * - `consultation_fee_cents` is the consult price stored on the booking.
 * - `total_amount_cents` is usually that same price. Follow-up and treatment
 *   plan checkouts charge `total_amount_cents` (sometimes a packaged or
 *   discounted total) and set `platform_fee_cents` to 0.
 * - `commission_cents` is the 15% platform commission
 *   (`getCommissionCents`), taken from the doctor's share as Stripe
 *   `application_fee_amount` on a destination charge. The comment on the
 *   column says the same thing.
 * - `platform_fee_cents` is legacy. Current booking inserts write 0.
 *   The Stripe webhook records `platform_fee_cents + commission_cents` as
 *   the platform fee, so a non-zero legacy value is still the platform's
 *   share and is included.
 * - `getBookingFeeCents` (£4.95) is not applied at checkout and is not
 *   stored on bookings. It is not part of this statement.
 * - Deposit bookings charge `deposit_amount_cents` through Stripe. The
 *   application fee is `min(commission, amount charged)`. The remainder
 *   is collected in person and does not land on the Connected Account.
 * - `wallet_credit_applied_cents` reduces the Checkout amount. That
 *   portion is not a Connect transfer. The application fee is capped at
 *   the remaining card charge, matching `createBookingAndCheckout`.
 * - No `stripe_payment_intent_id` (Softsmoke Connect skip, or wallet
 *   covering the whole charge) means nothing was transferred. Stored
 *   commission is not treated as money the platform took.
 * - A dearer clinic reschedule (clinic-booking.ts Case 2) inserts a new
 *   row with `rescheduled_from_booking_id` set and
 *   `reschedule_payment_status = paid`. Its PaymentIntent is only the
 *   balance and has no `transfer_data`. That row is not a Connected
 *   Account booking: gross, platform fee, and net are 0, it is not
 *   included in the booking count, and it is labelled "Reschedule
 *   balance paid to MyDoctors360". The original row keeps its
 *   destination charge. When both rows are in the statement, the
 *   original is labelled "Rescheduled to <new ref>".
 * - Follow-up and per-visit treatment checkouts do charge 15% via
 *   `application_fee_amount` but leave `commission_cents` at the default
 *   0. When a PaymentIntent exists and both stored fee columns are 0,
 *   the statement uses that same 15% of the amount charged.
 *
 * Known limits:
 *
 * - A same-or-cheaper clinic reschedule (clinic-booking.ts Case 1) issues
 *   a partial Stripe refund but does not write `refund_amount_cents` or
 *   `refunded_at`. It also lowers `total_amount_cents` and moves the row
 *   to the new doctor, so a doctor-scoped statement can misattribute
 *   that money.
 * - When a destination PaymentIntent exists and both `platform_fee_cents`
 *   and `commission_cents` are 0, the platform fee is inferred as 15% of
 *   the amount charged. Checkout is unchanged in this slice, so the
 *   stored columns stay 0 for those payments.
 * - Refunds that reverse a destination charge use Stripe's proportional
 *   `refund_application_fee` + `reverse_transfer`: the platform fee is
 *   returned in proportion to the refund, and the rest of the refund
 *   reverses the Connected Account transfer.
 * - Patient cancellation often does not write `refund_amount_cents` or
 *   `refunded_at`. Only persisted refund columns can appear here.
 * - GP reassignment moves the booking row to the new doctor. The
 *   statement follows the current `doctor_id` / `organization_id`.
 */

import { formatEmailDateTime } from "@/lib/email/format-appointment";
import { getCommissionCents } from "@/lib/utils/currency";

export const ACTIVITY_STATEMENT_TITLE = "MyDoctors360 activity statement";

export const ACTIVITY_STATEMENT_FOOTER =
  "Consultation fees are paid directly to your Stripe Connected Account. MyDoctors360 charges a platform fee for bookings made through the marketplace. This activity statement is for your records only.";

export const ACTIVITY_STATEMENT_FIGURES_NOTE =
  "Gross consult is the consultation fee on the booking, or the packaged total when that is what was charged. Connected Account is the amount Stripe transferred after the platform fee. A negative Connected Account amount is a refund reversing that transfer. A deposit remainder paid in person, and any wallet credit, are not transfers to the Connected Account.";

export const STATEMENT_TIME_ZONE = "Europe/London";

export const ACTIVITY_STATEMENT_HREF = "/doctor-dashboard/activity-statement";

export type ActivityStatementScope = "doctor" | "organization";

/** Booking columns read for the statement. No clinical content. */
export const ACTIVITY_STATEMENT_BOOKING_COLUMNS = [
  "id",
  "booking_number",
  "appointment_date",
  "start_time",
  "consultation_type",
  "service_name",
  "status",
  "currency",
  "consultation_fee_cents",
  "platform_fee_cents",
  "commission_cents",
  "total_amount_cents",
  "deposit_amount_cents",
  "payment_mode",
  "wallet_credit_applied_cents",
  "refund_amount_cents",
  "paid_at",
  "refunded_at",
  "doctor_id",
  "stripe_payment_intent_id",
  "reschedule_price_diff_cents",
  "reschedule_payment_status",
  "rescheduled_from_booking_id",
] as const;

const FORBIDDEN_STATEMENT_FIELDS = [
  "patient_notes",
  "doctor_notes",
  "visit_summary",
  "medical_profile",
  "prescription",
  "symptom",
] as const;

export function activityStatementSelect(includeClinician: boolean): string {
  const patient =
    "patient:profiles!bookings_patient_id_fkey(first_name, last_name)";
  const clinician = includeClinician
    ? ", doctor:doctors!bookings_doctor_id_fkey(profile:profiles!doctors_profile_id_fkey(first_name, last_name))"
    : "";
  return `${ACTIVITY_STATEMENT_BOOKING_COLUMNS.join(", ")}, ${patient}${clinician}`;
}

export function assertActivityStatementSelectIsSafe(select: string): void {
  const lowered = select.toLowerCase();
  for (const field of FORBIDDEN_STATEMENT_FIELDS) {
    if (lowered.includes(field)) {
      throw new Error(`Activity statement select includes ${field}`);
    }
  }
}

export type StatementSettlement =
  | "destination_charge"
  | "no_destination_charge"
  | "reschedule_platform_charge";

export const RESCHEDULE_BALANCE_LABEL = "Reschedule balance paid to MyDoctors360";

export function rescheduledToLabel(newBookingNumber: string): string {
  return `Rescheduled to ${newBookingNumber}`;
}

/** Dearer-slot clinic reschedule row. The balance was paid to MyDoctors360. */
export function isPaidRescheduleSuccessor(booking: StatementBookingSource): boolean {
  return (
    Boolean((booking.rescheduledFromBookingId ?? "").trim()) &&
    booking.reschedulePaymentStatus === "paid"
  );
}

export interface StatementBookingSource {
  id?: string | null;
  doctorId?: string | null;
  bookingNumber: string;
  appointmentDate?: string | null;
  startTime?: string | null;
  consultationType?: string | null;
  serviceName?: string | null;
  status?: string | null;
  currency?: string | null;
  consultationFeeCents?: number | null;
  platformFeeCents?: number | null;
  commissionCents?: number | null;
  totalAmountCents?: number | null;
  depositAmountCents?: number | null;
  paymentMode?: string | null;
  walletCreditAppliedCents?: number | null;
  refundAmountCents?: number | null;
  paidAt?: string | null;
  refundedAt?: string | null;
  stripePaymentIntentId?: string | null;
  reschedulePriceDiffCents?: number | null;
  reschedulePaymentStatus?: string | null;
  rescheduledFromBookingId?: string | null;
  patientFirstName?: string | null;
  patientLastName?: string | null;
  clinicianName?: string | null;
}

export interface FeeSettlement {
  grossConsultCents: number;
  stripeChargeCents: number;
  platformFeeCents: number;
  connectedAccountCents: number;
  settlement: StatementSettlement;
}

export interface ActivityStatementLine {
  kind: "booking" | "refund";
  occurredAt: string;
  dateLabel: string;
  bookingNumber: string;
  patientLabel: string;
  serviceLabel: string;
  appointmentLabel: string;
  statusLabel: string;
  settlementLabel: string | null;
  currency: string;
  grossConsultCents: number;
  connectedAccountCents: number;
  platformFeeCents: number;
  refundAmountCents: number;
  /** Paid reschedule-balance rows stay on the statement and out of the totals. */
  excludeFromTotals: boolean;
}

export interface ActivityStatementTotals {
  currency: string;
  bookingsCount: number;
  grossConsultCents: number;
  refundsCents: number;
  platformFeeCents: number;
  netConnectedAccountCents: number;
}

export interface ActivityStatement {
  title: typeof ACTIVITY_STATEMENT_TITLE;
  periodLabel: string;
  monthKey: string;
  payeeName: string;
  scopeLabel: string;
  generatedLabel: string;
  lines: ActivityStatementLine[];
  totals: ActivityStatementTotals[];
  truncated: boolean;
  footer: typeof ACTIVITY_STATEMENT_FOOTER;
  figuresNote: typeof ACTIVITY_STATEMENT_FIGURES_NOTE;
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
  cancelled_patient: "Cancelled by patient",
  cancelled_doctor: "Cancelled by doctor",
  no_show: "No show",
  refunded: "Refunded",
  expired: "Expired",
  pending_reschedule_payment: "Pending reschedule payment",
};

function nonNeg(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function timeZoneOffsetMs(utcDate: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcDate);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - utcDate.getTime();
}

/** UTC instant of a civil date-time in `timeZone`. */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string = STATEMENT_TIME_ZONE
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = timeZoneOffsetMs(guess, timeZone);
  const utc = new Date(guess.getTime() - offset);
  const offsetAtUtc = timeZoneOffsetMs(utc, timeZone);
  if (offsetAtUtc !== offset) {
    return new Date(guess.getTime() - offsetAtUtc);
  }
  return utc;
}

export function londonYearMonth(now: Date = new Date()): {
  year: number;
  month: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STATEMENT_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return { year: Number(map.year), month: Number(map.month) };
}

/** Inclusive start, exclusive end, Europe/London calendar month. */
export function londonMonthBounds(
  year: number,
  month: number
): { start: Date; end: Date } {
  const start = zonedDateTimeToUtc(year, month, 1, 0, 0, 0);
  const end =
    month === 12
      ? zonedDateTimeToUtc(year + 1, 1, 1, 0, 0, 0)
      : zonedDateTimeToUtc(year, month + 1, 1, 0, 0, 0);
  return { start, end };
}

export function parseStatementMonth(
  param: string | undefined | null,
  now: Date = new Date()
): { year: number; month: number; key: string } {
  const match = /^(\d{4})-(\d{2})$/.exec((param ?? "").trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 2020 && year <= 2100 && month >= 1 && month <= 12) {
      return { year, month, key: `${match[1]}-${match[2]}` };
    }
  }
  const current = londonYearMonth(now);
  const key = `${current.year}-${String(current.month).padStart(2, "0")}`;
  return { year: current.year, month: current.month, key };
}

export function formatStatementMonth(year: number, month: number): string {
  const mid = zonedDateTimeToUtc(year, month, 15, 12, 0, 0);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: STATEMENT_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(mid);
}

export function inLondonRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return false;
  return time >= start.getTime() && time < end.getTime();
}

export function formatStatementMoney(cents: number, currency: string): string {
  const rounded = Number.isFinite(cents) ? Math.round(cents) : 0;
  const cur = (currency || "GBP").toUpperCase();
  const sign = rounded < 0 ? "\u2212" : "";
  if (cur === "GBP") {
    const abs = Math.abs(rounded);
    const pounds = Math.floor(abs / 100).toLocaleString("en-GB");
    const pence = String(abs % 100).padStart(2, "0");
    return `${sign}£${pounds}.${pence}`;
  }
  const abs = Math.abs(rounded);
  const major = Math.floor(abs / 100).toLocaleString("en-GB");
  const minor = String(abs % 100).padStart(2, "0");
  return `${sign}${cur} ${major}.${minor}`;
}

export function statementPatientLabel(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  bookingNumber: string
): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`;
  if (first) return first;
  if (last) return `${last.charAt(0).toUpperCase()}.`;
  return bookingNumber;
}

export function statementServiceLabel(
  serviceName: string | null | undefined,
  consultationType: string | null | undefined
): string {
  const name = (serviceName ?? "").trim();
  if (name) return name;
  switch ((consultationType ?? "").trim()) {
    case "video":
      return "Video consultation";
    case "in_person":
      return "In-person consultation";
    case "phone":
      return "Phone consultation";
    default: {
      const raw = (consultationType ?? "").trim();
      return raw || "Consultation";
    }
  }
}

export function statementStatusLabel(status: string | null | undefined): string {
  const raw = (status ?? "").trim();
  if (!raw) return "Unknown";
  return STATUS_LABELS[raw] ?? raw.replaceAll("_", " ");
}

export function grossConsultCents(booking: StatementBookingSource): number {
  const consult = nonNeg(booking.consultationFeeCents);
  if (booking.paymentMode === "deposit") return consult;
  const total = nonNeg(booking.totalAmountCents);
  return total > 0 ? total : consult;
}

export function settleBookingFees(booking: StatementBookingSource): FeeSettlement {
  const gross = grossConsultCents(booking);
  const hasPaymentIntent = Boolean((booking.stripePaymentIntentId ?? "").trim());

  if (isPaidRescheduleSuccessor(booking)) {
    return {
      grossConsultCents: 0,
      stripeChargeCents: 0,
      platformFeeCents: 0,
      connectedAccountCents: 0,
      settlement: "reschedule_platform_charge",
    };
  }

  if (!hasPaymentIntent) {
    return {
      grossConsultCents: gross,
      stripeChargeCents: 0,
      platformFeeCents: 0,
      connectedAccountCents: 0,
      settlement: "no_destination_charge",
    };
  }

  const chargedBasis =
    booking.paymentMode === "deposit" && booking.depositAmountCents != null
      ? nonNeg(booking.depositAmountCents)
      : nonNeg(booking.totalAmountCents);

  const wallet = Math.min(nonNeg(booking.walletCreditAppliedCents), chargedBasis);
  const stripeChargeCents = chargedBasis - wallet;
  const storedPlatform =
    nonNeg(booking.platformFeeCents) + nonNeg(booking.commissionCents);
  const intendedFee =
    storedPlatform > 0 ? storedPlatform : getCommissionCents(chargedBasis);
  const platformFeeCents = Math.min(intendedFee, stripeChargeCents);

  return {
    grossConsultCents: gross,
    stripeChargeCents,
    platformFeeCents,
    connectedAccountCents: Math.max(0, stripeChargeCents - platformFeeCents),
    settlement: "destination_charge",
  };
}

export function allocateRefund(
  settlement: FeeSettlement,
  refundAmountCents: number | null | undefined
): {
  refundCents: number;
  platformFeeReturnedCents: number;
  transferReversedCents: number;
} {
  const recorded = nonNeg(refundAmountCents);
  if (recorded <= 0 || settlement.stripeChargeCents <= 0) {
    return {
      refundCents: recorded,
      platformFeeReturnedCents: 0,
      transferReversedCents: 0,
    };
  }
  const applied = Math.min(recorded, settlement.stripeChargeCents);
  const platformFeeReturnedCents = Math.min(
    settlement.platformFeeCents,
    Math.round((settlement.platformFeeCents * applied) / settlement.stripeChargeCents)
  );
  const transferReversedCents = Math.min(
    settlement.connectedAccountCents,
    applied - platformFeeReturnedCents
  );
  return {
    refundCents: recorded,
    platformFeeReturnedCents,
    transferReversedCents,
  };
}

function settlementLabel(settlement: StatementSettlement): string | null {
  if (settlement === "no_destination_charge") return "No Stripe transfer";
  return null;
}

function appointmentLabel(booking: StatementBookingSource): string {
  const when = formatEmailDateTime(booking.appointmentDate, STATEMENT_TIME_ZONE);
  const timeRaw = (booking.startTime ?? "").trim();
  if (!timeRaw || !booking.appointmentDate) return when;
  const clock = formatEmailDateTime(
    timeRaw.includes("T") ? timeRaw : undefined,
    STATEMENT_TIME_ZONE
  );
  if (timeRaw.includes("T")) return clock;
  const wall = timeRaw.match(/^(\d{1,2}):(\d{2})/);
  if (!wall) return when;
  const hours = Number(wall[1]) % 24;
  const minutes = Number(wall[2]);
  const suffix = hours >= 12 ? "pm" : "am";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${when}, ${h12}:${String(minutes).padStart(2, "0")}${suffix}`;
}

function emptyTotals(currency: string): ActivityStatementTotals {
  return {
    currency,
    bookingsCount: 0,
    grossConsultCents: 0,
    refundsCents: 0,
    platformFeeCents: 0,
    netConnectedAccountCents: 0,
  };
}

/** Totals use `excludeFromTotals` only. Display labels are not consulted. */
export function accumulateActivityStatementTotals(
  lines: ActivityStatementLine[],
  fallbackCurrency = "GBP"
): ActivityStatementTotals[] {
  const totalsByCurrency = new Map<string, ActivityStatementTotals>();
  for (const line of lines) {
    if (line.excludeFromTotals) continue;
    const totals = totalsByCurrency.get(line.currency) ?? emptyTotals(line.currency);
    if (line.kind === "booking") {
      totals.bookingsCount += 1;
      totals.grossConsultCents += line.grossConsultCents;
    }
    totals.refundsCents += line.refundAmountCents;
    totals.platformFeeCents += line.platformFeeCents;
    totals.netConnectedAccountCents += line.connectedAccountCents;
    totalsByCurrency.set(line.currency, totals);
  }
  if (totalsByCurrency.size === 0) {
    const currency = fallbackCurrency.toUpperCase() || "GBP";
    totalsByCurrency.set(currency, emptyTotals(currency));
  }
  return [...totalsByCurrency.values()];
}

export function buildActivityStatement(input: {
  year: number;
  month: number;
  bookings: StatementBookingSource[];
  payeeName: string;
  scopeLabel: string;
  now?: Date;
  truncated?: boolean;
  fallbackCurrency?: string;
  showClinician?: boolean;
  /** When set, patient names are shown only on this doctor's own rows. */
  viewerDoctorId?: string | null;
}): ActivityStatement {
  const { start, end } = londonMonthBounds(input.year, input.month);
  const lines: ActivityStatementLine[] = [];
  const viewerDoctorId = (input.viewerDoctorId ?? "").trim();
  const successorRefByOriginalId = new Map<string, string>();
  for (const booking of input.bookings) {
    if (!isPaidRescheduleSuccessor(booking)) continue;
    const originalId = (booking.rescheduledFromBookingId ?? "").trim();
    const ref = (booking.bookingNumber ?? "").trim();
    if (originalId && ref && !successorRefByOriginalId.has(originalId)) {
      successorRefByOriginalId.set(originalId, ref);
    }
  }

  for (const booking of input.bookings) {
    const bookingNumber = (booking.bookingNumber ?? "").trim() || "Booking";
    const currency = (booking.currency ?? input.fallbackCurrency ?? "GBP").toUpperCase();
    const balancePaidToPlatform = isPaidRescheduleSuccessor(booking);
    const settlement = settleBookingFees(booking);
    const rowDoctorId = (booking.doctorId ?? "").trim();
    const patientLabel =
      viewerDoctorId && rowDoctorId !== viewerDoctorId
        ? bookingNumber
        : statementPatientLabel(
            booking.patientFirstName,
            booking.patientLastName,
            bookingNumber
          );
    const successorRef = successorRefByOriginalId.get((booking.id ?? "").trim());
    const bookingStatusLabel = balancePaidToPlatform
      ? RESCHEDULE_BALANCE_LABEL
      : successorRef
        ? rescheduledToLabel(successorRef)
        : statementStatusLabel(booking.status);
    let service = statementServiceLabel(booking.serviceName, booking.consultationType);
    const clinician = (booking.clinicianName ?? "").trim();
    if (input.showClinician && clinician) {
      service = `${service} · ${clinician}`;
    }
    const appointment = appointmentLabel(booking);
    const paidInMonth = inLondonRange(booking.paidAt, start, end);
    const refundInMonth = inLondonRange(booking.refundedAt, start, end);
    const refund = allocateRefund(settlement, booking.refundAmountCents);
    const hasRefund = refund.refundCents > 0;
    const refundFallsInPaidMonth = hasRefund && !booking.refundedAt && paidInMonth;

    if (paidInMonth && booking.paidAt) {
      lines.push({
        kind: "booking",
        occurredAt: booking.paidAt,
        dateLabel: formatEmailDateTime(booking.paidAt, STATEMENT_TIME_ZONE),
        bookingNumber,
        patientLabel,
        serviceLabel: service,
        appointmentLabel: appointment,
        statusLabel: bookingStatusLabel,
        settlementLabel: balancePaidToPlatform
          ? null
          : settlementLabel(settlement.settlement),
        currency,
        grossConsultCents: settlement.grossConsultCents,
        connectedAccountCents: settlement.connectedAccountCents,
        platformFeeCents: settlement.platformFeeCents,
        refundAmountCents: 0,
        excludeFromTotals: balancePaidToPlatform,
      });
    }

    const includeRefund =
      hasRefund && (refundInMonth || refundFallsInPaidMonth);
    if (includeRefund) {
      const occurredAt = booking.refundedAt || booking.paidAt || start.toISOString();
      lines.push({
        kind: "refund",
        occurredAt,
        dateLabel: formatEmailDateTime(occurredAt, STATEMENT_TIME_ZONE),
        bookingNumber,
        patientLabel,
        serviceLabel: service,
        appointmentLabel: appointment,
        statusLabel: "Refund",
        settlementLabel: null,
        currency,
        grossConsultCents: 0,
        connectedAccountCents: -refund.transferReversedCents,
        platformFeeCents: -refund.platformFeeReturnedCents,
        refundAmountCents: refund.refundCents,
        excludeFromTotals: balancePaidToPlatform,
      });
    }
  }

  lines.sort((a, b) => {
    const time = a.occurredAt.localeCompare(b.occurredAt);
    if (time !== 0) return time;
    const ref = a.bookingNumber.localeCompare(b.bookingNumber);
    if (ref !== 0) return ref;
    return a.kind === b.kind ? 0 : a.kind === "booking" ? -1 : 1;
  });

  const now = input.now ?? new Date();
  return {
    title: ACTIVITY_STATEMENT_TITLE,
    periodLabel: formatStatementMonth(input.year, input.month),
    monthKey: `${input.year}-${String(input.month).padStart(2, "0")}`,
    payeeName: input.payeeName.trim() || "Doctor",
    scopeLabel: input.scopeLabel,
    generatedLabel: formatEmailDateTime(now.toISOString(), STATEMENT_TIME_ZONE),
    lines,
    totals: accumulateActivityStatementTotals(lines, input.fallbackCurrency ?? "GBP"),
    truncated: Boolean(input.truncated),
    footer: ACTIVITY_STATEMENT_FOOTER,
    figuresNote: ACTIVITY_STATEMENT_FIGURES_NOTE,
  };
}
