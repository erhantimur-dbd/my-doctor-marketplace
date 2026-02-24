import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { exportBookingToGoogleCalendar } from "@/lib/google/sync";
import { createRoom } from "@/lib/daily/client";
import { sendEmail } from "@/lib/email/client";
import { bookingConfirmationEmail } from "@/lib/email/templates";
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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;

      if (bookingId && session.mode === "payment") {
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
            patient:profiles!bookings_patient_id_fkey(first_name, last_name, email),
            doctor:doctors!inner(
              id,
              profile:profiles!doctors_profile_id_fkey(first_name, last_name)
            )
          `)
          .eq("id", bookingId)
          .single();

        if (booking) {
          // Record platform fee
          await supabase.from("platform_fees").insert({
            booking_id: bookingId,
            doctor_id: booking.doctor_id,
            fee_type: "commission",
            amount_cents: booking.platform_fee_cents,
            currency: booking.currency,
          });

          // Export confirmed booking to doctor's Google Calendar (non-blocking)
          exportBookingToGoogleCalendar(bookingId).catch((err) =>
            console.error("Google Calendar export error:", err)
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
            });

            sendEmail({ to: patient.email, subject, html }).catch((err) =>
              console.error("Confirmation email error:", err)
            );
          }
        }
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const doctorId = subscription.metadata?.doctor_id;

      if (doctorId) {
        // Access period dates from the raw object to handle different Stripe API versions
        const subData = subscription as unknown as Record<string, unknown>;
        const periodStart = subData.current_period_start as number | undefined;
        const periodEnd = subData.current_period_end as number | undefined;

        await supabase.from("doctor_subscriptions").upsert(
          {
            doctor_id: doctorId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            plan_id: (subscription.items.data[0]?.price?.lookup_key || "basic"),
            status: subscription.status === "active" ? "active" : subscription.status === "past_due" ? "past_due" : "cancelled",
            current_period_start: periodStart
              ? new Date(periodStart * 1000).toISOString()
              : new Date().toISOString(),
            current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : new Date().toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          },
          { onConflict: "stripe_subscription_id" }
        );
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from("doctor_subscriptions")
        .update({ status: "cancelled" })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await supabase
        .from("doctors")
        .update({
          stripe_onboarding_complete: account.details_submitted,
          stripe_payouts_enabled: account.payouts_enabled,
        })
        .eq("stripe_account_id", account.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
