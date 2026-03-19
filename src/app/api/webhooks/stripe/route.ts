import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { exportBookingToGoogleCalendar } from "@/lib/google/sync";
import { exportBookingToMicrosoftCalendar } from "@/lib/microsoft/sync";
import { exportBookingToCalDAV } from "@/lib/caldav/sync";
import { createRoom } from "@/lib/daily/client";
import { sendEmail } from "@/lib/email/client";
import { bookingConfirmationEmail } from "@/lib/email/templates";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/client";
import {
  TEMPLATE_BOOKING_CONFIRMATION,
  buildBookingConfirmationComponents,
  mapLocaleToWhatsApp,
} from "@/lib/whatsapp/templates";
import { formatCurrency } from "@/lib/utils/currency";
import { sendSms as sendSmsMessage } from "@/lib/sms/client";
import { bookingConfirmationSms as bookingConfirmationSmsTemplate } from "@/lib/sms/templates";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotency check: skip if this event was already processed
  const { data: existing } = await supabase
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Mark as processed immediately (before handling) to prevent race conditions
  await supabase.from("processed_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
  });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      const invitationId = session.metadata?.invitation_id;

      const invoiceId = session.metadata?.invoice_id;

      if (invoiceId && session.metadata?.type === "invoice_payment") {
        // ─── Invoice payment ──────────────────────────────────────
        await supabase
          .from("invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_session_id: session.id,
          })
          .eq("id", invoiceId);

        // Record platform fee
        const { data: invoice } = await supabase
          .from("invoices")
          .select("doctor_id, platform_fee_cents, currency")
          .eq("id", invoiceId)
          .single();

        if (invoice) {
          await supabase.from("platform_fees").insert({
            invoice_id: invoiceId,
            doctor_id: invoice.doctor_id,
            fee_type: "invoice",
            amount_cents: invoice.platform_fee_cents,
            currency: invoice.currency,
          });
        }
      } else if (invitationId && session.mode === "payment") {
        const firstBookingId = session.metadata?.first_booking_id;

        // 1. Update invitation → accepted, paid_at, sessions_booked = 1
        await supabase
          .from("follow_up_invitations")
          .update({
            status: "accepted",
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent as string,
            paid_at: new Date().toISOString(),
            sessions_booked: 1,
          })
          .eq("id", invitationId);

        // 2. Confirm first booking
        if (firstBookingId) {
          await supabase
            .from("bookings")
            .update({
              status: "confirmed",
              stripe_payment_intent_id: session.payment_intent as string,
              paid_at: new Date().toISOString(),
            })
            .eq("id", firstBookingId);

          // Fetch full booking for email, video room, calendar export
          const { data: booking } = await supabase
            .from("bookings")
            .select(`
              id,
              booking_number,
              doctor_id,
              appointment_date,
              start_time,
              end_time,
              consultation_type,
              consultation_fee_cents,
              platform_fee_cents,
              total_amount_cents,
              currency,
              patient:profiles!bookings_patient_id_fkey(first_name, last_name, email, phone, notification_whatsapp, preferred_locale),
              doctor:doctors!inner(
                id,
                clinic_name,
                address,
                profile:profiles!doctors_profile_id_fkey(first_name, last_name)
              )
            `)
            .eq("id", firstBookingId)
            .single();

          if (booking) {
            // Record platform fee (for entire treatment plan)
            const { data: invitation } = await supabase
              .from("follow_up_invitations")
              .select("platform_fee_cents, currency")
              .eq("id", invitationId)
              .single();

            if (invitation) {
              await supabase.from("platform_fees").insert({
                booking_id: firstBookingId,
                doctor_id: booking.doctor_id,
                fee_type: "commission",
                amount_cents: invitation.platform_fee_cents,
                currency: invitation.currency,
              });
            }

            // Export to connected calendars (non-blocking)
            exportBookingToGoogleCalendar(firstBookingId).catch((err) =>
              console.error("Google Calendar export error (follow-up):", err)
            );
            exportBookingToMicrosoftCalendar(firstBookingId).catch((err) =>
              console.error("Microsoft Calendar export error (follow-up):", err)
            );
            exportBookingToCalDAV(firstBookingId).catch((err) =>
              console.error("CalDAV export error (follow-up):", err)
            );

            // Create video room if video consultation
            if (booking.consultation_type === "video") {
              try {
                const roomName = `md-${booking.booking_number.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
                const endTime = new Date(`${booking.appointment_date}T${booking.end_time}`);
                const expiresAt = Math.floor(endTime.getTime() / 1000) + 3600;

                const room = await createRoom({
                  name: roomName,
                  expiresAt,
                  maxParticipants: 2,
                });

                await supabase
                  .from("bookings")
                  .update({
                    video_room_url: room.url,
                    daily_room_name: room.name,
                  })
                  .eq("id", firstBookingId);
              } catch (err) {
                console.error("Daily.co room creation error (follow-up):", err);
              }
            }

            // Send confirmation email
            const patient: any = Array.isArray(booking.patient) ? booking.patient[0] : booking.patient;
            const doctor: any = Array.isArray(booking.doctor) ? booking.doctor[0] : booking.doctor;
            const doctorProfile: any = doctor?.profile
              ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
              : null;

            if (patient?.email && doctorProfile) {
              const consultationLabel = booking.consultation_type === "video"
                ? "Video Consultation"
                : "In-Person Consultation";

              const { subject, html } = bookingConfirmationEmail({
                patientName: patient.first_name || "Patient",
                doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
                date: booking.appointment_date,
                time: booking.start_time,
                consultationType: consultationLabel,
                bookingNumber: booking.booking_number,
                amount: booking.total_amount_cents / 100,
                currency: booking.currency.toUpperCase(),
                videoRoomUrl: booking.consultation_type === "video" ? null : undefined,
                clinicName: doctor.clinic_name,
                address: doctor.address,
              });

              sendEmail({ to: patient.email, subject, html }).catch((err) =>
                console.error("Confirmation email error (follow-up):", err)
              );

              // WhatsApp notification
              if (patient.notification_whatsapp && patient.phone) {
                const dateFormatted = new Date(booking.appointment_date).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                });

                sendWhatsAppTemplate({
                  to: patient.phone,
                  templateName: TEMPLATE_BOOKING_CONFIRMATION,
                  languageCode: mapLocaleToWhatsApp(patient.preferred_locale),
                  components: buildBookingConfirmationComponents({
                    patientName: patient.first_name || "there",
                    bookingNumber: booking.booking_number,
                    date: dateFormatted,
                    time: booking.start_time,
                    doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
                    amount: formatCurrency(booking.total_amount_cents, booking.currency),
                  }),
                }).catch((err) =>
                  console.error("WhatsApp confirmation error (follow-up):", err)
                );
              }
            }
          }
        }
      } else if (bookingId && session.mode === "payment") {
        await supabase
          .from("bookings")
          .update({
            status: "confirmed",
            stripe_payment_intent_id: session.payment_intent as string,
            paid_at: new Date().toISOString(),
          })
          .eq("id", bookingId);

        // Fetch full booking with patient + doctor details for email & video room
        const { data: booking } = await supabase
          .from("bookings")
          .select(`
            id,
            booking_number,
            doctor_id,
            appointment_date,
            start_time,
            end_time,
            consultation_type,
            consultation_fee_cents,
            platform_fee_cents,
            total_amount_cents,
            currency,
            payment_mode,
            deposit_amount_cents,
            remainder_due_cents,
            commission_cents,
            deposit_type,
            deposit_value,
            patient:profiles!bookings_patient_id_fkey(first_name, last_name, email, phone, notification_sms, notification_whatsapp, preferred_locale),
            doctor:doctors!inner(
              id,
              clinic_name,
              address,
              profile:profiles!doctors_profile_id_fkey(first_name, last_name)
            )
          `)
          .eq("id", bookingId)
          .single();

        if (booking) {
          // Record platform fee (booking fee + commission)
          const platformFeeTotal = booking.platform_fee_cents + (booking.commission_cents || 0);
          await supabase.from("platform_fees").insert({
            booking_id: bookingId,
            doctor_id: booking.doctor_id,
            fee_type: "commission",
            amount_cents: platformFeeTotal,
            currency: booking.currency,
          });

          // Export confirmed booking to doctor's connected calendars (non-blocking)
          exportBookingToGoogleCalendar(bookingId).catch((err) =>
            console.error("Google Calendar export error:", err)
          );
          exportBookingToMicrosoftCalendar(bookingId).catch((err) =>
            console.error("Microsoft Calendar export error:", err)
          );
          exportBookingToCalDAV(bookingId).catch((err) =>
            console.error("CalDAV export error:", err)
          );

          // Create Daily.co video room for video consultations
          let videoRoomUrl: string | null = null;
          if (booking.consultation_type === "video") {
            try {
              const roomName = `md-${booking.booking_number.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
              const endTime = new Date(`${booking.appointment_date}T${booking.end_time}`);
              const expiresAt = Math.floor(endTime.getTime() / 1000) + 3600; // end_time + 1 hour

              const room = await createRoom({
                name: roomName,
                expiresAt,
                maxParticipants: 2,
              });

              videoRoomUrl = room.url;

              await supabase
                .from("bookings")
                .update({
                  video_room_url: room.url,
                  daily_room_name: room.name,
                })
                .eq("id", bookingId);
            } catch (err) {
              console.error("Daily.co room creation error:", err);
              // Non-fatal: booking is still confirmed, just no video room yet
            }
          }

          // Send confirmation email (non-blocking)
          const patient: any = Array.isArray(booking.patient) ? booking.patient[0] : booking.patient;
          const doctor: any = Array.isArray(booking.doctor) ? booking.doctor[0] : booking.doctor;
          const doctorProfile: any = doctor?.profile
            ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
            : null;

          if (patient?.email && doctorProfile) {
            const consultationLabel = booking.consultation_type === "video"
              ? "Video Consultation"
              : booking.consultation_type === "phone"
                ? "Phone Consultation"
                : "In-Person Consultation";

            const isDeposit = booking.payment_mode === "deposit";
            const { subject, html } = bookingConfirmationEmail({
              patientName: patient.first_name || "Patient",
              doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
              date: booking.appointment_date,
              time: booking.start_time,
              consultationType: consultationLabel,
              bookingNumber: booking.booking_number,
              amount: booking.total_amount_cents / 100,
              currency: booking.currency.toUpperCase(),
              videoRoomUrl,
              clinicName: doctor.clinic_name,
              address: doctor.address,
              isDeposit,
              depositAmount: isDeposit && booking.deposit_amount_cents != null
                ? booking.deposit_amount_cents / 100
                : undefined,
              remainderDue: isDeposit && booking.remainder_due_cents != null
                ? booking.remainder_due_cents / 100
                : undefined,
              depositType: isDeposit ? (booking as any).deposit_type : undefined,
              depositValue: isDeposit ? (booking as any).deposit_value : undefined,
            });

            sendEmail({ to: patient.email, subject, html }).catch((err) =>
              console.error("Confirmation email error:", err)
            );

            // Send WhatsApp booking confirmation if opted in
            if (patient.notification_whatsapp && patient.phone) {
              const dateFormatted = new Date(booking.appointment_date).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });

              // For WhatsApp, show what was actually charged through Stripe
              const chargedAmount = isDeposit && booking.deposit_amount_cents != null
                ? booking.deposit_amount_cents + booking.platform_fee_cents
                : booking.total_amount_cents;

              sendWhatsAppTemplate({
                to: patient.phone,
                templateName: TEMPLATE_BOOKING_CONFIRMATION,
                languageCode: mapLocaleToWhatsApp(patient.preferred_locale),
                components: buildBookingConfirmationComponents({
                  patientName: patient.first_name || "there",
                  bookingNumber: booking.booking_number,
                  date: dateFormatted,
                  time: booking.start_time,
                  doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
                  amount: formatCurrency(chargedAmount, booking.currency),
                }),
              }).catch((err) =>
                console.error("WhatsApp confirmation error:", err)
              );
            }

            // Send SMS booking confirmation if opted in
            if (patient.notification_sms && patient.phone) {
              const dateFormatted2 = new Date(booking.appointment_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              });

              sendSmsMessage({
                to: patient.phone,
                body: bookingConfirmationSmsTemplate({
                  patientName: patient.first_name || "there",
                  doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
                  date: dateFormatted2,
                  time: booking.start_time?.slice(0, 5),
                  bookingNumber: booking.booking_number,
                }),
              }).catch((err) =>
                console.error("SMS confirmation error:", err)
              );
            }
          }
        }
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.organization_id;
      const doctorId = subscription.metadata?.doctor_id;

      // Access period dates from the raw object to handle different Stripe API versions
      const subData = subscription as unknown as Record<string, unknown>;
      const periodStart = subData.current_period_start as number | undefined;
      const periodEnd = subData.current_period_end as number | undefined;

      if (orgId) {
        // NEW: License subscription for an organization
        let licenseStatus: string;
        switch (subscription.status) {
          case "active":
            licenseStatus = "active";
            break;
          case "trialing":
            licenseStatus = "trialing";
            break;
          case "past_due":
            licenseStatus = "past_due";
            break;
          case "unpaid":
            licenseStatus = "grace_period";
            break;
          case "canceled":
            licenseStatus = "cancelled";
            break;
          default:
            licenseStatus = subscription.status;
        }

        await supabase.from("licenses").upsert(
          {
            organization_id: orgId,
            tier: subscription.metadata?.tier || "starter",
            status: licenseStatus,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            current_period_start: periodStart
              ? new Date(periodStart * 1000).toISOString()
              : new Date().toISOString(),
            current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : new Date().toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            ...(licenseStatus === "grace_period" && {
              grace_period_start: new Date().toISOString(),
            }),
            ...(licenseStatus === "cancelled" && {
              cancelled_at: new Date().toISOString(),
            }),
          },
          { onConflict: "stripe_subscription_id" }
        );
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.organization_id;

      // License cancellation
      if (orgId) {
        await supabase
          .from("licenses")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const updateData: Record<string, unknown> = {
        stripe_onboarding_complete: account.details_submitted,
        stripe_payouts_enabled: account.payouts_enabled,
      };

      // Detect restricted/disabled accounts
      if (
        account.requirements?.disabled_reason ||
        account.requirements?.currently_due?.length
      ) {
        updateData.stripe_requires_action = true;
      } else {
        updateData.stripe_requires_action = false;
      }

      await supabase
        .from("doctors")
        .update(updateData)
        .eq("stripe_account_id", account.id);

      // If payouts are disabled, log for admin visibility
      if (!account.payouts_enabled) {
        console.warn(
          `[Stripe] Doctor account ${account.id} payouts disabled. Reason: ${account.requirements?.disabled_reason || "unknown"}`
        );
      }
      break;
    }

    case "account.application.deauthorized": {
      // Doctor disconnected their Stripe account
      const account = event.data.object as unknown as { id: string };
      await supabase
        .from("doctors")
        .update({
          stripe_account_id: null,
          stripe_onboarding_complete: false,
          stripe_payouts_enabled: false,
          is_active: false, // Hide from search — can't accept payments
        })
        .eq("stripe_account_id", account.id);

      console.warn(
        `[Stripe] Doctor deauthorized Connect account ${account.id}. Doctor deactivated.`
      );
      break;
    }
  }

  return NextResponse.json({ received: true });
}
