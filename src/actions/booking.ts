"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { revalidatePath } from "next/cache";
import {
  createBookingSchema,
  cancelBookingSchema,
  type CreateBookingInput,
  type CancelBookingInput,
} from "@/lib/validators/booking";
import { BOOKING_STATUSES } from "@/lib/constants/booking-status";
import type { AvailableSlot } from "@/types/index";
import { headers } from "next/headers";
import { removeBookingFromGoogleCalendar } from "@/lib/google/sync";
import { removeBookingFromMicrosoftCalendar } from "@/lib/microsoft/sync";
import { removeBookingFromCalDAV } from "@/lib/caldav/sync";
import { deleteRoom } from "@/lib/daily/client";
import { sendEmail } from "@/lib/email/client";
import { bookingCancellationEmail } from "@/lib/email/templates";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/client";
import {
  TEMPLATE_BOOKING_CANCELLATION,
  buildBookingCancellationComponents,
  mapLocaleToWhatsApp,
} from "@/lib/whatsapp/templates";
import { notifyAvailabilitySubscribers } from "@/actions/availability-alerts";
import { sendSms } from "@/lib/sms/client";
import { bookingCancellationSms } from "@/lib/sms/templates";
import { creditWallet, debitWallet, getWalletBalance } from "@/lib/wallet";

import {
  getBookingFeeCents,
  calculateDepositCents,
  getCommissionCents,
  formatCurrency,
} from "@/lib/utils/currency";
import { createNotification } from "@/lib/notifications";
import { log } from "@/lib/utils/logger";

/** Derive origin + locale from incoming request headers. */
async function getOriginAndLocale() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Extract locale from the referer path (e.g. /de/doctors/slug/book)
  const referer = h.get("referer") || "";
  const localeMatch = referer.match(/\/(en|de|tr|fr|it|es|pt|zh|ja)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "en";

  return { origin, locale };
}

const CANCELLABLE_STATUSES = [
  BOOKING_STATUSES.CONFIRMED,
  BOOKING_STATUSES.PENDING_APPROVAL,
  BOOKING_STATUSES.APPROVED,
];

export async function createBookingAndCheckout(input: CreateBookingInput) {
  try {
    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) {
      log.error("Booking validation errors", { issues: parsed.error.issues });
      log.error("Booking input received", { input: { doctor_id: input.doctor_id, date: input.appointment_date } });
      return { error: "Invalid booking data. Please check your input." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to book an appointment." };
    }

    // Fetch doctor with profile to get pricing and Stripe account
    const { data: doctor, error: doctorError } = await supabase
      .from("doctors")
      .select(
        `
        id,
        slug,
        stripe_account_id,
        stripe_onboarding_complete,
        consultation_fee_cents,
        video_consultation_fee_cents,
        base_currency,
        cancellation_policy,
        consultation_types,
        in_person_deposit_type,
        in_person_deposit_value,
        is_active,
        verification_status,
        organization_id,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)
      `
      )
      .eq("id", parsed.data.doctor_id)
      .single();

    if (doctorError || !doctor) {
      return { error: "Doctor not found." };
    }

    if (!doctor.is_active || doctor.verification_status !== "verified") {
      return { error: "This doctor is not currently accepting appointments." };
    }

    if (!doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
      return {
        error:
          "This doctor has not completed their payment setup. Please try again later.",
      };
    }

    // Check doctor's org has an active license (or legacy subscription)
    const adminSupabase = createAdminClient();
    let hasActiveLicense = false;

    // New: check organization license
    if (doctor.organization_id) {
      const { data: orgLicense } = await adminSupabase
        .from("licenses")
        .select("id")
        .eq("organization_id", doctor.organization_id)
        .in("status", ["active", "trialing", "past_due"])
        .limit(1)
        .maybeSingle();
      hasActiveLicense = !!orgLicense;
    }

    if (!hasActiveLicense) {
      return {
        error: "This doctor is not currently accepting online bookings.",
      };
    }

    // Ensure the consultation type is supported
    if (!doctor.consultation_types?.includes(parsed.data.consultation_type)) {
      return {
        error: "This doctor does not offer the selected consultation type.",
      };
    }

    // Calculate fees — service-aware pricing
    let consultationFeeCents: number;
    let serviceName: string | null = null;
    const serviceId: string | null = parsed.data.service_id || null;

    // Track service-level deposit overrides
    let serviceDepositType: string | null = null;
    let serviceDepositValue: number | null = null;

    if (serviceId) {
      // Returning patient with selected service — use service price
      const { data: service } = await supabase
        .from("doctor_services")
        .select("*, deposit_type, deposit_value")
        .eq("id", serviceId)
        .eq("doctor_id", parsed.data.doctor_id)
        .single();

      if (!service || !service.is_active) {
        return { error: "Selected service is no longer available." };
      }

      consultationFeeCents = service.price_cents;
      serviceName = service.name;
      serviceDepositType = (service as any).deposit_type ?? null;
      serviceDepositValue = (service as any).deposit_value ?? null;
    } else {
      // First visit or doctor has no services — use default fee
      consultationFeeCents =
        parsed.data.consultation_type === "video" &&
        doctor.video_consultation_fee_cents
          ? doctor.video_consultation_fee_cents
          : doctor.consultation_fee_cents;
    }

    const platformFeeCents = getBookingFeeCents(doctor.base_currency);
    const commissionCents = getCommissionCents(consultationFeeCents);
    const totalAmountCents = consultationFeeCents + platformFeeCents;

    // Resolve deposit config: service override → doctor default → none
    // Video consultations are ALWAYS full payment; deposit only applies to in-person
    let resolvedDepositType: string | null = null;
    let resolvedDepositValue: number | null = null;

    if (parsed.data.consultation_type === "in_person") {
      if (serviceDepositType != null) {
        // Service has its own deposit override
        resolvedDepositType = serviceDepositType;
        resolvedDepositValue = serviceDepositValue;
      } else {
        // Use doctor's default for in-person
        resolvedDepositType = (doctor as any).in_person_deposit_type ?? "none";
        resolvedDepositValue = (doctor as any).in_person_deposit_value ?? null;
      }
    }

    const depositAmountCents = calculateDepositCents(
      consultationFeeCents,
      resolvedDepositType,
      resolvedDepositValue
    );
    const isDeposit = depositAmountCents != null && depositAmountCents > 0;
    const remainderDueCents = isDeposit
      ? consultationFeeCents - depositAmountCents
      : null;

    // The amount Stripe will charge the patient:
    // Full: consultation_fee + booking_fee
    // Deposit: deposit_amount + booking_fee
    const stripeChargeCents = isDeposit
      ? depositAmountCents + platformFeeCents
      : totalAmountCents;

    // Application fee = booking fee (from patient) + 15% commission (from doctor's share)
    // In deposit mode the commission is still on the full consultation fee,
    // but it's capped at the Stripe charge so Stripe doesn't reject it.
    const applicationFeeCents = Math.min(
      platformFeeCents + commissionCents,
      stripeChargeCents
    );

    // Insert booking with pending_payment status
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        patient_id: user.id,
        doctor_id: doctor.id,
        appointment_date: parsed.data.appointment_date,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        consultation_type: parsed.data.consultation_type,
        patient_notes: parsed.data.patient_notes || null,
        status: BOOKING_STATUSES.PENDING_PAYMENT,
        currency: doctor.base_currency,
        consultation_fee_cents: consultationFeeCents,
        platform_fee_cents: platformFeeCents,
        commission_cents: commissionCents,
        total_amount_cents: totalAmountCents,
        payment_mode: isDeposit ? "deposit" : "full",
        deposit_amount_cents: depositAmountCents,
        remainder_due_cents: remainderDueCents,
        deposit_type: isDeposit ? resolvedDepositType : null,
        deposit_value: isDeposit ? resolvedDepositValue : null,
        service_id: serviceId,
        service_name: serviceName,
        organization_id: doctor.organization_id || null,
      })
      .select("id, booking_number")
      .single();

    if (bookingError || !booking) {
      log.error("Booking insert error:", { err: bookingError });
      return { error: "Failed to create booking. Please try again." };
    }

    // Compose a readable description for the checkout line item
    const profile = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
    const doctorName = `${profile.first_name} ${profile.last_name}`;
    const consultationLabel = serviceName
      ? serviceName
      : parsed.data.consultation_type === "video"
        ? "Video Consultation"
        : "In-Person Consultation";

    // Check patient's wallet balance — apply credit if available
    const { balance_cents: walletBalance } = await getWalletBalance(
      user.id,
      doctor.base_currency
    );
    const walletCreditToApply = Math.min(walletBalance, stripeChargeCents);
    const remainingCharge = stripeChargeCents - walletCreditToApply;

    // If wallet covers the full charge, confirm booking immediately (no Stripe needed)
    if (remainingCharge === 0 && walletCreditToApply > 0) {
      await debitWallet({
        patientId: user.id,
        currency: doctor.base_currency,
        amountCents: walletCreditToApply,
        sourceType: "refund",
        targetBookingId: booking.id,
        description: `Payment for booking ${booking.booking_number} (wallet only)`,
      });

      // Confirm booking immediately
      await supabase
        .from("bookings")
        .update({
          status: BOOKING_STATUSES.CONFIRMED,
          paid_at: new Date().toISOString(),
          wallet_credit_applied_cents: walletCreditToApply,
        })
        .eq("id", booking.id);

      const { origin, locale } = await getOriginAndLocale();
      return {
        url: `${origin}/${locale}/booking-confirmation?booking_id=${booking.id}&wallet=true`,
        walletOnly: true,
        bookingId: booking.id,
      };
    }

    // Store wallet credit on booking for later debit on payment completion
    if (walletCreditToApply > 0) {
      await supabase
        .from("bookings")
        .update({ wallet_credit_applied_cents: walletCreditToApply })
        .eq("id", booking.id);
    }

    // Create Stripe Checkout Session for the remaining amount
    const { origin, locale } = await getOriginAndLocale();

    // Adjust application fee proportionally if wallet credit reduces the charge
    const adjustedApplicationFee = walletCreditToApply > 0
      ? Math.min(applicationFeeCents, remainingCharge)
      : applicationFeeCents;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: doctor.base_currency.toLowerCase(),
            product_data: {
              name: isDeposit
                ? `Deposit: ${consultationLabel} with Dr. ${doctorName}`
                : `${consultationLabel} with Dr. ${doctorName}`,
              description: isDeposit
                ? `${parsed.data.appointment_date} at ${parsed.data.start_time} (${resolvedDepositType === "percentage" ? `${resolvedDepositValue}% deposit` : "deposit"} — remainder due on the day)`
                : `${parsed.data.appointment_date} at ${parsed.data.start_time}`,
            },
            unit_amount: remainingCharge,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: adjustedApplicationFee,
        transfer_data: {
          destination: doctor.stripe_account_id,
        },
      },
      metadata: {
        booking_id: booking.id,
        booking_number: booking.booking_number,
        payment_mode: isDeposit ? "deposit" : "full",
        ...(walletCreditToApply > 0 ? { wallet_credit_cents: String(walletCreditToApply) } : {}),
      },
      success_url: `${origin}/${locale}/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale}/doctors/${doctor.slug}`,
    });

    return { url: session.url };
  } catch (err) {
    log.error("createBookingAndCheckout error:", { err: err });
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function cancelBooking(input: CancelBookingInput) {
  try {
    const parsed = cancelBookingSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "Invalid cancellation data." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to cancel a booking." };
    }

    // Fetch booking with doctor + patient details for cancellation email
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        *,
        patient:profiles!bookings_patient_id_fkey(first_name, last_name, email, phone, notification_sms, notification_whatsapp, preferred_locale),
        doctor:doctors!inner(
          slug,
          cancellation_policy,
          cancellation_hours,
          stripe_account_id,
          profile:profiles!doctors_profile_id_fkey(first_name, last_name)
        )
      `
      )
      .eq("id", parsed.data.booking_id)
      .single();

    if (bookingError || !booking) {
      return { error: "Booking not found." };
    }

    // Verify ownership
    if (booking.patient_id !== user.id) {
      return { error: "You are not authorized to cancel this booking." };
    }

    // Verify the booking is in a cancellable status
    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      return { error: "This booking cannot be cancelled in its current state." };
    }

    // Calculate hours until appointment
    const appointmentDateTime = new Date(
      `${booking.appointment_date}T${booking.start_time}`
    );
    const now = new Date();
    const hoursUntilAppointment =
      (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Determine refund amount based on cancellation policy
    let refundPercent = 0;
    const policy = booking.doctor.cancellation_policy;

    if (policy === "flexible") {
      // Full refund if more than 24 hours before appointment
      refundPercent = hoursUntilAppointment > 24 ? 100 : 0;
    } else if (policy === "moderate") {
      // 50% refund if more than 48 hours before
      if (hoursUntilAppointment > 48) {
        refundPercent = 100;
      } else if (hoursUntilAppointment > 24) {
        refundPercent = 50;
      } else {
        refundPercent = 0;
      }
    } else if (policy === "strict") {
      // No refund if less than 72 hours before
      refundPercent = hoursUntilAppointment > 72 ? 100 : 0;
    }

    // Process refund — either to wallet (instant) or bank (3-5 days via Stripe)
    // For deposit bookings, refund is based on what was actually charged (deposit + booking fee)
    const stripeChargedAmount =
      booking.payment_mode === "deposit" && booking.deposit_amount_cents != null
        ? booking.deposit_amount_cents + booking.platform_fee_cents
        : booking.total_amount_cents;

    let walletCreditCents = 0;
    const refundDestination = parsed.data.refund_destination || "bank";

    if (refundPercent > 0 && stripeChargedAmount > 0) {
      const refundAmount = Math.round(
        (stripeChargedAmount * refundPercent) / 100
      );

      if (refundDestination === "wallet") {
        // Instant: credit patient wallet, still refund doctor via Stripe
        walletCreditCents = refundAmount;

        // Refund Stripe to reverse the doctor's transfer + platform fee
        if (booking.stripe_payment_intent_id) {
          await getStripe().refunds.create({
            payment_intent: booking.stripe_payment_intent_id,
            amount: refundAmount,
            reverse_transfer: true,
            refund_application_fee: true,
          });
        }

        // Credit the patient's wallet balance
        await creditWallet({
          patientId: user.id,
          currency: booking.currency,
          amountCents: refundAmount,
          sourceType: "refund",
          sourceBookingId: booking.id,
          description: `Refund from cancelled booking ${booking.booking_number}`,
        });
      } else {
        // Bank refund: standard Stripe refund back to patient's payment method
        if (booking.stripe_payment_intent_id) {
          await getStripe().refunds.create({
            payment_intent: booking.stripe_payment_intent_id,
            amount: refundAmount,
            reverse_transfer: true,
            refund_application_fee: true,
          });
        }
      }
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: BOOKING_STATUSES.CANCELLED_PATIENT,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: parsed.data.reason || null,
      })
      .eq("id", booking.id);

    if (updateError) {
      log.error("Booking cancellation update error:", { err: updateError });
      return { error: "Failed to update booking status." };
    }

    // Remove event from doctor's connected calendars (non-blocking)
    removeBookingFromGoogleCalendar(booking.id).catch((err) =>
      log.error("Google Calendar removal error:", { err: err })
    );
    removeBookingFromMicrosoftCalendar(booking.id).catch((err) =>
      log.error("Microsoft Calendar removal error:", { err: err })
    );
    removeBookingFromCalDAV(booking.id).catch((err) =>
      log.error("CalDAV removal error:", { err: err })
    );

    // Delete Daily.co video room if one was created (non-blocking)
    if (booking.daily_room_name) {
      deleteRoom(booking.daily_room_name).catch((err) =>
        log.error("Daily.co room deletion error:", { err: err })
      );
    }

    // Send cancellation email to patient (non-blocking)
    const patient: any = Array.isArray(booking.patient) ? booking.patient[0] : booking.patient;
    const doctor: any = booking.doctor;
    const doctorProfile: any = doctor?.profile
      ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
      : null;

    if (patient?.email && doctorProfile) {
      const refundAmount = refundPercent > 0
        ? (stripeChargedAmount * refundPercent) / 100 / 100
        : 0;

      const { subject, html } = bookingCancellationEmail({
        patientName: patient.first_name || "Patient",
        doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
        date: booking.appointment_date,
        time: booking.start_time,
        bookingNumber: booking.booking_number,
        refundAmount,
        currency: booking.currency.toUpperCase(),
      });

      sendEmail({ to: patient.email, subject, html }).catch((err) =>
        log.error("Cancellation email error:", { err: err })
      );

      // Send WhatsApp cancellation notification if opted in
      if (patient.notification_whatsapp && patient.phone) {
        const refundInfo = refundPercent > 0
          ? `A ${refundPercent}% refund has been initiated.`
          : "No refund applicable per cancellation policy.";

        sendWhatsAppTemplate({
          to: patient.phone,
          templateName: TEMPLATE_BOOKING_CANCELLATION,
          languageCode: mapLocaleToWhatsApp(patient.preferred_locale),
          components: buildBookingCancellationComponents({
            patientName: patient.first_name || "there",
            bookingNumber: booking.booking_number,
            date: booking.appointment_date,
            refundInfo,
          }),
        }).catch((err) =>
          log.error("WhatsApp cancellation error:", { err: err })
        );
      }

      // Send SMS cancellation if opted in
      if (patient.notification_sms && patient.phone) {
        const dateFormatted = new Date(booking.appointment_date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        });

        sendSms({
          to: patient.phone,
          body: bookingCancellationSms({
            patientName: patient.first_name || "there",
            doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
            date: dateFormatted,
            bookingNumber: booking.booking_number,
            refundPercent,
          }),
        }).catch((err) =>
          console.error("SMS cancellation error:", err)
        );
      }
    }

    // Notify doctor about cancellation (non-blocking)
    if (patient && doctorProfile) {
      const { data: doctorRecord } = await supabase
        .from("doctors")
        .select("profile_id")
        .eq("id", booking.doctor_id)
        .single();

      if (doctorRecord) {
        const dateStr = new Date(booking.appointment_date).toLocaleDateString("en-GB", {
          day: "numeric", month: "short",
        });

        createNotification({
          userId: doctorRecord.profile_id,
          type: "booking_cancelled",
          title: "Booking Cancelled",
          message: `${patient.first_name} ${patient.last_name} cancelled their appointment on ${dateStr} at ${booking.start_time?.slice(0, 5)}.`,
          channels: ["in_app"],
          metadata: { booking_id: booking.id },
        }).catch((err) => log.error("Cancellation notification (doctor):", { err }));
      }
    }

    // Notify waitlisted patients that a slot opened up (non-blocking)
    if (doctorProfile) {
      notifyAvailabilitySubscribers(
        booking.doctor_id,
        `Dr. ${doctorProfile.first_name} ${doctorProfile.last_name}`,
        doctor.slug
      ).catch((err) => log.error("Waitlist notification failed", { err, doctorId: booking.doctor_id }));
    }

    revalidatePath("/", "layout");

    const isWalletRefund = refundDestination === "wallet" && walletCreditCents > 0;
    let message: string;
    if (refundPercent === 0) {
      message = "Booking cancelled. No refund is applicable based on the cancellation policy.";
    } else if (isWalletRefund) {
      message = `Booking cancelled. ${booking.currency.toUpperCase()} ${(walletCreditCents / 100).toFixed(2)} has been credited to your wallet instantly.`;
    } else {
      message = `Booking cancelled. A ${refundPercent}% refund will be processed to your bank (3-5 business days).`;
    }

    return {
      success: true,
      refundPercent,
      refundDestination,
      walletCreditCents,
      message,
    };
  } catch (err) {
    log.error("cancelBooking error:", { err: err });
    return { error: "An unexpected error occurred while cancelling." };
  }
}

// ---------------------------------------------------------------------------
// Cancel & Rebook — single transaction (wallet-mediated)
// ---------------------------------------------------------------------------

export async function cancelAndRebook(input: {
  old_booking_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  consultation_type: string;
  patient_notes?: string;
  service_id?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "You must be logged in." };

    // 1. Fetch old booking
    const { data: oldBooking } = await supabase
      .from("bookings")
      .select(
        `*, doctor:doctors!inner(
          cancellation_policy, stripe_account_id,
          profile:profiles!doctors_profile_id_fkey(first_name, last_name)
        )`
      )
      .eq("id", input.old_booking_id)
      .single();

    if (!oldBooking) return { error: "Original booking not found." };
    if (oldBooking.patient_id !== user.id) return { error: "Not your booking." };
    if (!["confirmed", "approved"].includes(oldBooking.status)) {
      return { error: "This booking cannot be rescheduled." };
    }

    // 2. Calculate refund from old booking
    const appointmentDateTime = new Date(
      `${oldBooking.appointment_date}T${oldBooking.start_time}`
    );
    const now = new Date();
    const hoursUntil = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    const doctor: any = oldBooking.doctor;
    const policy = doctor.cancellation_policy;
    let refundPercent = 0;

    if (policy === "flexible") {
      refundPercent = hoursUntil > 24 ? 100 : 0;
    } else if (policy === "moderate") {
      if (hoursUntil > 48) refundPercent = 100;
      else if (hoursUntil > 24) refundPercent = 50;
    } else if (policy === "strict") {
      refundPercent = hoursUntil > 72 ? 100 : 0;
    }

    const stripeCharged = oldBooking.payment_mode === "deposit" && oldBooking.deposit_amount_cents != null
      ? oldBooking.deposit_amount_cents + oldBooking.platform_fee_cents
      : oldBooking.total_amount_cents;
    const refundAmount = Math.round((stripeCharged * refundPercent) / 100);

    // 3. Refund old booking via Stripe (to reverse doctor transfer)
    if (oldBooking.stripe_payment_intent_id && refundAmount > 0) {
      await getStripe().refunds.create({
        payment_intent: oldBooking.stripe_payment_intent_id,
        amount: refundAmount,
        reverse_transfer: true,
        refund_application_fee: true,
      });
    }

    // 4. Credit wallet with refund
    if (refundAmount > 0) {
      await creditWallet({
        patientId: user.id,
        currency: oldBooking.currency,
        amountCents: refundAmount,
        sourceType: "cancel_rebook",
        sourceBookingId: oldBooking.id,
        description: `Cancel & rebook: credit from ${oldBooking.booking_number}`,
      });
    }

    // 5. Cancel old booking
    await supabase
      .from("bookings")
      .update({
        status: BOOKING_STATUSES.CANCELLED_PATIENT,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: "Cancelled and rebooked by patient",
      })
      .eq("id", oldBooking.id);

    // Clean up old booking (non-blocking)
    removeBookingFromGoogleCalendar(oldBooking.id).catch(() => {});
    removeBookingFromMicrosoftCalendar(oldBooking.id).catch(() => {});
    removeBookingFromCalDAV(oldBooking.id).catch(() => {});
    if (oldBooking.daily_room_name) {
      deleteRoom(oldBooking.daily_room_name).catch(() => {});
    }

    // 6. Create new booking via standard flow (wallet will be applied automatically)
    const result = await createBookingAndCheckout({
      doctor_id: input.doctor_id,
      appointment_date: input.appointment_date,
      start_time: input.start_time,
      end_time: input.end_time,
      consultation_type: input.consultation_type as "in_person" | "video",
      patient_notes: input.patient_notes,
      service_id: input.service_id,
    });

    return {
      ...result,
      cancelledBookingId: oldBooking.id,
      walletCreditCents: refundAmount,
      refundPercent,
    };
  } catch (err) {
    log.error("cancelAndRebook error:", { err });
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function getBookingDetails(bookingId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in." };
    }

    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        `
        *,
        patient:profiles!bookings_patient_id_fkey(
          id, first_name, last_name, email, avatar_url, phone
        ),
        doctor:doctors!inner(
          id, slug, title, base_currency, cancellation_policy,
          clinic_name, address,
          profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url, email),
          location:locations(city, country_code, timezone),
          specialties:doctor_specialties(
            specialty:specialties(id, name_key, slug),
            is_primary
          )
        )
      `
      )
      .eq("id", bookingId)
      .single();

    if (error || !booking) {
      return { error: "Booking not found." };
    }

    // Verify the user is either the patient or the doctor
    const isDoctorOwner = booking.doctor?.profile?.email === user.email;
    const isPatientOwner = booking.patient_id === user.id;

    if (!isPatientOwner && !isDoctorOwner) {
      return { error: "You are not authorized to view this booking." };
    }

    return { booking };
  } catch (err) {
    log.error("getBookingDetails error:", { err: err });
    return { error: "Failed to fetch booking details." };
  }
}

export interface AvailableDateInfo {
  date: string; // "YYYY-MM-DD"
  slotCount: number;
}

export async function getDoctorAvailableDates(
  doctorId: string,
  startDate: string, // "YYYY-MM-DD"
  endDate: string, // "YYYY-MM-DD"
  consultationType: string
): Promise<{ dates: AvailableDateInfo[]; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("get_available_dates_in_range", {
      p_doctor_id: doctorId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_consultation_type: consultationType,
    });

    if (error) {
      log.error("get_available_dates_in_range RPC error:", { err: error });
      return { dates: [], error: "Failed to fetch available dates." };
    }

    return {
      dates: (
        (data as { available_date: string; slot_count: number }[]) || []
      ).map((r) => ({
        date: r.available_date,
        slotCount: r.slot_count,
      })),
    };
  } catch (err) {
    log.error("getDoctorAvailableDates error:", { err: err });
    return { dates: [], error: "Failed to fetch available dates." };
  }
}

export async function getDoctorAvailableSlots(
  doctorId: string,
  date: string,
  consultationType: string,
  slotDurationOverride?: number
): Promise<{ slots: AvailableSlot[]; error?: string }> {
  try {
    // Use admin client so the RPC is callable regardless of the user's role
    // permissions (matches getNextAvailabilityBatch which also uses admin).
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("get_available_slots", {
      p_doctor_id: doctorId,
      p_date: date,
      p_consultation_type: consultationType,
      p_slot_duration_override: slotDurationOverride ?? null,
    });

    if (error) {
      log.error("get_available_slots RPC error:", { err: error });
      return { slots: [], error: "Failed to fetch available slots." };
    }

    return { slots: (data as AvailableSlot[]) || [] };
  } catch (err) {
    log.error("getDoctorAvailableSlots error:", { err: err });
    return { slots: [], error: "Failed to fetch available slots." };
  }
}

// ── Post-Visit Summary ──────────────────────────────────────────────

export async function saveVisitSummary(bookingId: string, summary: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "You must be logged in." };

    // Verify the user is the doctor for this booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, status, doctor_id, patient_id")
      .eq("id", bookingId)
      .single();

    if (!booking) return { error: "Booking not found." };
    if (booking.status !== "completed") {
      return { error: "Visit summary can only be added to completed bookings." };
    }

    // Check user is the doctor
    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("profile_id", user.id)
      .eq("id", booking.doctor_id)
      .single();

    if (!doctor) return { error: "Only the doctor can add a visit summary." };

    const trimmed = summary.trim();
    if (!trimmed || trimmed.length > 5000) {
      return { error: "Summary must be between 1 and 5000 characters." };
    }

    const admin = createAdminClient();
    const { error: updateErr } = await admin
      .from("bookings")
      .update({
        visit_summary: trimmed,
        visit_summary_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateErr) {
      log.error("[VisitSummary] Update error:", { err: updateErr });
      return { error: "Failed to save visit summary." };
    }

    // Notify patient
    try {
      await createNotification({
        userId: booking.patient_id,
        type: "visit_summary",
        title: "Visit Summary Available",
        message: "Your doctor has added a summary for your recent appointment.",
        channels: ["in_app", "email"],
        metadata: { bookingId },
      });
    } catch (err) {
      log.error("[VisitSummary] Notification error:", { err: err });
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    log.error("saveVisitSummary error:", { err: err });
    return { error: "An unexpected error occurred." };
  }
}
