import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
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

        // Record platform fee
        const booking = await supabase
          .from("bookings")
          .select("doctor_id, platform_fee_cents, currency")
          .eq("id", bookingId)
          .single();

        if (booking.data) {
          await supabase.from("platform_fees").insert({
            booking_id: bookingId,
            doctor_id: booking.data.doctor_id,
            fee_type: "commission",
            amount_cents: booking.data.platform_fee_cents,
            currency: booking.data.currency,
          });
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
