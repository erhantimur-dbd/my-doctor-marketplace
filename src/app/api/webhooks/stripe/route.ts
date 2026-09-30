import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { exportBookingToGoogleCalendar } from "@/lib/google/sync";
import { exportBookingToMicrosoftCalendar } from "@/lib/microsoft/sync";
import { exportBookingToCalDAV } from "@/lib/caldav/sync";
import {
  ensureDailyVideoRoom,
  finalizeConfirmedBooking,
} from "@/lib/booking/finalize-confirmed-booking";
import {
  BOOKING_CURRENT_DOCTOR_INNER_EMBED,
  BOOKING_DOCTOR_PROFILE_EMBED,
} from "@/lib/patient/booking-doctor-embed";
import { sendEmail } from "@/lib/email/client";
import {
  resolvePatientConfirmationEmail,
  sendSoftsmokeTransferNotice,
} from "@/lib/email/softsmoke-send";
import { sendGuestAccountClaimEmail } from "@/lib/auth/guest-claim";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/client";
import {
  TEMPLATE_BOOKING_CONFIRMATION,
  buildBookingConfirmationComponents,
  mapLocaleToWhatsApp,
} from "@/lib/whatsapp/templates";
import { formatCurrency } from "@/lib/utils/currency";
import { formatAppointmentWindow } from "@/lib/utils/appointment-window";
import { sendSms as sendSmsMessage } from "@/lib/sms/client";
import { bookingConfirmationSms as bookingConfirmationSmsTemplate } from "@/lib/sms/templates";
import { creditWallet } from "@/lib/wallet";
import { settlePartCreditAfterCardPayment } from "@/lib/stripe/wallet-credit-share";
import { applyTreatmentPlanCheckoutPayment } from "@/lib/treatment-plan/complete-checkout";
import {
  paymentIntentIdFromStripe,
  persistBookingDestinationChargeIds,
} from "@/lib/stripe/destination-charge";
import { createNotification } from "@/lib/notifications";
import { earnPoints } from "@/lib/points";
import {
  handleChargeDisputeCreated,
  handleTransferReversed,
} from "@/lib/stripe/connect-event-handlers";
import {
  stripeWebhookSecretCandidates,
  verifyStripeWebhookSignature,
} from "@/lib/stripe/webhook-signature";
import Stripe from "stripe";


export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecrets = stripeWebhookSecretCandidates();
  if (webhookSecrets.length === 0) {
    console.error(
      "Webhook signature verification failed: no webhook secrets configured"
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    const verified = verifyStripeWebhookSignature({
      payload: body,
      signature: sig,
      secrets: webhookSecrets,
      constructEvent: (payload, signature, secret) =>
        stripe.webhooks.constructEvent(payload, signature, secret),
    });
    event = verified.event;
    console.info(`[Stripe] Webhook signature matched ${verified.kind} secret`);
  } catch (err) {
    console.error(
      "Webhook signature verification failed:",
      err instanceof Error ? err.name : "invalid signature"
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotency: select is a fast path; insert-first wins under concurrency.
  const { data: existing } = await supabase
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Claim the event BEFORE side effects. Unique violation => another worker won.
  const { error: claimError } = await supabase
    .from("processed_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
    });

  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Webhook idempotency claim failed:", claimError);
    return NextResponse.json({ error: "Idempotency claim failed" }, { status: 500 });
  }

  try {
  // charge.refunded and refund.created are not applied in this switch.
  // Consult counters are written by recordConsultRefundOnBooking, which claims
  // the Stripe refund id first. Copying the charge's refund total here would
  // add those cents a second time.
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (
        session.mode === "subscription" &&
        session.metadata?.type === "license"
      ) {
        const { onLicenseCheckoutCompleted } = await import(
          "@/lib/founding/checkout-events"
        );
        await onLicenseCheckoutCompleted(supabase, session);
      }

      // ── Wallet Top-Up ──
      // Prefer Stripe-charged amount over client-set metadata (money integrity).
      if (session.metadata?.type === "wallet_top_up") {
        const patientId = session.metadata.patient_id;
        const amountCents =
          typeof session.amount_total === "number" && session.amount_total > 0
            ? session.amount_total
            : parseInt(session.metadata.amount_cents || "0", 10);
        const cur = (
          session.currency ||
          session.metadata.currency ||
          "GBP"
        ).toUpperCase();

        if (patientId && amountCents > 0) {
          await creditWallet({
            patientId,
            currency: cur,
            amountCents,
            sourceType: "top_up",
            description: "Wallet top-up via Stripe",
          });
        }
        break;
      }

      // ── Gift Card Purchase ──
      // Activate only after payment; pending cards are not redeemable.
      if (session.metadata?.type === "gift_card_purchase") {
        const giftCardId = session.metadata.gift_card_id;
        if (giftCardId) {
          const { data: gc } = await supabase
            .from("gift_cards")
            .update({
              status: "active",
              stripe_payment_intent_id: session.payment_intent as string,
            })
            .eq("id", giftCardId)
            .in("status", ["pending", "active"])
            .select("*")
            .maybeSingle();

          if (gc && gc.recipient_email) {
            try {
              const { giftCardEmail: giftCardEmailTemplate } = await import("@/lib/email/templates");
              const { subject, html } = giftCardEmailTemplate({
                recipientName: gc.recipient_name || "Friend",
                senderName: gc.purchased_email || "Someone",
                amount: `${gc.currency} ${(gc.amount_cents / 100).toFixed(2)}`,
                code: gc.code,
                message: gc.message || null,
                expiresAt: gc.expires_at
                  ? new Date(gc.expires_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "long", year: "numeric",
                    })
                  : null,
              });
              await sendEmail({ to: gc.recipient_email, subject, html });
            } catch (err) {
              console.error("Gift card email error:", err);
            }
          }
        }
        break;
      }

      const bookingId = session.metadata?.booking_id;
      const invitationId = session.metadata?.invitation_id;
      const treatmentPlanId = session.metadata?.treatment_plan_id;

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
          const followUpPaymentIntentId = paymentIntentIdFromStripe(
            session.payment_intent
          );
          await supabase
            .from("bookings")
            .update({
              status: "confirmed",
              stripe_payment_intent_id: followUpPaymentIntentId,
              paid_at: new Date().toISOString(),
            })
            .eq("id", firstBookingId)
            .eq("status", "pending_payment");

          await persistBookingDestinationChargeIds({
            bookingId: firstBookingId,
            paymentIntentId: followUpPaymentIntentId,
            supabase,
          });

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
              video_room_url,
              daily_room_name,
              patient:profiles!bookings_patient_id_fkey(first_name, last_name, email, phone, notification_whatsapp, preferred_locale),
              doctor:${BOOKING_CURRENT_DOCTOR_INNER_EMBED}(
                id,
                clinic_name,
                address,
                profile:${BOOKING_DOCTOR_PROFILE_EMBED}(first_name, last_name)
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
            let followUpVideoRoomUrl: string | null = booking.video_room_url;
            if (booking.consultation_type === "video") {
              try {
                followUpVideoRoomUrl = await ensureDailyVideoRoom(
                  {
                    id: firstBookingId,
                    bookingNumber: booking.booking_number,
                    appointmentDate: booking.appointment_date,
                    endTime: booking.end_time,
                    consultationType: booking.consultation_type,
                    videoRoomUrl: booking.video_room_url,
                    dailyRoomName: booking.daily_room_name,
                  },
                  supabase
                );
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

              const { subject, html } = resolvePatientConfirmationEmail({
                patientName: patient.first_name || "Patient",
                doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
                date: booking.appointment_date,
                time: booking.start_time,
                end: booking.end_time,
                consultationType: consultationLabel,
                bookingNumber: booking.booking_number,
                amount: booking.total_amount_cents / 100,
                currency: booking.currency.toUpperCase(),
                videoRoomUrl:
                  booking.consultation_type === "video"
                    ? followUpVideoRoomUrl
                    : undefined,
                clinicName: doctor.clinic_name,
                address: doctor.address,
                bookingId: booking.id,
                doctor: {
                  id: booking.doctor_id,
                  slug: doctor.slug,
                  email: doctorProfile.email,
                },
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
      } else if (treatmentPlanId && session.mode === "payment") {
        // Care plan pay_full / pay_per_visit — must run before the generic
        // booking_id branch (per-visit metadata also sets booking_id).
        await applyTreatmentPlanCheckoutPayment(session, supabase);
      } else if (bookingId && session.mode === "payment") {
        const bookingPaymentIntentId = paymentIntentIdFromStripe(
          session.payment_intent
        );
        await supabase
          .from("bookings")
          .update({
            status: "confirmed",
            stripe_payment_intent_id: bookingPaymentIntentId,
            paid_at: new Date().toISOString(),
          })
          .eq("id", bookingId)
          .eq("status", "pending_payment");

        // Fetch full booking with patient + doctor details for email & video room
        const { data: booking } = await supabase
          .from("bookings")
          .select(`
            id,
            booking_number,
            patient_id,
            doctor_id,
            appointment_date,
            start_time,
            end_time,
            consultation_type,
            consultation_fee_cents,
            platform_fee_cents,
            total_amount_cents,
            currency,
            video_room_url,
            daily_room_name,
            payment_mode,
            deposit_amount_cents,
            remainder_due_cents,
            commission_cents,
            wallet_credit_applied_cents,
            deposit_type,
            deposit_value,
            is_guest,
            patient:profiles!bookings_patient_id_fkey(first_name, last_name, email, phone, notification_sms, notification_whatsapp, preferred_locale),
            doctor:${BOOKING_CURRENT_DOCTOR_INNER_EMBED}(
              id,
              stripe_account_id,
              clinic_name,
              address,
              profile:${BOOKING_DOCTOR_PROFILE_EMBED}(first_name, last_name)
            )
          `)
          .eq("id", bookingId)
          .single();

        if (booking) {
          const doctorForCredit: any = Array.isArray(booking.doctor)
            ? booking.doctor[0]
            : booking.doctor;
          const walletFromBooking = Number(booking.wallet_credit_applied_cents || 0);
          const walletFromSession = parseInt(session.metadata?.wallet_credit_cents || "0", 10);
          const walletCreditCents =
            walletFromBooking > 0 ? walletFromBooking : walletFromSession;

          // Card payment has succeeded. Take the credit and pay the doctor's
          // share before recording the fee, so a failure retries cleanly.
          if (walletCreditCents > 0) {
            await settlePartCreditAfterCardPayment({
              patientId: booking.patient_id,
              currency: booking.currency,
              bookingId,
              bookingNumber: booking.booking_number,
              doctorId: booking.doctor_id,
              stripeAccountId: doctorForCredit?.stripe_account_id || "",
              creditAmountCents: walletCreditCents,
              description: `Wallet credit applied to booking ${booking.booking_number}`,
            });
          }

          // Record platform fee (commission from doctor's share)
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

          const patient: any = Array.isArray(booking.patient) ? booking.patient[0] : booking.patient;
          const doctor: any = Array.isArray(booking.doctor) ? booking.doctor[0] : booking.doctor;
          const doctorProfile: any = doctor?.profile
            ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
            : null;

          // Daily room + doctor notify. Same helper as Softsmoke charge-skip.
          const { videoRoomUrl } = await finalizeConfirmedBooking(
            {
              id: booking.id,
              bookingNumber: booking.booking_number,
              patientId: booking.patient_id,
              doctorId: booking.doctor_id,
              appointmentDate: booking.appointment_date,
              startTime: booking.start_time,
              endTime: booking.end_time,
              consultationType: booking.consultation_type,
              totalAmountCents: booking.total_amount_cents,
              currency: booking.currency,
              videoRoomUrl: booking.video_room_url,
              dailyRoomName: booking.daily_room_name,
              paymentIntentId: bookingPaymentIntentId,
              patientFirstName: patient?.first_name ?? null,
              patientLastName: patient?.last_name ?? null,
              clinicName: doctor?.clinic_name ?? null,
              address: doctor?.address ?? null,
              notifyDoctor: Boolean(patient && doctorProfile),
            },
            { supabase }
          );

          // Send confirmation email (non-blocking)

          if (patient?.email && doctorProfile) {
            const consultationLabel = booking.consultation_type === "video"
              ? "Video Consultation"
              : booking.consultation_type === "phone"
                ? "Phone Consultation"
                : "In-Person Consultation";

            const isDeposit = booking.payment_mode === "deposit";
            const { subject, html } = resolvePatientConfirmationEmail({
              patientName: patient.first_name || "Patient",
              doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
              date: booking.appointment_date,
              time: booking.start_time,
              end: booking.end_time,
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
              bookingId: booking.id,
              doctor: {
                id: booking.doctor_id,
                slug: doctor.slug,
                email: doctorProfile.email,
              },
            });

            sendEmail({ to: patient.email, subject, html }).catch((err) =>
              console.error("Confirmation email error:", err)
            );

            // Guest checkout: magic recovery link to set a password (claim account)
            if (
              booking.is_guest === true ||
              session.metadata?.is_guest === "1"
            ) {
              sendGuestAccountClaimEmail({
                email: patient.email,
                patientName: patient.first_name || "there",
                bookingNumber: booking.booking_number,
                locale: patient.preferred_locale || "en",
              }).catch((err) =>
                console.error("Guest claim email error:", err)
              );
            }

            // Send WhatsApp booking confirmation if opted in
            if (patient.notification_whatsapp && patient.phone) {
              const dateFormatted = new Date(booking.appointment_date).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });

              // For WhatsApp, show what was actually charged through Stripe
              const chargedAmount = isDeposit && booking.deposit_amount_cents != null
                ? booking.deposit_amount_cents
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
              sendSmsMessage({
                to: patient.phone,
                body: bookingConfirmationSmsTemplate({
                  patientName: patient.first_name || "there",
                  doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
                  date: booking.appointment_date,
                  time: booking.start_time,
                  end: booking.end_time,
                  bookingNumber: booking.booking_number,
                }),
              }).catch((err) =>
                console.error("SMS confirmation error:", err)
              );
            }
          }

          // Patient in-app notification. Doctor notify already ran in finalizeConfirmedBooking.
          if (patient && doctorProfile) {
            const doctorName = `${doctorProfile.first_name} ${doctorProfile.last_name}`;
            const when = formatAppointmentWindow(
              booking.start_time,
              booking.end_time,
              { appointmentDate: booking.appointment_date }
            );

            // Notify patient (in-app)
            createNotification({
              userId: booking.patient_id,
              type: "booking_confirmed",
              title: "Booking Confirmed",
              message: `Your appointment with Dr. ${doctorName} on ${when} is confirmed.`,
              channels: ["in_app"],
              metadata: { booking_id: bookingId },
            }).catch((err) => console.error("Booking confirmed notification (patient):", err));
          }

          // ── P0: Referral points — reward both referrer and referred on first booking ──
          try {
            const { data: referral } = await supabase
              .from("patient_referrals")
              .select("id, referrer_id")
              .eq("referred_id", booking.patient_id)
              .eq("status", "booked")
              .maybeSingle();

            if (referral && referral.referrer_id) {
              const { earnBonusPoints } = await import("@/lib/points");
              const REFERRAL_POINTS = 1000;

              // Award referrer
              await earnBonusPoints(
                referral.referrer_id,
                REFERRAL_POINTS,
                "referral",
                "Referral reward — your friend completed their first booking"
              );

              // Award referred friend
              await earnBonusPoints(
                booking.patient_id,
                REFERRAL_POINTS,
                "referral",
                "Welcome bonus — you signed up through a referral"
              );

              await supabase
                .from("patient_referrals")
                .update({ status: "credited" })
                .eq("id", referral.id);
            }
          } catch (err) {
            console.error("Referral points error (non-fatal):", err);
          }

          // ── P5: Loyalty points — earn points based on booking value ──
          try {
            if (booking.consultation_fee_cents > 0) {
              await earnPoints({
                patientId: booking.patient_id,
                bookingId: bookingId,
                amountCents: booking.consultation_fee_cents,
              });
            }
          } catch (err) {
            console.error("Loyalty points error (non-fatal):", err);
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

        const tier = subscription.metadata?.tier || "starter";
        const seatFromMeta = parseInt(
          subscription.metadata?.seat_count ||
            subscription.metadata?.max_seats ||
            "0",
          10
        );
        const quantity =
          subscription.items?.data?.[0]?.quantity &&
          subscription.items.data[0].quantity > 0
            ? subscription.items.data[0].quantity
            : seatFromMeta > 0
              ? seatFromMeta
              : 1;
        // Clinic-style plans: included seats from metadata max_seats when set
        const maxSeatsMeta = parseInt(
          subscription.metadata?.max_seats || String(quantity),
          10
        );
        const maxSeats =
          Number.isFinite(maxSeatsMeta) && maxSeatsMeta > 0
            ? maxSeatsMeta
            : quantity;

        // Snapshot prior period start for scheduled downgrade apply (period roll)
        const { data: priorLic } = await supabase
          .from("licenses")
          .select("id, tier, current_period_start, metadata")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        const newPeriodStartIso = periodStart
          ? new Date(periodStart * 1000).toISOString()
          : new Date().toISOString();

        // Keep current paid tier until period end; do not apply pending_tier here
        const effectiveTier =
          subscription.metadata?.tier || priorLic?.tier || "starter";

        if (effectiveTier === "founding") {
          const { mayGrantFoundingLicence, foundingOfferLicenseMetadata } =
            await import("@/lib/founding/offer");
          const { claimFoundingSpotOnPayment, unixToIso } = await import(
            "@/lib/founding/spots"
          );
          const { futureFeaturedUntil } = await import(
            "@/lib/founding/spot-lifecycle"
          );
          const { sendDoctorWelcomeOnce } = await import(
            "@/lib/email/doctor-welcome-once"
          );
          let doctorIdForClaim: string | null =
            subscription.metadata?.doctor_id || doctorId || null;
          if (!doctorIdForClaim && orgId) {
            const { data: orgDoctor } = await supabase
              .from("doctors")
              .select("id")
              .eq("organization_id", orgId)
              .limit(1)
              .maybeSingle();
            doctorIdForClaim = orgDoctor?.id ?? null;
          }
          const itemPeriodEnd = (
            subscription.items?.data?.[0] as { current_period_end?: number } | undefined
          )?.current_period_end;
          const periodEndUnix =
            typeof periodEnd === "number" ? periodEnd : itemPeriodEnd;
          const periodEndIso = futureFeaturedUntil(unixToIso(periodEndUnix));
          let allowed = false;
          if (doctorIdForClaim) {
            const { data: foundingDoc } = await supabase
              .from("doctors")
              .select(
                "is_founding_member, founding_member_number, founding_offer_forfeited_at"
              )
              .eq("id", doctorIdForClaim)
              .maybeSingle();
            const forfeited = !!foundingDoc?.founding_offer_forfeited_at;
            const wasMember = foundingDoc?.is_founding_member === true;
            if (
              !forfeited &&
              (licenseStatus === "active" || licenseStatus === "trialing")
            ) {
              const claim = await claimFoundingSpotOnPayment(supabase, {
                doctorId: doctorIdForClaim,
                featuredUntil: periodEndIso,
              });
              allowed = mayGrantFoundingLicence(claim);
              if (allowed && claim.claimed && !wasMember) {
                await sendDoctorWelcomeOnce(doctorIdForClaim);
              }
            } else if (!forfeited) {
              allowed = mayGrantFoundingLicence({
                claimed: wasMember,
                foundingNumber: foundingDoc?.founding_member_number ?? null,
              });
            }
          }
          if (!allowed) {
            try {
              await getStripe().subscriptions.cancel(subscription.id);
            } catch (err) {
              console.error("Refused founding licence; cancel failed:", err);
            }
            break;
          }

          const licenseRow = {
            organization_id: orgId,
            tier: effectiveTier,
            status: licenseStatus,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            max_seats: maxSeats,
            used_seats: Math.min(quantity, maxSeats),
            current_period_start: newPeriodStartIso,
            current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : new Date().toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            metadata: {
              ...((priorLic?.metadata as Record<string, unknown>) || {}),
              ...foundingOfferLicenseMetadata(),
            },
            ...(licenseStatus === "grace_period" && {
              grace_period_start: new Date().toISOString(),
            }),
            ...(licenseStatus === "cancelled" && {
              cancelled_at: new Date().toISOString(),
            }),
          };
          await supabase.from("licenses").upsert(licenseRow, {
            onConflict: "stripe_subscription_id",
          });

          if (
            doctorIdForClaim &&
            (licenseStatus === "active" || licenseStatus === "trialing")
          ) {
            const { data: redeemed } = await supabase
              .from("doctors")
              .select("founding_offer_redeemed_at")
              .eq("id", doctorIdForClaim)
              .maybeSingle();
            if (redeemed && !redeemed.founding_offer_redeemed_at) {
              await supabase
                .from("doctors")
                .update({
                  founding_offer_redeemed_at: new Date().toISOString(),
                })
                .eq("id", doctorIdForClaim);
            }
          }
        } else {
        await supabase.from("licenses").upsert(
          {
            organization_id: orgId,
            tier: effectiveTier,
            status: licenseStatus,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            max_seats: maxSeats,
            used_seats: Math.min(quantity, maxSeats),
            current_period_start: newPeriodStartIso,
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

        // Paid→paid scheduled downgrade: when period rolls, switch price with no proration
        const pendingTier = subscription.metadata?.pending_tier;
        const pendingChange = subscription.metadata?.pending_change;
        if (
          pendingChange === "downgrade" &&
          pendingTier &&
          pendingTier !== "free" &&
          pendingTier !== effectiveTier &&
          (licenseStatus === "active" || licenseStatus === "trialing") &&
          priorLic?.current_period_start &&
          new Date(newPeriodStartIso) > new Date(priorLic.current_period_start)
        ) {
          try {
            const { getLicenseTier, getOrCreateLicensePriceId } = await import(
              "@/lib/constants/license-tiers"
            );
            const tierConfig = getLicenseTier(pendingTier);
            if (tierConfig && !tierConfig.isFreeTier) {
              const billingPeriod =
                pendingTier === "founding" ||
                subscription.metadata?.billing_period !== "annual"
                  ? "monthly"
                  : "annual";
              const priceId = await getOrCreateLicensePriceId(
                pendingTier,
                tierConfig,
                billingPeriod
              );
              const itemId = subscription.items?.data?.[0]?.id;
              const qty = subscription.items?.data?.[0]?.quantity || 1;
              if (itemId) {
                const { getStripe } = await import("@/lib/stripe/client");
                const stripeClient = getStripe();
                await stripeClient.subscriptions.update(subscription.id, {
                  items: [{ id: itemId, price: priceId, quantity: qty }],
                  proration_behavior: "none",
                  metadata: {
                    ...subscription.metadata,
                    tier: pendingTier,
                    pending_tier: "",
                    pending_change: "",
                    organization_id: orgId,
                    type: "license",
                  },
                });
                await supabase
                  .from("licenses")
                  .update({
                    tier: pendingTier,
                    metadata: {
                      ...((priorLic.metadata as Record<string, unknown>) || {}),
                      pending_tier: null,
                      pending_change: null,
                    },
                  })
                  .eq("stripe_subscription_id", subscription.id);
                if (effectiveTier === "founding" && pendingTier !== "founding") {
                  const doctorIdMeta = subscription.metadata?.doctor_id;
                  const forfeitedAt = new Date().toISOString();
                  if (doctorIdMeta) {
                    await supabase
                      .from("doctors")
                      .update({ founding_offer_forfeited_at: forfeitedAt })
                      .eq("id", doctorIdMeta);
                  } else {
                    await supabase
                      .from("doctors")
                      .update({ founding_offer_forfeited_at: forfeitedAt })
                      .eq("organization_id", orgId);
                  }
                }
              }
            }
          } catch (err) {
            console.error("Scheduled paid downgrade apply failed:", err);
          }
        }

        // Paid activation must supersede Founding Free gateway rows (no Stripe id).
        // Otherwise pickEffectiveLicense / booking gates can still see free as active.
        if (
          (licenseStatus === "active" ||
            licenseStatus === "trialing" ||
            licenseStatus === "past_due") &&
          effectiveTier &&
          effectiveTier !== "free"
        ) {
          await supabase
            .from("licenses")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
            })
            .eq("organization_id", orgId)
            .eq("tier", "free")
            .in("status", ["active", "trialing", "past_due"]);
        }

        // Referral rewards + testing addon when paid licence becomes active
        if (licenseStatus === "active" || licenseStatus === "trialing") {
          try {
            const { processReferralReward } = await import(
              "@/actions/referral"
            );
            let rewardDoctorId = subscription.metadata?.doctor_id;
            if (!rewardDoctorId) {
              const { data: orgDoctors } = await supabase
                .from("doctors")
                .select("id")
                .eq("organization_id", orgId)
                .limit(5);
              for (const d of orgDoctors || []) {
                await processReferralReward(d.id);
              }
            } else {
              await processReferralReward(rewardDoctorId);
            }
          } catch (err) {
            console.error("Referral reward error (non-fatal):", err);
          }

          // Medical testing: Clinic/Enterprise included, or paid add-on line item present
          try {
            const {
              shouldGrantTestingAfterLicenseActive,
              shouldRevokePaidTestingAddon,
              isTestingAddonPriceMetadata,
            } = await import("@/lib/license/medical-testing");

            const {
              getOrCreateTestingAddonPriceId,
            } = await import("@/lib/constants/license-tiers");
            let monthlyTestingId: string | null = null;
            let annualTestingId: string | null = null;
            try {
              monthlyTestingId =
                await getOrCreateTestingAddonPriceId("monthly");
              annualTestingId =
                await getOrCreateTestingAddonPriceId("annual");
            } catch {
              /* Stripe unavailable — fall back to metadata types only */
            }
            const items = subscription.items?.data || [];
            const hasTestingPriceItem = items.some((item) => {
              const price = item.price;
              const priceId =
                typeof price === "string" ? price : price?.id;
              if (
                priceId &&
                (priceId === monthlyTestingId || priceId === annualTestingId)
              ) {
                return true;
              }
              if (!price || typeof price === "string") return false;
              return isTestingAddonPriceMetadata(
                price.metadata as Record<string, string> | undefined
              );
            });

            const grantTesting = shouldGrantTestingAfterLicenseActive({
              tier: effectiveTier,
              hasTestingPriceItem,
              metadataHasTestingAddon:
                subscription.metadata?.has_testing_addon === "1",
            });
            const revokePaid = shouldRevokePaidTestingAddon({
              tier: effectiveTier,
              hasTestingPriceItem,
            });

            if (grantTesting) {
              const doctorIdMeta = subscription.metadata?.doctor_id;
              if (doctorIdMeta) {
                await supabase
                  .from("doctors")
                  .update({ has_testing_addon: true })
                  .eq("id", doctorIdMeta);
              } else {
                await supabase
                  .from("doctors")
                  .update({ has_testing_addon: true })
                  .eq("organization_id", orgId);
              }
              const { data: lic } = await supabase
                .from("licenses")
                .select("id")
                .eq("stripe_subscription_id", subscription.id)
                .maybeSingle();
              if (lic?.id) {
                await supabase.from("license_modules").upsert(
                  {
                    license_id: lic.id,
                    module_key: "medical_testing",
                    is_active: true,
                    activated_at: new Date().toISOString(),
                    deactivated_at: null,
                  },
                  { onConflict: "license_id,module_key" }
                );
              }
            } else if (revokePaid) {
              // Paid add-on removed (billing toggle) — keep flag false after webhook
              await supabase
                .from("doctors")
                .update({ has_testing_addon: false })
                .eq("organization_id", orgId);
              const { data: lic } = await supabase
                .from("licenses")
                .select("id")
                .eq("stripe_subscription_id", subscription.id)
                .maybeSingle();
              if (lic?.id) {
                await supabase
                  .from("license_modules")
                  .update({
                    is_active: false,
                    deactivated_at: new Date().toISOString(),
                  })
                  .eq("license_id", lic.id)
                  .eq("module_key", "medical_testing");
              }
            }
          } catch (err) {
            console.error("Testing entitlement activation error (non-fatal):", err);
          }
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.organization_id;

      // Paid period ended (cancel-at-period-end) or sub deleted
      if (orgId) {
        const { data: endingLic } = await supabase
          .from("licenses")
          .select("tier, status")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        const { isFoundingOfferSubscription } = await import(
          "@/lib/founding/offer"
        );
        const foundingSub = isFoundingOfferSubscription({
          metadataTier: subscription.metadata?.tier,
          metadataFoundingOffer: subscription.metadata?.founding_offer,
          licenseTier: endingLic?.tier,
        });

        await supabase
          .from("licenses")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancel_at_period_end: false,
          })
          .eq("stripe_subscription_id", subscription.id);

        if (foundingSub) {
          const subRaw = subscription as unknown as Record<string, unknown>;
          const endedUnix =
            (typeof subRaw.ended_at === "number" ? subRaw.ended_at : null) ||
            (typeof subRaw.canceled_at === "number" ? subRaw.canceled_at : null) ||
            (typeof subRaw.current_period_end === "number"
              ? subRaw.current_period_end
              : null);
          const featuredUntil = endedUnix
            ? new Date(endedUnix * 1000).toISOString()
            : new Date().toISOString();
          const wasLive = ["active", "trialing", "past_due", "grace_period"].includes(
            endingLic?.status ?? ""
          );
          const doctorIdMeta = subscription.metadata?.doctor_id;
          if (wasLive) {
            const forfeitedAt = new Date().toISOString();
            if (doctorIdMeta) {
              await supabase
                .from("doctors")
                .update({ founding_offer_forfeited_at: forfeitedAt })
                .eq("id", doctorIdMeta);
            } else {
              await supabase
                .from("doctors")
                .update({ founding_offer_forfeited_at: forfeitedAt })
                .eq("organization_id", orgId);
            }
            const { endFoundingFeatured } = await import("@/lib/founding/spots");
            await endFoundingFeatured(supabase, {
              doctorId: doctorIdMeta,
              organizationId: doctorIdMeta ? null : orgId,
              featuredUntil,
            });
          } else {
            const { releaseFoundingSpotReservation } = await import(
              "@/lib/founding/spots"
            );
            await releaseFoundingSpotReservation(supabase, {
              doctorId: doctorIdMeta,
            });
          }
        } else {
        // Reactivate a £0 licence that was already granted. Do not mint a new one.
        const { data: freeRows } = await supabase
          .from("licenses")
          .select("id, status")
          .eq("organization_id", orgId)
          .eq("tier", "free");

        const freeRow = freeRows?.[0];
        if (freeRow?.id) {
          await supabase
            .from("licenses")
            .update({
              status: "active",
              cancelled_at: null,
              cancel_at_period_end: false,
              current_period_start: new Date().toISOString(),
              current_period_end: "2099-12-31T23:59:59.000Z",
              stripe_subscription_id: null,
            })
            .eq("id", freeRow.id);
        }
        }

        // Deactivate paid add-on modules for this org's licences
        try {
          const { data: orgLics } = await supabase
            .from("licenses")
            .select("id")
            .eq("organization_id", orgId);
          const ids = (orgLics || []).map((l) => l.id);
          if (ids.length > 0) {
            await supabase
              .from("license_modules")
              .update({
                is_active: false,
                deactivated_at: new Date().toISOString(),
              })
              .in("license_id", ids);
          }
        } catch (err) {
          console.error("Module deactivation on cancel (non-fatal):", err);
        }

        // Clear product gate — Free gateway must not keep Medical Testing unlocked
        try {
          await supabase
            .from("doctors")
            .update({ has_testing_addon: false })
            .eq("organization_id", orgId);
        } catch (err) {
          console.error(
            "Clear has_testing_addon on subscription delete (non-fatal):",
            err
          );
        }
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (
        session.mode === "subscription" &&
        session.metadata?.type === "license"
      ) {
        const { onLicenseCheckoutExpired } = await import(
          "@/lib/founding/checkout-events"
        );
        await onLicenseCheckoutExpired(supabase, session);
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

    // ── Reschedule Balance Payment Succeeded ──────────────────────────────
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      // Only handle reschedule balance payments
      if (paymentIntent.metadata?.type !== "reschedule_balance") break;

      const newBookingId = paymentIntent.metadata.new_booking_id;
      const originalBookingId = paymentIntent.metadata.original_booking_id;

      if (!newBookingId || !originalBookingId) {
        console.error("[Stripe] reschedule_balance PI missing booking IDs", paymentIntent.id);
        break;
      }

      // 1. Confirm the new (rescheduled) booking
      await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          reschedule_payment_status: "paid",
          stripe_payment_intent_id: paymentIntent.id,
          paid_at: new Date().toISOString(),
        })
        .eq("id", newBookingId)
        .neq("status", "confirmed");

      await persistBookingDestinationChargeIds({
        bookingId: newBookingId,
        paymentIntentId: paymentIntent.id,
        supabase,
      });

      // 2. Cancel the original booking (superseded by the rescheduled one)
      await supabase
        .from("bookings")
        .update({ status: "cancelled_doctor" })
        .eq("id", originalBookingId);

      // 3. Fetch new booking for email + calendar exports
      const { data: rescheduleBooking } = await supabase
        .from("bookings")
        .select(`
          id,
          booking_number,
          patient_id,
          doctor_id,
          appointment_date,
          start_time,
          end_time,
          consultation_type,
          consultation_fee_cents,
          platform_fee_cents,
          total_amount_cents,
          reschedule_price_diff_cents,
          currency,
          patient:profiles!bookings_patient_id_fkey(first_name, last_name, email, phone, notification_whatsapp, preferred_locale),
          doctor:${BOOKING_CURRENT_DOCTOR_INNER_EMBED}(
            id,
            clinic_name,
            address,
            profile:${BOOKING_DOCTOR_PROFILE_EMBED}(first_name, last_name)
          )
        `)
        .eq("id", newBookingId)
        .single();

      if (rescheduleBooking) {
        // Record platform fee on the balance paid
        const diffCents = (rescheduleBooking as any).reschedule_price_diff_cents || 0;
        if (diffCents > 0) {
          await supabase.from("platform_fees").insert({
            booking_id: newBookingId,
            doctor_id: rescheduleBooking.doctor_id,
            fee_type: "commission",
            amount_cents: Math.round(diffCents * 0.15),
            currency: rescheduleBooking.currency,
          });
        }

        // Export to connected calendars (non-blocking)
        exportBookingToGoogleCalendar(newBookingId).catch((err) =>
          console.error("Google Calendar export error (reschedule):", err)
        );
        exportBookingToMicrosoftCalendar(newBookingId).catch((err) =>
          console.error("Microsoft Calendar export error (reschedule):", err)
        );
        exportBookingToCalDAV(newBookingId).catch((err) =>
          console.error("CalDAV export error (reschedule):", err)
        );

        // Send booking confirmation email
        const rPatient: any = Array.isArray(rescheduleBooking.patient)
          ? rescheduleBooking.patient[0]
          : rescheduleBooking.patient;
        const rDoctor: any = Array.isArray(rescheduleBooking.doctor)
          ? rescheduleBooking.doctor[0]
          : rescheduleBooking.doctor;
        const rDoctorProfile: any = rDoctor?.profile
          ? Array.isArray(rDoctor.profile) ? rDoctor.profile[0] : rDoctor.profile
          : null;

        if (rPatient?.email && rDoctorProfile) {
          const consultationLabel =
            rescheduleBooking.consultation_type === "video"
              ? "Video Consultation"
              : rescheduleBooking.consultation_type === "phone"
              ? "Phone Consultation"
              : "In-Person Consultation";

          const { subject, html } = resolvePatientConfirmationEmail({
            patientName: rPatient.first_name || "Patient",
            doctorName: `${rDoctorProfile.first_name} ${rDoctorProfile.last_name}`,
            date: rescheduleBooking.appointment_date,
            time: rescheduleBooking.start_time,
            end: rescheduleBooking.end_time,
            consultationType: consultationLabel,
            bookingNumber: rescheduleBooking.booking_number,
            amount: rescheduleBooking.total_amount_cents / 100,
            currency: rescheduleBooking.currency.toUpperCase(),
            clinicName: rDoctor.clinic_name,
            address: rDoctor.address,
            bookingId: rescheduleBooking.id,
            doctor: {
              id: rescheduleBooking.doctor_id,
              slug: rDoctor.slug,
              email: rDoctorProfile.email,
            },
          });

          sendEmail({ to: rPatient.email, subject, html }).catch((err) =>
            console.error("Confirmation email error (reschedule balance):", err)
          );

          // WhatsApp notification
          if (rPatient.notification_whatsapp && rPatient.phone) {
            const dateFormatted = new Date(rescheduleBooking.appointment_date).toLocaleDateString(
              "en-GB",
              { weekday: "short", day: "numeric", month: "short" }
            );

            sendWhatsAppTemplate({
              to: rPatient.phone,
              templateName: TEMPLATE_BOOKING_CONFIRMATION,
              languageCode: mapLocaleToWhatsApp(rPatient.preferred_locale),
              components: buildBookingConfirmationComponents({
                patientName: rPatient.first_name || "there",
                bookingNumber: rescheduleBooking.booking_number,
                date: dateFormatted,
                time: rescheduleBooking.start_time,
                doctorName: `${rDoctorProfile.first_name} ${rDoctorProfile.last_name}`,
                amount: formatCurrency(rescheduleBooking.total_amount_cents, rescheduleBooking.currency),
              }),
            }).catch((err) =>
              console.error("WhatsApp confirmation error (reschedule balance):", err)
            );
          }
        }
      }
      break;
    }

    // ── Reschedule Balance Payment Failed / Expired ───────────────────────
    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      if (paymentIntent.metadata?.type !== "reschedule_balance") break;

      const newBookingId = paymentIntent.metadata.new_booking_id;
      const originalBookingId = paymentIntent.metadata.original_booking_id;

      if (!newBookingId || !originalBookingId) break;

      // Mark the pending rescheduled booking as expired (only if still pending)
      await supabase
        .from("bookings")
        .update({
          reschedule_payment_status: "expired",
          status: "cancelled_doctor",
        })
        .eq("id", newBookingId)
        .eq("status", "pending_reschedule_payment");

      // Restore the original booking to confirmed (only if it hasn't been changed)
      await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", originalBookingId)
        .eq("status", "confirmed"); // No-op if already confirmed — but keep original active

      console.warn(
        `[Stripe] Reschedule balance payment ${event.type === "payment_intent.canceled" ? "expired" : "failed"} ` +
        `for new booking ${newBookingId}. Original booking ${originalBookingId} remains active.`
      );
      break;
    }

    // Tester-path consult-fee settlement. Other Connect accounts no-op inside
    // sendSoftsmokeTransferNotice before any email is built.
    // Platform endpoint. Destination-charge transfers are created on the
    // platform, so event.account is usually unset. Connect copies are
    // accepted and cross-checked when event.account is present.
    case "transfer.reversed": {
      await handleTransferReversed(supabase, event);
      break;
    }

    // Platform endpoint. Destination-charge disputes are on the platform
    // charge (with or without on_behalf_of). No refund and no reversal.
    case "charge.dispute.created": {
      await handleChargeDisputeCreated(supabase, event);
      break;
    }

    case "transfer.created": {
      const transfer = event.data.object as Stripe.Transfer;
      await sendSoftsmokeTransferNotice(supabase, transfer, {
        retrieveChargePaymentIntent: async (chargeId) => {
          const charge = await getStripe().charges.retrieve(chargeId);
          const pi = charge.payment_intent;
          if (!pi) return null;
          return typeof pi === "string" ? pi : pi.id;
        },
      }).catch((err) =>
        console.error("[Stripe] Softsmoke payout notice failed:", err)
      );
      break;
    }
  }

  return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook handler failed, releasing claim for retry:", err);
    await supabase
      .from("processed_webhook_events")
      .delete()
      .eq("event_id", event.id);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
