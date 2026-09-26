"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { getRequestOrigin } from "@/lib/http/origin";
import { SPECIALTIES } from "@/lib/constants/specialties";
import { log } from "@/lib/utils/logger";
import { requireOfferAdmin } from "@/lib/offers/require-offer-admin";
import { endOfLondonDay } from "@/lib/offers/dates";
import { poundsToPence } from "@/lib/offers/money";
import { isAnnualPlanId } from "@/lib/offers/plans";
import {
  annualDisplayPence,
  envAnnualPriceId,
  resolveLatestAnnualPrice,
} from "@/lib/offers/current-price";
import { renderOfferCopy } from "@/lib/offers/template";
import { slugifyOfferName } from "@/lib/offers/rows";
import { assertInviteSendsNoEmail, specialtyBenefitsEmailHook } from "@/lib/offers/specialty-benefits-email";
import { assertStripeTestMode } from "@/lib/offers/stripe-mode";
import {
  createAnnualPrice,
  createPercentOffCouponAndCode,
  deactivatePromotionCode,
  listAnnualSubscriptionsOnPrice,
  scheduleAnnualPriceSwitch,
} from "@/lib/offers/stripe-sync";
import { validateOfferDraft } from "@/lib/offers/validation";
import { formatSpecialtyName } from "@/lib/utils";

function doctorSpecialty(slug: string) {
  return SPECIALTIES.find((item) => item.slug === slug && item.category !== "testing");
}

export async function createSubscriptionOffer(formData: FormData) {
  const auth = await requireOfferAdmin();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };

  const kind = String(formData.get("kind") || "");
  const percentRaw = String(formData.get("percent_off") || "").trim();
  const trialRaw = String(formData.get("trial_days") || "").trim();
  const plans = formData
    .getAll("eligible_plans")
    .map((value) => String(value))
    .filter(Boolean);
  const redeemDate = String(formData.get("redeem_by") || "");
  const redeemBy = endOfLondonDay(redeemDate);
  if (!redeemBy) return { error: "Choose a redeem-by date." };

  const draft = validateOfferDraft({
    name: String(formData.get("name") || ""),
    kind: kind as "percent_first_year" | "free_trial",
    percentOff:
      kind === "percent_first_year" && percentRaw ? Number(percentRaw) : null,
    trialDays: kind === "free_trial" && trialRaw ? Number(trialRaw) : null,
    eligiblePlans: plans,
    redeemBy,
    now: new Date(),
  });
  if (!draft.ok) return { error: draft.error };

  const name = String(formData.get("name") || "").trim();
  const slug = slugifyOfferName(name);
  let couponId: string | null = null;
  let promotionCodeId: string | null = null;

  try {
    if (kind === "percent_first_year") {
      assertStripeTestMode();
      const stripe = getStripe();
      const created = await createPercentOffCouponAndCode(stripe, {
        name,
        percentOff: Number(percentRaw),
        redeemBy,
        offerSlug: slug,
      });
      couponId = created.couponId;
      promotionCodeId = created.promotionCodeId;
    }
  } catch (err) {
    log.error("Offer Stripe create failed", { err });
    const message = err instanceof Error ? err.message : "Could not create the Stripe offer.";
    return { error: message };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("subscription_offers").insert({
    slug,
    name,
    kind,
    percent_off: kind === "percent_first_year" ? Number(percentRaw) : null,
    trial_days: kind === "free_trial" ? Number(trialRaw) : null,
    eligible_plans: plans,
    redeem_by: redeemBy.toISOString(),
    active: true,
    stripe_coupon_id: couponId,
    stripe_promotion_code_id: promotionCodeId,
    created_by: auth.user.id,
  });
  if (error) {
    if (promotionCodeId) {
      try {
        await deactivatePromotionCode(getStripe(), promotionCodeId);
      } catch (deactivateErr) {
        log.error("Offer rollback failed", { err: deactivateErr });
      }
    }
    return { error: "Could not save the offer." };
  }

  revalidatePath("/admin/subscription-offers");
  return { success: true };
}

export async function deactivateSubscriptionOffer(formData: FormData) {
  const auth = await requireOfferAdmin();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };
  const id = String(formData.get("offer_id") || "");
  if (!id) return { error: "Missing offer." };

  const admin = createAdminClient();
  const { data: offer } = await admin
    .from("subscription_offers")
    .select("id, stripe_promotion_code_id")
    .eq("id", id)
    .maybeSingle();
  if (!offer) return { error: "Offer not found." };

  if (offer.stripe_promotion_code_id) {
    try {
      assertStripeTestMode();
      await deactivatePromotionCode(getStripe(), offer.stripe_promotion_code_id);
    } catch (err) {
      log.error("Offer deactivate Stripe failed", { err });
      const message = err instanceof Error ? err.message : "Could not deactivate the Stripe code.";
      return { error: message };
    }
  }

  const { error } = await admin
    .from("subscription_offers")
    .update({ active: false })
    .eq("id", id);
  if (error) return { error: "Could not switch the offer off." };
  revalidatePath("/admin/subscription-offers");
  return { success: true };
}

export async function createOfferInvite(formData: FormData) {
  const auth = await requireOfferAdmin();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };

  const offerId = String(formData.get("offer_id") || "");
  const specialtySlug = String(formData.get("specialty_slug") || "");
  const email = String(formData.get("doctor_email") || "").trim().toLowerCase();
  if (!doctorSpecialty(specialtySlug)) return { error: "Choose a specialty." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter the doctor's email." };
  }

  const admin = createAdminClient();
  const { data: offer } = await admin
    .from("subscription_offers")
    .select("*")
    .eq("id", offerId)
    .eq("active", true)
    .maybeSingle();
  if (!offer) return { error: "Choose a live offer." };
  if (new Date(offer.redeem_by).getTime() <= Date.now()) {
    return { error: "That offer is past its redeem-by date." };
  }

  const hook = specialtyBenefitsEmailHook({
    specialtySlug,
    doctorEmail: email,
    offerId,
  });
  assertInviteSendsNoEmail(hook);

  const token = randomBytes(24).toString("base64url");
  const { data: invite, error } = await admin
    .from("subscription_offer_invites")
    .insert({
      token,
      offer_id: offerId,
      specialty_slug: specialtySlug,
      doctor_email: email,
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (error || !invite) return { error: "Could not create the signup link." };

  await admin.from("subscription_offer_attributions").insert({
    invite_id: invite.id,
    offer_id: offerId,
    specialty_slug: specialtySlug,
    doctor_email: email,
    status: "invited",
  });

  const origin = await getRequestOrigin();
  const url = `${origin}/en/register-doctor/offer?invite=${encodeURIComponent(token)}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, width: 280 });
  const prices = await annualDisplayPence();
  const copy = renderOfferCopy({
    kind: offer.kind,
    percentOff: offer.percent_off,
    trialDays: offer.trial_days,
    redeemBy: new Date(offer.redeem_by),
    trialStartsAt: new Date(),
    soloFullPence: prices.solo,
    proFullPence: prices.pro,
  });

  return {
    success: true,
    url,
    qrSvg,
    copy,
    specialtyLabel: formatSpecialtyName(doctorSpecialty(specialtySlug)!.nameKey),
  };
}

export async function changeAnnualPlanPrice(formData: FormData) {
  const auth = await requireOfferAdmin();
  if (auth.error || !auth.user) return { error: auth.error || "Not authorized" };

  const planId = String(formData.get("plan_id") || "");
  if (!isAnnualPlanId(planId)) return { error: "Choose annual Solo or annual Pro." };
  const amountPence = poundsToPence(Number(formData.get("amount_pounds")));
  if (!amountPence) return { error: "Enter a price in pounds." };

  try {
    assertStripeTestMode();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Stripe test mode required." };
  }

  const tier = planId === "starter_annual" ? "starter" : "professional";
  const catalog = await resolveLatestAnnualPrice(tier);
  const oldPriceId = catalog?.stripePriceId || envAnnualPriceId(planId);
  if (!oldPriceId) {
    return {
      error:
        "No annual price is configured. Run scripts/seed-subscription-offers.ts against Stripe test mode first.",
    };
  }
  if (catalog?.amountPence === amountPence && catalog.stripePriceId) {
    return { error: "That is already the current price. Enter a new amount." };
  }

  const stripe = getStripe();
  const oldPrice = await stripe.prices.retrieve(oldPriceId);
  const productId = typeof oldPrice.product === "string" ? oldPrice.product : oldPrice.product.id;
  if (oldPrice.recurring?.interval && oldPrice.recurring.interval !== "year") {
    return { error: "Refusing to change a price that is not annual." };
  }

  const created = await createAnnualPrice(stripe, {
    productId,
    amountPence,
    planId,
  });

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("plan_price_versions").insert({
    plan_id: planId,
    amount_pence: amountPence,
    currency: "gbp",
    stripe_price_id: created.id,
    stripe_product_id: productId,
    created_by: auth.user.id,
  });
  if (insertError) return { error: "The Stripe price was created but could not be recorded." };

  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const previousPrices = prices.data.filter(
    (price) => price.id !== created.id && price.recurring?.interval === "year"
  );

  let scheduled = 0;
  const skipped: string[] = [];
  const now = new Date();
  for (const previous of previousPrices) {
    const subscriptions = await listAnnualSubscriptionsOnPrice(stripe, previous.id);
    for (const subscription of subscriptions) {
      try {
        const result = await scheduleAnnualPriceSwitch(stripe, {
          subscription,
          oldPriceId: previous.id,
          newPriceId: created.id,
          now,
        });
        await admin.from("subscription_price_schedules").upsert(
          {
            stripe_subscription_id: subscription.id,
            stripe_schedule_id: result.scheduleId,
            organization_id: subscription.metadata?.organization_id || null,
            plan_id: planId,
            from_price_id: previous.id,
            to_price_id: created.id,
            from_amount_pence: previous.unit_amount || 0,
            to_amount_pence: amountPence,
            switch_at: result.switchAt.toISOString(),
            notice_due_at: result.noticeDueAt.toISOString(),
          },
          { onConflict: "stripe_schedule_id" }
        );
        scheduled += 1;
      } catch (err) {
        log.error("Price schedule failed", { err, subscriptionId: subscription.id });
        skipped.push(subscription.id);
      }
    }
  }

  revalidatePath("/admin/subscription-offers/prices");
  return {
    success: true,
    stripePriceId: created.id,
    scheduled,
    skipped,
  };
}
