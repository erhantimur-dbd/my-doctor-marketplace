/**
 * Idempotent Stripe TEST setup for annual Solo/Pro prices and the three
 * example offers. Does not run in CI or from the app.
 *
 * Requires:
 *   STRIPE_SECRET_KEY=sk_test_...
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run (after migration 00114 is applied):
 *   npx tsx scripts/seed-subscription-offers.ts
 *
 * Then set the printed STRIPE_PRICE_*_ANNUAL values in the environment.
 * Checkout also reads the latest plan_price_versions row, which this script
 * inserts. Refuses sk_live_ keys. Does not edit an existing Stripe price.
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { EXAMPLE_OFFERS, SEED_ANNUAL_PRICES } from "../src/lib/offers/examples";
import { assertStripeTestSecret } from "../src/lib/offers/stripe-mode";
import { createPercentOffCouponAndCode } from "../src/lib/offers/stripe-sync";

async function findOrCreateProduct(
  stripe: Stripe,
  planId: string,
  name: string
): Promise<string> {
  const listed = await stripe.products.list({ active: true, limit: 100 });
  const existing = listed.data.find((product) => product.metadata?.md360_plan === planId);
  if (existing) return existing.id;
  const created = await stripe.products.create({
    name,
    metadata: { md360_plan: planId, billing_period: "annual" },
  });
  return created.id;
}

async function findOrCreatePrice(
  stripe: Stripe,
  input: {
    productId: string;
    lookupKey: string;
    amountPence: number;
    planId: string;
  }
): Promise<string> {
  const listed = await stripe.prices.list({
    product: input.productId,
    active: true,
    limit: 100,
  });
  const match = listed.data.find(
    (price) =>
      price.lookup_key === input.lookupKey &&
      price.unit_amount === input.amountPence &&
      price.recurring?.interval === "year"
  );
  if (match) return match.id;
  const sameAmount = listed.data.find(
    (price) =>
      price.unit_amount === input.amountPence && price.recurring?.interval === "year"
  );
  if (sameAmount) return sameAmount.id;

  const lookupTaken = listed.data.some((price) => price.lookup_key === input.lookupKey);
  const created = await stripe.prices.create({
    product: input.productId,
    unit_amount: input.amountPence,
    currency: "gbp",
    recurring: { interval: "year" },
    ...(lookupTaken ? {} : { lookup_key: input.lookupKey }),
    metadata: { md360_plan: input.planId, billing_period: "annual", md360_seed: "1" },
  });
  return created.id;
}

async function main() {
  assertStripeTestSecret(process.env.STRIPE_SECRET_KEY);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { typescript: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const redeemBy = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  console.log("Stripe test mode. Creating annual prices if they are missing.");

  for (const plan of SEED_ANNUAL_PRICES) {
    const productId = await findOrCreateProduct(stripe, plan.planId, plan.productName);
    const priceId = await findOrCreatePrice(stripe, {
      productId,
      lookupKey: plan.lookupKey,
      amountPence: plan.amountPence,
      planId: plan.planId,
    });
    const { error } = await supabase.from("plan_price_versions").upsert(
      {
        plan_id: plan.planId,
        amount_pence: plan.amountPence,
        currency: "gbp",
        stripe_price_id: priceId,
        stripe_product_id: productId,
      },
      { onConflict: "stripe_price_id" }
    );
    if (error) throw error;
    console.log(`${plan.envVar}=${priceId}`);
  }

  for (const example of EXAMPLE_OFFERS) {
    const { data: existing, error: readError } = await supabase
      .from("subscription_offers")
      .select("id, stripe_coupon_id, stripe_promotion_code_id")
      .eq("slug", example.slug)
      .maybeSingle();
    if (readError) throw readError;

    let couponId = existing?.stripe_coupon_id ?? null;
    let promotionCodeId = existing?.stripe_promotion_code_id ?? null;
    if (example.kind === "percent_first_year" && example.percentOff && !promotionCodeId) {
      const created = await createPercentOffCouponAndCode(stripe, {
        name: example.name,
        percentOff: example.percentOff,
        redeemBy,
        offerSlug: example.slug,
      });
      couponId = created.couponId;
      promotionCodeId = created.promotionCodeId;
    }

    if (existing) {
      if (couponId && promotionCodeId && !existing.stripe_promotion_code_id) {
        const { error } = await supabase
          .from("subscription_offers")
          .update({
            stripe_coupon_id: couponId,
            stripe_promotion_code_id: promotionCodeId,
          })
          .eq("id", existing.id);
        if (error) throw error;
      }
      console.log(`offer ${example.slug} already present`);
      continue;
    }

    const { error } = await supabase.from("subscription_offers").insert({
      slug: example.slug,
      name: example.name,
      kind: example.kind,
      percent_off: example.percentOff,
      trial_days: example.trialDays,
      eligible_plans: example.eligiblePlans,
      redeem_by: redeemBy.toISOString(),
      active: true,
      stripe_coupon_id: couponId,
      stripe_promotion_code_id: promotionCodeId,
    });
    if (error) throw error;
    console.log(`offer ${example.slug} created`);
  }

  console.log("Done. No live Stripe objects were created.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
