"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { formatOfferDate } from "@/lib/offers/dates";
import { decideSubscriptionCancel, stripeCancelParams } from "@/lib/offers/cancel";
import { assertStripeTestMode, isStripeTestMode } from "@/lib/offers/stripe-mode";
import { log } from "@/lib/utils/logger";

/** Client billing page uses this so a live key never renders a cancel button. */
export async function offerSubscriptionCancelEnabled(): Promise<boolean> {
  return isStripeTestMode();
}

export async function cancelAnnualOrTrialSubscription() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership || membership.role !== "owner") {
    return { error: "Only the practice owner can cancel the subscription." };
  }

  const admin = createAdminClient();
  const { data: licenses } = await admin
    .from("licenses")
    .select(
      "id, tier, status, billing_period, offer_id, trial_ends_at, current_period_end, cancel_at_period_end, stripe_subscription_id"
    )
    .eq("organization_id", membership.organization_id)
    .in("status", ["active", "trialing", "past_due"]);

  const license = (licenses || []).find((row) => row.offer_id) || null;
  if (!license?.stripe_subscription_id) {
    return { error: "Monthly plans keep their current billing path." };
  }

  const decision = decideSubscriptionCancel({
    tier: license.tier,
    status: license.status,
    billingPeriod: license.billing_period,
    offerId: license.offer_id,
    trialEndsAt: license.trial_ends_at,
    periodEnd: license.current_period_end,
    cancelAtPeriodEnd: Boolean(license.cancel_at_period_end),
  });

  if (decision.action === "unchanged") return { error: decision.reason };
  if (decision.action === "already_ending") {
    return {
      success: true,
      alreadyEnding: true,
      accessEndsAt: decision.accessEndsAt,
      message: `Access ends on ${formatOfferDate(new Date(decision.accessEndsAt))}.`,
    };
  }

  const params = stripeCancelParams(decision);
  if (!params) return { error: "This subscription can't be cancelled from here." };

  try {
    assertStripeTestMode();
    const stripe = getStripe();
    await stripe.subscriptions.update(license.stripe_subscription_id, params);
  } catch (err) {
    log.error("Subscription cancel failed", { err, licenseId: license.id });
    const message = err instanceof Error ? err.message : "Could not cancel the subscription.";
    return { error: message };
  }

  await admin
    .from("licenses")
    .update({
      cancel_at_period_end: true,
      trial_ends_at:
        decision.action === "cancel_at_trial_end" ? decision.accessEndsAt : license.trial_ends_at,
    })
    .eq("id", license.id);

  const when = formatOfferDate(new Date(decision.accessEndsAt));
  const message =
    decision.action === "cancel_at_trial_end"
      ? `You won't be charged. Access ends on ${when}.`
      : `No refund. Access continues until ${when}, then ends. It will not renew.`;

  revalidatePath("/doctor-dashboard/organization/billing");
  return {
    success: true,
    accessEndsAt: decision.accessEndsAt,
    message,
  };
}
