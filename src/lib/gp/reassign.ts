/**
 * GP reassignment orchestration: same-slot auto-assign or patient offers + refund.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  findSameSlotGpReplacements,
  resolveGpDisplayMode,
  type EligibleGp,
} from "./eligibility";
import { findAlternateGpSlots } from "./alternatives";
import {
  doctorNetFromBooking,
  handoffConnectTransfer,
} from "@/lib/stripe/transfer-handoff";
import { getStripe } from "@/lib/stripe/client";
import { sendEmail } from "@/lib/email/client";
import { sendSms } from "@/lib/sms/client";
import {
  gpReassignedPatientEmail,
  gpAlternateSlotsEmail,
  gpReassignmentRefundEmail,
  gpReassignedAwayDoctorEmail,
} from "@/lib/email/templates";
import { notifyDoctorOfNewBooking } from "@/lib/notifications/doctor-new-booking";
import { createNotification } from "@/lib/notifications";
import { log } from "@/lib/utils/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";

export type ReassignmentOutcome =
  | { outcome: "auto_reassigned"; newDoctorId: string; newDoctorName: string }
  | { outcome: "pending_patient_choice"; offerCount: number }
  | { outcome: "refunded" }
  | { outcome: "error"; error: string };

async function fullRefundBooking(booking: {
  id: string;
  stripe_payment_intent_id: string | null;
  payment_mode?: string | null;
  deposit_amount_cents?: number | null;
  total_amount_cents: number;
  paid_at?: string | null;
}): Promise<{ refunded: boolean; amount: number; error?: string }> {
  const amount =
    booking.payment_mode === "deposit" && booking.deposit_amount_cents != null
      ? booking.deposit_amount_cents
      : booking.total_amount_cents;

  if (!booking.stripe_payment_intent_id || !booking.paid_at || amount <= 0) {
    return { refunded: false, amount: 0 };
  }

  try {
    await getStripe().refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount,
      reverse_transfer: true,
      refund_application_fee: true,
    });
    return { refunded: true, amount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    log.error("[GP] fullRefundBooking failed", { err, bookingId: booking.id });
    return { refunded: false, amount: 0, error: message };
  }
}

async function applyDoctorHandoff(
  booking: {
    id: string;
    stripe_payment_intent_id: string | null;
    payment_mode?: string | null;
    deposit_amount_cents?: number | null;
    total_amount_cents: number;
    platform_fee_cents?: number | null;
    commission_cents?: number | null;
    currency: string;
    paid_at?: string | null;
  },
  fromAccountId: string | null,
  toAccountId: string
): Promise<{ ok: boolean; error?: string; newTransferId?: string }> {
  if (!booking.stripe_payment_intent_id || !booking.paid_at) {
    return { ok: true }; // wallet-only or unpaid — just reassign row
  }
  if (!fromAccountId) {
    return { ok: false, error: "Original doctor has no Stripe account" };
  }

  const net = doctorNetFromBooking(booking);
  const result = await handoffConnectTransfer({
    paymentIntentId: booking.stripe_payment_intent_id,
    fromAccountId,
    toAccountId,
    amountCents: net,
    currency: booking.currency,
    bookingId: booking.id,
  });

  if (!result.success) {
    return { ok: false, error: result.error };
  }
  return { ok: true, newTransferId: result.newTransferId };
}

/**
 * Core: doctor cannot attend a GP booking.
 */
export async function executeGpReassignmentRequest(params: {
  bookingId: string;
  requestingDoctorId: string;
  reason?: string;
}): Promise<ReassignmentOutcome> {
  const supabase = createAdminClient();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      `
      *,
      patient:profiles!bookings_patient_id_fkey(
        first_name, last_name, email, phone, notification_sms
      ),
      doctor:doctors!inner(
        id, profile_id, stripe_account_id, slug, organization_id, clinic_name, address,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, email, phone)
      )
    `
    )
    .eq("id", params.bookingId)
    .single();

  if (error || !booking) {
    return { outcome: "error", error: "Booking not found" };
  }

  if (booking.doctor_id !== params.requestingDoctorId) {
    return { outcome: "error", error: "Not your booking" };
  }

  if (!["confirmed", "approved"].includes(booking.status)) {
    return {
      outcome: "error",
      error: "Only confirmed GP appointments can be reassigned this way",
    };
  }

  if (
    booking.gp_reassignment_status === "pending_patient_choice" ||
    booking.gp_reassignment_status === "auto_reassigned"
  ) {
    return {
      outcome: "error",
      error: "Reassignment already in progress for this booking",
    };
  }

  const isGp =
    booking.is_gp_pool === true ||
    (await import("./eligibility").then((m) =>
      m.isGpPoolBooking({
        is_gp_pool: booking.is_gp_pool,
        doctor_id: booking.doctor_id,
      })
    ));

  if (!isGp) {
    return {
      outcome: "error",
      error: "This flow is only for GP pool appointments",
    };
  }

  const patient = Array.isArray(booking.patient)
    ? booking.patient[0]
    : booking.patient;
  const oldDoctor = Array.isArray(booking.doctor)
    ? booking.doctor[0]
    : booking.doctor;
  const oldProfile = oldDoctor?.profile
    ? Array.isArray(oldDoctor.profile)
      ? oldDoctor.profile[0]
      : oldDoctor.profile
    : null;

  const maxFee = booking.consultation_fee_cents as number;
  const startTime = String(booking.start_time).slice(0, 8);
  const endTime = String(booking.end_time).slice(0, 8);

  // 1) Same-slot replacements
  const candidates = await findSameSlotGpReplacements({
    excludeDoctorId: booking.doctor_id,
    appointmentDate: booking.appointment_date,
    startTime,
    endTime,
    consultationType: booking.consultation_type,
    maxFeeCents: maxFee,
    limit: 5,
  });

  if (candidates.length > 0) {
    const chosen = candidates[0];
    const handoff = await applyDoctorHandoff(
      booking,
      oldDoctor?.stripe_account_id || null,
      chosen.stripe_account_id
    );

    if (!handoff.ok) {
      // Fall through to patient offers rather than stranding payment
      log.error("[GP] Handoff failed, offering alternatives", {
        error: handoff.error,
        bookingId: booking.id,
      });
    } else {
      const displayMode = await resolveGpDisplayMode(
        chosen.id,
        chosen.organization_id
      );
      const newName = `Dr. ${chosen.profile.first_name || ""} ${chosen.profile.last_name || ""}`.trim();

      await supabase
        .from("bookings")
        .update({
          doctor_id: chosen.id,
          reassigned_from_doctor_id: params.requestingDoctorId,
          reassigned_at: new Date().toISOString(),
          gp_reassignment_status: "auto_reassigned",
          is_gp_pool: true,
          display_doctor_as: displayMode,
          cancellation_reason: params.reason || "Doctor unavailable — reassigned",
          stripe_reassignment_transfer_id: handoff.newTransferId || null,
          organization_id: chosen.organization_id,
        })
        .eq("id", booking.id);

      // Notify patient
      if (patient?.email) {
        const dateStr = new Date(booking.appointment_date).toLocaleDateString(
          "en-GB",
          { weekday: "short", day: "numeric", month: "short" }
        );
        const { subject, html } = gpReassignedPatientEmail({
          patientName: patient.first_name || "there",
          bookingNumber: booking.booking_number,
          date: dateStr,
          time: startTime.slice(0, 5),
          displayAsGeneric: displayMode === "generic_gp",
          doctorName: newName,
          consultationType:
            booking.consultation_type === "video"
              ? "Video Consultation"
              : "In-Person Consultation",
          dashboardUrl: `${APP_URL}/en/dashboard/bookings/${booking.id}`,
        });
        sendEmail({ to: patient.email, subject, html }).catch((err) =>
          log.error("[GP] patient reassign email", { err })
        );
      }

      // Notify old doctor
      if (oldProfile?.email) {
        const { subject, html } = gpReassignedAwayDoctorEmail({
          doctorName: oldProfile.first_name || "Doctor",
          bookingNumber: booking.booking_number,
          patientName: `${patient?.first_name || ""} ${patient?.last_name || ""}`.trim(),
        });
        sendEmail({ to: oldProfile.email, subject, html }).catch(() => {});
      }

      // Notify new doctor (full new-booking flow)
      await notifyDoctorOfNewBooking({
        bookingId: booking.id,
        doctorId: chosen.id,
        patientId: booking.patient_id,
        patientFirstName: patient?.first_name || null,
        patientLastName: patient?.last_name || null,
        appointmentDate: booking.appointment_date,
        startTime,
        consultationType: booking.consultation_type,
        bookingNumber: booking.booking_number,
        totalAmountCents: booking.total_amount_cents,
        currency: booking.currency,
      });

      return {
        outcome: "auto_reassigned",
        newDoctorId: chosen.id,
        newDoctorName: newName,
      };
    }
  }

  // 2) Alternate slots for patient
  const alts = await findAlternateGpSlots({
    excludeDoctorId: booking.doctor_id,
    consultationType: booking.consultation_type,
    maxFeeCents: maxFee,
    limit: 3,
  });

  if (alts.length > 0) {
    // Insert offers
    const rows = alts.map((a) => ({
      booking_id: booking.id,
      doctor_id: a.doctorId,
      appointment_date: a.appointmentDate,
      start_time: a.startTime,
      end_time: a.endTime,
      consultation_type: a.consultationType,
      fee_cents: a.feeCents,
      token: a.token,
      status: "pending",
      expires_at: a.expiresAt,
    }));

    await supabase.from("gp_slot_offers").insert(rows);

    await supabase
      .from("bookings")
      .update({
        gp_reassignment_status: "pending_patient_choice",
        cancellation_reason:
          params.reason || "Doctor unavailable — awaiting patient choice",
        is_gp_pool: true,
      })
      .eq("id", booking.id);

    if (patient?.email) {
      const offerLinks = alts.map((a) => ({
        label: `${a.doctorName} — ${a.appointmentDate} at ${a.startTime.slice(0, 5)}`,
        url: `${APP_URL}/en/gp-offer/${a.token}`,
      }));
      const { subject, html } = gpAlternateSlotsEmail({
        patientName: patient.first_name || "there",
        bookingNumber: booking.booking_number,
        originalDate: booking.appointment_date,
        originalTime: startTime.slice(0, 5),
        offers: offerLinks,
        declineUrl: `${APP_URL}/en/gp-offer/${alts[0].token}?action=decline_all`,
        expiresHours: 2,
      });
      sendEmail({ to: patient.email, subject, html }).catch((err) =>
        log.error("[GP] alternate slots email", { err })
      );

      if (patient.notification_sms !== false && patient.phone) {
        sendSms({
          to: patient.phone,
          body: `MyDoctors360: Your GP cannot attend ${booking.booking_number}. Please choose a new time: ${APP_URL}/en/gp-offer/${alts[0].token} (expires in 2h). Reply to email for options.`,
        }).catch(() => {});
      }
    }

    if (oldDoctor?.profile_id) {
      createNotification({
        userId: oldDoctor.profile_id,
        type: "gp_reassignment_pending",
        title: "GP reassignment pending",
        message: `Patient is choosing an alternative for ${booking.booking_number}.`,
        channels: ["in_app"],
        metadata: { booking_id: booking.id },
      }).catch(() => {});
    }

    return { outcome: "pending_patient_choice", offerCount: alts.length };
  }

  // 3) No inventory → full refund
  const refund = await fullRefundBooking(booking);
  await supabase
    .from("bookings")
    .update({
      status: "cancelled_doctor",
      cancelled_at: new Date().toISOString(),
      cancellation_reason:
        params.reason || "Doctor unavailable — no GP replacement found",
      gp_reassignment_status: "refunded",
      refunded_at: refund.refunded ? new Date().toISOString() : null,
      refund_amount_cents: refund.refunded ? refund.amount : null,
    })
    .eq("id", booking.id);

  if (patient?.email) {
    const { subject, html } = gpReassignmentRefundEmail({
      patientName: patient.first_name || "there",
      bookingNumber: booking.booking_number,
      refundAmount: refund.amount / 100,
      currency: (booking.currency || "GBP").toUpperCase(),
    });
    sendEmail({ to: patient.email, subject, html }).catch(() => {});
  }

  return { outcome: "refunded" };
}

/**
 * Patient accepts a gp_slot_offer token.
 */
export async function acceptGpSlotOffer(
  token: string
): Promise<{ success?: boolean; error?: string; bookingId?: string }> {
  const supabase = createAdminClient();

  const { data: offer } = await supabase
    .from("gp_slot_offers")
    .select("*, booking:bookings(*)")
    .eq("token", token)
    .single();

  if (!offer) return { error: "Offer not found" };
  if (offer.status !== "pending") return { error: "This offer is no longer available" };
  if (new Date(offer.expires_at).getTime() < Date.now()) {
    await supabase
      .from("gp_slot_offers")
      .update({ status: "expired" })
      .eq("id", offer.id);
    return { error: "This offer has expired" };
  }

  const booking = Array.isArray(offer.booking) ? offer.booking[0] : offer.booking;
  if (!booking) return { error: "Booking not found" };
  if (booking.gp_reassignment_status !== "pending_patient_choice") {
    return { error: "Booking is not awaiting your choice" };
  }

  // Load old + new doctor stripe accounts
  const { data: oldDoctor } = await supabase
    .from("doctors")
    .select("id, stripe_account_id")
    .eq("id", booking.doctor_id)
    .single();

  const { data: newDoctor } = await supabase
    .from("doctors")
    .select(
      "id, stripe_account_id, organization_id, profile:profiles!doctors_profile_id_fkey(first_name, last_name)"
    )
    .eq("id", offer.doctor_id)
    .single();

  if (!newDoctor?.stripe_account_id) {
    return { error: "Replacement doctor cannot accept payments yet" };
  }

  const handoff = await applyDoctorHandoff(
    booking,
    oldDoctor?.stripe_account_id || null,
    newDoctor.stripe_account_id
  );

  if (!handoff.ok) {
    return {
      error:
        handoff.error ||
        "Could not move payment to the new doctor. Please contact support.",
    };
  }

  const displayMode = await resolveGpDisplayMode(
    newDoctor.id,
    newDoctor.organization_id
  );

  await supabase
    .from("bookings")
    .update({
      doctor_id: offer.doctor_id,
      appointment_date: offer.appointment_date,
      start_time: offer.start_time,
      end_time: offer.end_time,
      reassigned_from_doctor_id: booking.doctor_id,
      reassigned_at: new Date().toISOString(),
      gp_reassignment_status: "patient_accepted",
      display_doctor_as: displayMode,
      is_gp_pool: true,
      organization_id: newDoctor.organization_id,
      stripe_reassignment_transfer_id: handoff.newTransferId || null,
      status: "confirmed",
    })
    .eq("id", booking.id);

  // Supersede other offers
  await supabase
    .from("gp_slot_offers")
    .update({ status: "superseded" })
    .eq("booking_id", booking.id)
    .eq("status", "pending")
    .neq("id", offer.id);

  await supabase
    .from("gp_slot_offers")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", offer.id);

  const { data: patient } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", booking.patient_id)
    .single();

  await notifyDoctorOfNewBooking({
    bookingId: booking.id,
    doctorId: offer.doctor_id,
    patientId: booking.patient_id,
    patientFirstName: patient?.first_name || null,
    patientLastName: patient?.last_name || null,
    appointmentDate: offer.appointment_date,
    startTime: String(offer.start_time),
    consultationType: offer.consultation_type,
    bookingNumber: booking.booking_number,
    totalAmountCents: booking.total_amount_cents,
    currency: booking.currency,
  });

  return { success: true, bookingId: booking.id };
}

/**
 * Patient declines all offers → full refund.
 */
export async function declineAllGpOffers(
  bookingId: string,
  token?: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  if (token) {
    const { data: offer } = await supabase
      .from("gp_slot_offers")
      .select("booking_id")
      .eq("token", token)
      .maybeSingle();
    if (offer) bookingId = offer.booking_id;
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (!booking) return { error: "Booking not found" };
  if (booking.gp_reassignment_status !== "pending_patient_choice") {
    return { error: "Nothing to decline" };
  }

  const refund = await fullRefundBooking(booking);

  await supabase
    .from("bookings")
    .update({
      status: "cancelled_doctor",
      cancelled_at: new Date().toISOString(),
      gp_reassignment_status: "patient_declined",
      refunded_at: refund.refunded ? new Date().toISOString() : null,
      refund_amount_cents: refund.refunded ? refund.amount : null,
      cancellation_reason: "Patient declined alternate GP slots",
    })
    .eq("id", booking.id);

  await supabase
    .from("gp_slot_offers")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("booking_id", booking.id)
    .eq("status", "pending");

  const { data: patient } = await supabase
    .from("profiles")
    .select("first_name, email")
    .eq("id", booking.patient_id)
    .single();

  if (patient?.email) {
    const { subject, html } = gpReassignmentRefundEmail({
      patientName: patient.first_name || "there",
      bookingNumber: booking.booking_number,
      refundAmount: (refund.amount || 0) / 100,
      currency: (booking.currency || "GBP").toUpperCase(),
    });
    sendEmail({ to: patient.email, subject, html }).catch(() => {});
  }

  return { success: true };
}

/**
 * Expire pending offers and refund (cron).
 */
export async function expireGpOffersAndRefund(): Promise<{
  processed: number;
}> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: expiredOffers } = await supabase
    .from("gp_slot_offers")
    .select("booking_id")
    .eq("status", "pending")
    .lt("expires_at", now);

  const bookingIds = [
    ...new Set((expiredOffers || []).map((o) => o.booking_id)),
  ];

  let processed = 0;
  for (const bookingId of bookingIds) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .eq("gp_reassignment_status", "pending_patient_choice")
      .maybeSingle();

    if (!booking) continue;

    await supabase
      .from("gp_slot_offers")
      .update({ status: "expired" })
      .eq("booking_id", bookingId)
      .eq("status", "pending");

    const refund = await fullRefundBooking(booking);
    await supabase
      .from("bookings")
      .update({
        status: "cancelled_doctor",
        cancelled_at: new Date().toISOString(),
        gp_reassignment_status: "refunded",
        refunded_at: refund.refunded ? new Date().toISOString() : null,
        refund_amount_cents: refund.refunded ? refund.amount : null,
        cancellation_reason: "Alternate GP offers expired without response",
      })
      .eq("id", bookingId);

    processed++;
  }

  return { processed };
}

// re-export type for UI
export type { EligibleGp };
