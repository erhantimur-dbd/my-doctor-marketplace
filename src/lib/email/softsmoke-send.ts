/**
 * Tester-path mail selection. Non-Softsmoke doctors keep the existing templates.
 * Does not publish Resend dashboard templates and does not send Soft CTA copy.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/client";
import { bookingConfirmationEmail } from "@/lib/email/templates";
import { log } from "@/lib/utils/logger";
import {
  BOOKING_CURRENT_DOCTOR_INNER_EMBED,
  BOOKING_DOCTOR_PROFILE_EMBED,
} from "@/lib/patient/booking-doctor-embed";
import {
  doctorDiaryUrl,
  firstNameOnly,
  formatDoctorDisplayName,
  isSoftsmokeTransactionalDoctor,
  manageBookingUrl,
  softsmokeDoctorCancelRescheduleEmail,
  softsmokeDoctorPayoutEmail,
  softsmokePatientConfirmEmail,
  softsmokePatientRefundEmail,
} from "@/lib/email/softsmoke-templates";

type DoctorRef = {
  id?: string | null;
  slug?: string | null;
  email?: string | null;
} | null;

type ConfirmationParams = Parameters<typeof bookingConfirmationEmail>[0] & {
  doctor?: DoctorRef;
  timeZone?: string;
  manageUrl?: string;
  bookingId?: string;
};

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function resolvePatientConfirmationEmail(params: ConfirmationParams): {
  subject: string;
  html: string;
} {
  if (!isSoftsmokeTransactionalDoctor(params.doctor)) {
    return bookingConfirmationEmail(params);
  }
  return softsmokePatientConfirmEmail({
    patientFirstName: firstNameOnly(params.patientName, "there"),
    doctorDisplayName: formatDoctorDisplayName(params.doctorName),
    appointmentDate: params.date,
    appointmentTime: params.time,
    timeZone: params.timeZone,
    bookingRef: params.bookingNumber,
    appointmentType: params.consultationType,
    joinUrl: params.videoRoomUrl,
    manageUrl: params.manageUrl || manageBookingUrl(params.bookingId),
  });
}

export async function sendSoftsmokeChargeSkipPatientConfirmation(
  supabase: SupabaseClient,
  bookingId: string,
  videoRoomUrl: string | null
): Promise<void> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_number,
      doctor_id,
      appointment_date,
      start_time,
      consultation_type,
      patient:profiles!bookings_patient_id_fkey(first_name, last_name, email),
      doctor:${BOOKING_CURRENT_DOCTOR_INNER_EMBED}(
        id,
        slug,
        profile:${BOOKING_DOCTOR_PROFILE_EMBED}(first_name, last_name, email)
      )
    `
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) {
    log.error("[Softsmoke mail] charge-skip confirm booking missing", {
      err: error,
      bookingId,
    });
    return;
  }

  const row = data as unknown as {
    id: string;
    booking_number: string;
    doctor_id: string;
    appointment_date: string;
    start_time: string;
    consultation_type: string;
    patient:
      | { first_name: string | null; last_name: string | null; email: string | null }
      | { first_name: string | null; last_name: string | null; email: string | null }[]
      | null;
    doctor:
      | {
          id?: string | null;
          slug?: string | null;
          profile:
            | {
                first_name: string | null;
                last_name: string | null;
                email: string | null;
              }
            | {
                first_name: string | null;
                last_name: string | null;
                email: string | null;
              }[]
            | null;
        }
      | null;
  };

  const patient = unwrap(row.patient);
  const doctor = unwrap(row.doctor);
  const doctorProfile = unwrap(doctor?.profile);
  if (
    !isSoftsmokeTransactionalDoctor({
      id: doctor?.id || row.doctor_id,
      slug: doctor?.slug,
      email: doctorProfile?.email,
    })
  ) {
    return;
  }
  if (!patient?.email) return;

  const doctorName = [doctorProfile?.first_name, doctorProfile?.last_name]
    .filter(Boolean)
    .join(" ");
  const { subject, html } = softsmokePatientConfirmEmail({
    patientFirstName: patient.first_name || "there",
    doctorDisplayName: doctorName,
    appointmentDate: row.appointment_date,
    appointmentTime: row.start_time,
    bookingRef: row.booking_number,
    appointmentType: row.consultation_type,
    joinUrl: videoRoomUrl,
    manageUrl: manageBookingUrl(row.id),
  });

  await sendEmail({ to: patient.email, subject, html }).catch((err) =>
    log.error("[Softsmoke mail] patient confirm failed", { err, bookingId })
  );
}

export async function sendSoftsmokeDoctorDiaryChange(input: {
  doctor: DoctorRef;
  doctorEmail?: string | null;
  kind: "cancel" | "reschedule";
  doctorFirstName?: string | null;
  patientFirstName?: string | null;
  bookingRef: string;
  oldDate: string;
  oldTime: string;
  newDate?: string | null;
  newTime?: string | null;
  appointmentType?: string | null;
}): Promise<void> {
  if (!isSoftsmokeTransactionalDoctor(input.doctor)) return;
  const to = input.doctorEmail?.trim();
  if (!to) return;
  const { subject, html } = softsmokeDoctorCancelRescheduleEmail({
    kind: input.kind,
    doctorFirstName: input.doctorFirstName || "there",
    patientFirstName: input.patientFirstName || "A patient",
    bookingRef: input.bookingRef,
    oldDate: input.oldDate,
    oldTime: input.oldTime,
    newDate: input.newDate,
    newTime: input.newTime,
    appointmentType: input.appointmentType,
    diaryUrl: doctorDiaryUrl(),
  });
  await sendEmail({ to, subject, html }).catch((err) =>
    log.error("[Softsmoke mail] doctor diary change failed", { err })
  );
}

export function softsmokeRefundNotice(input: {
  patientFirstName: string;
  bookingRef: string;
  refundRef: string;
  refundAmount: number;
  currency: string;
  originalPaidAt?: string | null;
  bookingId?: string | null;
}): { subject: string; html: string } {
  return softsmokePatientRefundEmail({
    patientFirstName: input.patientFirstName,
    bookingRef: input.bookingRef,
    refundRef: input.refundRef,
    refundAmount: input.refundAmount,
    currency: input.currency,
    originalPaidAt: input.originalPaidAt,
    manageUrl: manageBookingUrl(input.bookingId),
  });
}

type TransferLike = {
  id: string;
  amount: number;
  currency: string;
  destination: string | { id?: string | null } | null;
  created?: number;
  source_transaction?: string | { id?: string | null } | null;
  metadata?: Record<string, string> | null;
};

/**
 * Stripe Connect transfer → tester doctor only.
 * Other connected accounts return before any mail is built.
 */
export async function sendSoftsmokeTransferNotice(
  supabase: SupabaseClient,
  transfer: TransferLike,
  options?: {
    retrieveChargePaymentIntent?: (chargeId: string) => Promise<string | null>;
  }
): Promise<{ sent: boolean }> {
  const destination =
    typeof transfer.destination === "string"
      ? transfer.destination
      : transfer.destination?.id;
  if (!destination) return { sent: false };

  const { data: doctorRow } = await supabase
    .from("doctors")
    .select(
      `
      id,
      slug,
      profile:profiles!doctors_profile_id_fkey(first_name, email)
    `
    )
    .eq("stripe_account_id", destination)
    .maybeSingle();

  const doctor = doctorRow as {
    id?: string;
    slug?: string | null;
    profile?:
      | { first_name?: string | null; email?: string | null }
      | { first_name?: string | null; email?: string | null }[]
      | null;
  } | null;
  const profile = unwrap(doctor?.profile);
  if (
    !isSoftsmokeTransactionalDoctor({
      id: doctor?.id,
      slug: doctor?.slug,
      email: profile?.email,
    })
  ) {
    return { sent: false };
  }
  if (!profile?.email) return { sent: false };

  let bookingId = transfer.metadata?.booking_id || null;
  if (!bookingId && options?.retrieveChargePaymentIntent) {
    const chargeId =
      typeof transfer.source_transaction === "string"
        ? transfer.source_transaction
        : transfer.source_transaction?.id;
    if (chargeId) {
      const paymentIntentId = await options.retrieveChargePaymentIntent(chargeId);
      if (paymentIntentId) {
        const { data: byPi } = await supabase
          .from("bookings")
          .select("id")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();
        bookingId = (byPi as { id?: string } | null)?.id ?? null;
      }
    }
  }

  if (!bookingId) {
    log.error("[Softsmoke mail] payout notice skipped — booking unresolved", {
      transferId: transfer.id,
    });
    return { sent: false };
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, booking_number, consultation_fee_cents, platform_fee_cents, total_amount_cents, currency, appointment_date, paid_at"
    )
    .eq("id", bookingId)
    .maybeSingle();

  const row = booking as {
    id: string;
    booking_number: string;
    consultation_fee_cents: number | null;
    platform_fee_cents: number | null;
    total_amount_cents: number | null;
    currency: string | null;
    appointment_date: string | null;
    paid_at: string | null;
  } | null;
  if (!row?.booking_number) return { sent: false };

  const currency = (row.currency || transfer.currency || "gbp").toUpperCase();
  const grossCents =
    row.consultation_fee_cents ?? row.total_amount_cents ?? transfer.amount;
  const platformFeeCents = row.platform_fee_cents ?? 0;
  const netCents = transfer.amount;
  const period =
    row.appointment_date ||
    row.paid_at ||
    (transfer.created
      ? new Date(transfer.created * 1000).toISOString()
      : new Date().toISOString());

  const { subject, html } = softsmokeDoctorPayoutEmail({
    doctorFirstName: profile.first_name || "there",
    grossAmount: grossCents / 100,
    platformFee: platformFeeCents / 100,
    netToConnectedAccount: netCents / 100,
    currency,
    bookingRef: row.booking_number,
    payoutOrTransferRef: transfer.id,
    periodOrDate: period,
  });

  const result = await sendEmail({ to: profile.email, subject, html });
  return { sent: result.success };
}
